import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-center">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
        Carta – menu digitale per ristoranti
      </h1>
      <button
        type="button"
        className="rounded-full bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Accedi
      </button>
    </main>
  );
}
