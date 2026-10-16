-- =====================================================================
-- Test di isolamento dei dati tra ristoranti (RLS)
-- Da eseguire nel SQL Editor di Supabase DOPO la migrazione 001.
--
-- PRIMA: crea due utenti in Authentication > Users con email ESATTAMENTE
-- a@test.it e b@test.it. Il test li trova da solo: non c'è niente da sostituire.
--
-- Alla fine cancella i dati di prova: non lascia niente nel database.
-- Risultato atteso: una tabella di 11 righe, tutte con ok = true.
-- =====================================================================

drop table if exists _test;
create temp table _test (n int, test text, ok boolean);

begin;
grant all on _test to authenticated, anon;

-- Controllo: i due utenti di prova devono esistere
do $$
begin
  if (select count(*) from auth.users where email in ('a@test.it', 'b@test.it')) <> 2 then
    raise exception 'Crea prima gli utenti a@test.it e b@test.it in Authentication > Users';
  end if;
end $$;

-- ---------- Dati di prova (come postgres: la RLS non si applica) ----------
insert into public.restaurants (id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'Trattoria A', 'trattoria-a'),
  ('00000000-0000-0000-0000-00000000000b', 'Pizzeria B',  'pizzeria-b');

insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', (select id from auth.users where email = 'a@test.it'), 'owner'),
  ('00000000-0000-0000-0000-00000000000b', (select id from auth.users where email = 'b@test.it'), 'owner');

insert into public.dishes (restaurant_id, name, price, food_cost, is_published) values
  ('00000000-0000-0000-0000-00000000000a', '{"it":"Carbonara","en":"Carbonara"}', 14, 3.20, true),
  ('00000000-0000-0000-0000-00000000000b', '{"it":"Margherita"}',                  8,  1.50, true),
  ('00000000-0000-0000-0000-00000000000b', '{"it":"Piatto in prova"}',            20,  6.00, false);

-- ---------- Come UTENTE A ----------
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'a@test.it'), 'role', 'authenticated')::text, true);
set local role authenticated;

insert into _test
select 1, 'A vede solo i propri piatti (1)', count(*) = 1 from public.dishes;

insert into _test
select 2, 'A non vede il ristorante B', count(*) = 0
from public.restaurants where slug = 'pizzeria-b';

with u as (
  update public.dishes set price = 0
  where restaurant_id = '00000000-0000-0000-0000-00000000000b'
  returning 1
)
insert into _test
select 3, 'A non può modificare i piatti di B', count(*) = 0 from u;

do $$
begin
  insert into public.dishes (restaurant_id, name, price)
  values ('00000000-0000-0000-0000-00000000000b', '{"it":"Intruso"}', 1);
  insert into _test values (4, 'A non può creare piatti in B', false);
exception when insufficient_privilege then
  insert into _test values (4, 'A non può creare piatti in B', true);
end $$;

do $$
begin
  update public.dishes
  set restaurant_id = '00000000-0000-0000-0000-00000000000b'
  where restaurant_id = '00000000-0000-0000-0000-00000000000a';
  insert into _test values (5, 'A non può spostare un suo piatto in B', false);
exception when insufficient_privilege then
  insert into _test values (5, 'A non può spostare un suo piatto in B', true);
end $$;

do $$
begin
  insert into public.restaurant_members (restaurant_id, user_id, role)
  values ('00000000-0000-0000-0000-00000000000b', auth.uid(), 'owner');
  insert into _test values (6, 'A non può aggiungersi al team di B', false);
exception when insufficient_privilege then
  insert into _test values (6, 'A non può aggiungersi al team di B', true);
end $$;

insert into _test
select 7, 'menu_stats di B restituisce zero righe ad A', count(*) = 0
from public.menu_stats('00000000-0000-0000-0000-00000000000b', 30);

-- ---------- Come visitatore anonimo ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

insert into _test
select 8, 'anon non legge la tabella dishes', count(*) = 0 from public.dishes;

insert into _test
select 9, 'menu pubblico B mostra solo i piatti pubblicati (1)', count(*) = 1
from public.get_public_menu('pizzeria-b', 'it');

select public.log_menu_view('pizzeria-b', 3, 'it');

do $$
begin
  insert into public.menu_views (restaurant_id, table_number)
  values ('00000000-0000-0000-0000-00000000000b', 99);
  insert into _test values (10, 'anon non scrive direttamente su menu_views', false);
exception when insufficient_privilege then
  insert into _test values (10, 'anon non scrive direttamente su menu_views', true);
end $$;

-- ---------- Come UTENTE B ----------
reset role;  -- auth.users si legge solo da postgres
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'b@test.it'), 'role', 'authenticated')::text, true);
set local role authenticated;

insert into _test
select 11, 'B vede la visualizzazione registrata dal tavolo 3', count(*) = 1
from public.menu_stats('00000000-0000-0000-0000-00000000000b', 30)
where table_number = 3;

-- ---------- Pulizia e risultati ----------
reset role;
-- on delete cascade: elimina anche membri, piatti e visualizzazioni di prova
delete from public.restaurants
where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
commit;

select n, test, ok from _test order by n;
