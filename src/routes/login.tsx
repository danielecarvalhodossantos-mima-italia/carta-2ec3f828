import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartaAuth, SignOutButton } from "@/components/carta-auth";
import { authErrorMessage } from "@/lib/carta";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Accedi e registrati – Carta" }, { name: "description", content: "Accedi o crea il tuo account Carta con email e password." }, { property: "og:title", content: "Accedi e registrati – Carta" }, { property: "og:description", content: "Accedi o crea il tuo account Carta con email e password." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Login,
});

function Login() {
  const navigate = Route.useNavigate();
  const { user, ready } = useCartaAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/login` } });
      if (result.error) { setError(authErrorMessage(result.error.message)); return; }
      if (result.data.session) { await navigate({ to: "/ristoranti" }); }
      else { setNotice("Controlla la tua email per confermare la registrazione, poi accedi."); setPassword(""); }
    } catch { setError("Connessione non riuscita. Riprova."); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
    <div className="w-full max-w-sm">
      <Link to="/" className="font-serif text-2xl font-semibold">Carta</Link>
      <h1 className="mb-8 mt-8 font-serif text-3xl font-semibold">{user ? "Il tuo account" : mode === "login" ? "Accedi" : "Crea un account"}</h1>
      {!ready ? <p role="status">Caricamento…</p> : user ? <div className="space-y-6"><Button asChild className="w-full"><Link to="/ristoranti">I tuoi ristoranti</Link></Button><SignOutButton /></div> : <>
        <div className="mb-6 grid grid-cols-2 gap-2" role="group" aria-label="Accesso o registrazione">
          <Button type="button" variant={mode === "login" ? "default" : "outline"} disabled={busy} aria-pressed={mode === "login"} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Accedi</Button>
          <Button type="button" variant={mode === "signup" ? "default" : "outline"} disabled={busy} aria-pressed={mode === "signup"} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>Registrati</Button>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">Email</label><Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
          <div className="space-y-2"><label htmlFor="password" className="text-sm font-medium">Password</label><Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "signup" ? 6 : undefined} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Attendi…" : mode === "login" ? "Accedi con email" : "Crea account"}</Button>
        </form>
      </>}
    </div>
  </main>;
}