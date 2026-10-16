import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCartaAuth, SignOutButton } from "@/components/carta-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Carta – menu digitale per ristoranti" },
      { name: "description", content: "Carta: il menu digitale per il tuo ristorante." },
      { property: "og:title", content: "Carta – menu digitale per ristoranti" },
      { property: "og:description", content: "Carta: il menu digitale per il tuo ristorante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, ready } = useCartaAuth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-center">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
        Carta – menu digitale per ristoranti
      </h1>
      {ready && (user ? <div className="flex flex-wrap items-center justify-center gap-4"><Button asChild size="lg"><Link to="/ristoranti">I tuoi ristoranti</Link></Button><SignOutButton /></div> : <Button asChild size="lg"><Link to="/login">Accedi</Link></Button>)}
    </main>
  );
}
