-- =====================================================================
-- Carta — menu digitale multi-ristorante
-- Migrazione 001: schema, Row Level Security, funzioni RPC
-- Obiettivo: i dati di un ristorante non devono MAI essere visibili a un altro.
-- =====================================================================

-- ---------- Tabelle ----------

create table public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  created_at  timestamptz not null default now()
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'staff' check (role in ('owner', 'staff')),
  primary key (restaurant_id, user_id)
);
create index restaurant_members_user_idx on public.restaurant_members (user_id);

create table public.dishes (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category      text not null default 'Altro',
  -- traduzioni: {"it": "...", "en": "...", "de": "...", "fr": "..."}; 'it' obbligatorio
  name          jsonb not null check (name ? 'it'),
  description   jsonb not null default '{}'::jsonb,
  price         numeric(8,2) not null check (price >= 0),
  food_cost     numeric(8,2) not null default 0 check (food_cost >= 0),
  margin        numeric(8,2) generated always as (price - food_cost) stored,
  is_published  boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index dishes_restaurant_idx on public.dishes (restaurant_id);

create table public.menu_views (
  id            bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number  int check (table_number between 1 and 500),
  lang          text not null default 'it',
  viewed_at     timestamptz not null default now()
);
create index menu_views_restaurant_time_idx on public.menu_views (restaurant_id, viewed_at);

-- ---------- Helper di autorizzazione ----------
-- SECURITY DEFINER: legge restaurant_members senza passare dalle sue stesse policy
-- (evita la ricorsione infinita). search_path vuoto: niente hijacking via schema.
create or replace function public.is_member(rid uuid, required_role text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_members m
    where m.restaurant_id = rid
      and m.user_id = auth.uid()
      and (required_role is null or m.role = required_role)
  );
$$;

-- ---------- Row Level Security ----------

alter table public.restaurants        enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.dishes             enable row level security;
alter table public.menu_views         enable row level security;

-- restaurants: i membri leggono, solo l'owner modifica. Nessun insert diretto (si passa da create_restaurant).
create policy "membri leggono il proprio ristorante" on public.restaurants
  for select to authenticated using (public.is_member(id));

create policy "owner modifica il proprio ristorante" on public.restaurants
  for update to authenticated
  using (public.is_member(id, 'owner'))
  with check (public.is_member(id, 'owner'));

-- restaurant_members: i membri vedono il team, l'owner aggiunge/rimuove persone nel PROPRIO ristorante.
create policy "membri vedono il team" on public.restaurant_members
  for select to authenticated using (public.is_member(restaurant_id));

create policy "owner aggiunge membri" on public.restaurant_members
  for insert to authenticated with check (public.is_member(restaurant_id, 'owner'));

create policy "owner rimuove membri" on public.restaurant_members
  for delete to authenticated using (public.is_member(restaurant_id, 'owner'));

-- dishes: solo membri. WITH CHECK sull'update impedisce di "spostare" un piatto in un altro ristorante.
create policy "membri leggono i piatti" on public.dishes
  for select to authenticated using (public.is_member(restaurant_id));

create policy "membri creano piatti" on public.dishes
  for insert to authenticated with check (public.is_member(restaurant_id));

create policy "membri modificano piatti" on public.dishes
  for update to authenticated
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

create policy "owner elimina piatti" on public.dishes
  for delete to authenticated using (public.is_member(restaurant_id, 'owner'));

-- menu_views: lettura solo membri. Nessuna policy di insert: si scrive solo via log_menu_view().
create policy "membri leggono le statistiche" on public.menu_views
  for select to authenticated using (public.is_member(restaurant_id));

-- Nota: nessuna policy per il ruolo anon su nessuna tabella.
-- Il pubblico accede SOLO tramite le funzioni qui sotto.

-- ---------- RPC ----------

-- Crea ristorante + membership owner in un'unica transazione.
create or replace function public.create_restaurant(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'non autenticato';
  end if;

  insert into public.restaurants (name, slug)
  values (p_name, lower(p_slug))
  returning id into rid;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (rid, auth.uid(), 'owner');

  return rid;
end;
$$;

-- Menu pubblico: SOLO piatti pubblicati e SOLO colonne pubbliche.
-- La RLS filtra le righe, non le colonne: per questo il pubblico non legge dishes direttamente
-- (altrimenti vedrebbe food_cost e margin).
create or replace function public.get_public_menu(p_slug text, p_lang text default 'it')
returns table (
  restaurant_name  text,
  dish_category    text,
  dish_name        text,
  dish_description text,
  dish_price       numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.name,
    d.category,
    coalesce(d.name ->> p_lang, d.name ->> 'it'),
    coalesce(d.description ->> p_lang, d.description ->> 'it'),
    d.price
  from public.restaurants r
  join public.dishes d on d.restaurant_id = r.id
  where r.slug = p_slug
    and d.is_published
  order by d.category, d.sort_order, d.created_at;
$$;

-- Registra una visualizzazione del menu (scansione QR). Valida lo slug lato DB.
create or replace function public.log_menu_view(p_slug text, p_table int default null, p_lang text default 'it')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.menu_views (restaurant_id, table_number, lang)
  select r.id, p_table, left(coalesce(p_lang, 'it'), 5)
  from public.restaurants r
  where r.slug = p_slug;
$$;

-- Statistiche per tavolo. SECURITY INVOKER: la RLS di menu_views si applica,
-- quindi chi non è membro ottiene zero righe anche passando l'id di un altro ristorante.
create or replace function public.menu_stats(p_restaurant uuid, p_days int default 30)
returns table (table_number int, views bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.table_number, count(*)
  from public.menu_views v
  where v.restaurant_id = p_restaurant
    and v.viewed_at > now() - make_interval(days => p_days)
  group by v.table_number
  order by 2 desc;
$$;

-- ---------- Permessi di esecuzione ----------
revoke execute on function public.create_restaurant(text, text)          from public, anon;
grant  execute on function public.create_restaurant(text, text)          to authenticated;

revoke execute on function public.menu_stats(uuid, int)                  from public, anon;
grant  execute on function public.menu_stats(uuid, int)                  to authenticated;

grant  execute on function public.get_public_menu(text, text)            to anon, authenticated;
grant  execute on function public.log_menu_view(text, int, text)         to anon, authenticated;
