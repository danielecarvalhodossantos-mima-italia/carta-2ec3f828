import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: () => { throw redirect({ to: "/login", replace: true }); },
  head: () => ({ meta: [{ title: "Accesso account – Carta" }, { name: "description", content: "Accedi al tuo account Carta." }, { property: "og:title", content: "Accesso account – Carta" }, { property: "og:description", content: "Accedi al tuo account Carta." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});