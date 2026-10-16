import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CartaPage } from "@/components/carta-auth";
import { Button } from "@/components/ui/button";
import { restaurantOptions } from "@/lib/carta";

export const Route = createFileRoute("/_authenticated/dashboard/$restaurantId")({
  loader: async ({ context, params }) => { await context.queryClient.ensureQueryData(restaurantOptions(context.user.id, params.restaurantId)); },
  head: () => ({ meta: [{ title: "Ristorante – Carta" }, { name: "description", content: "Nome e ruolo nel tuo ristorante su Carta." }, { property: "og:title", content: "Ristorante – Carta" }, { property: "og:description", content: "Nome e ruolo nel tuo ristorante su Carta." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  pendingComponent: () => <CartaPage><p role="status">Caricamento ristorante…</p></CartaPage>,
  errorComponent: ({ reset }) => <CartaPage><p role="alert" className="mb-4 text-destructive">Non è stato possibile caricare il ristorante.</p><Button onClick={reset}>Riprova</Button></CartaPage>,
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { restaurantId } = Route.useParams();
  const { data } = useSuspenseQuery(restaurantOptions(user.id, restaurantId));
  return <CartaPage>
    <Button asChild variant="ghost" className="mb-8"><Link to="/ristoranti"><ArrowLeft />Ristoranti</Link></Button>
    {data?.restaurants ? <><h1 className="break-words font-serif text-3xl font-semibold">{data.restaurants.name}</h1><p className="mt-4 text-muted-foreground">Ruolo: <span className="font-medium text-foreground">{data.role}</span></p></> : <h1 className="font-serif text-3xl font-semibold">Ristorante non trovato</h1>}
  </CartaPage>;
}