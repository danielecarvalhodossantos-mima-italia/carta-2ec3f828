import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { CartaPage } from "@/components/carta-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRestaurant, membershipsOptions, slugFromName, validSlug } from "@/lib/carta";

export const Route = createFileRoute("/_authenticated/ristoranti")({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(membershipsOptions(context.user.id)); },
  head: () => ({ meta: [{ title: "I tuoi ristoranti – Carta" }, { name: "description", content: "I ristoranti associati al tuo account Carta." }, { property: "og:title", content: "I tuoi ristoranti – Carta" }, { property: "og:description", content: "I ristoranti associati al tuo account Carta." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  pendingComponent: () => <CartaPage><p role="status">Caricamento ristoranti…</p></CartaPage>,
  errorComponent: ({ reset }) => <CartaPage><p role="alert" className="mb-4 text-destructive">Non è stato possibile caricare i ristoranti.</p><Button onClick={reset}>Riprova</Button></CartaPage>,
  component: Restaurants,
});

function Restaurants() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(membershipsOptions(user.id));
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!name.trim()) { setError("Inserisci il nome del ristorante"); return; }
    if (!validSlug(slug)) { setError("L’indirizzo deve contenere da 3 a 40 caratteri: lettere minuscole, numeri o trattini"); return; }
    setBusy(true);
    try {
      const { data, error: rpcError } = await createRestaurant({ p_name: name.trim(), p_slug: slug });
      if (rpcError) { setError(rpcError.code === "23505" ? "Questo indirizzo è già usato" : "Impossibile creare il ristorante: " + rpcError.message); return; }
      if (!data) { setError("Il ristorante non è stato restituito. Riprova."); return; }
      await queryClient.invalidateQueries({ queryKey: membershipsOptions(user.id).queryKey });
      await navigate({ to: "/dashboard/$restaurantId", params: { restaurantId: data } });
    } catch { setError("Connessione non riuscita. Riprova."); }
    finally { setBusy(false); }
  }

  return <CartaPage><h1 className="mb-8 font-serif text-3xl font-semibold">{memberships.length ? "I tuoi ristoranti" : "Crea ristorante"}</h1>
    {memberships.length ? <ul className="divide-y border-y">{memberships.map(member => <li key={member.restaurant_id}>
      {member.restaurants ? <Link to="/dashboard/$restaurantId" params={{ restaurantId: member.restaurant_id }} className="flex items-center justify-between gap-4 py-6 transition-colors hover:text-primary"><span className="min-w-0 break-words text-lg font-medium">{member.restaurants.name}</span><ArrowRight className="size-5 shrink-0" /></Link> : <p className="py-6 text-muted-foreground">Ristorante non trovato</p>}
    </li>)}</ul> : <form onSubmit={submit} className="max-w-md space-y-6">
      <div className="space-y-2"><label htmlFor="name" className="text-sm font-medium">Nome del ristorante</label><Input id="name" required value={name} disabled={busy} onChange={e => { setName(e.target.value); if (!slugEdited) setSlug(slugFromName(e.target.value)); }} /></div>
      <div className="space-y-2"><label htmlFor="slug" className="text-sm font-medium">Slug</label><Input id="slug" required pattern="[a-z0-9-]{3,40}" minLength={3} maxLength={40} autoCapitalize="none" spellCheck={false} value={slug} disabled={busy} onChange={e => { setSlugEdited(true); setSlug(e.target.value); }} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}><Plus />{busy ? "Creazione…" : "Crea ristorante"}</Button>
    </form>}
  </CartaPage>;
}