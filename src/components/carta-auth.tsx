import { createContext, useContext, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const CartaAuthContext = createContext<{ user: User | null; ready: boolean }>({ user: null, ready: false });
export const useCartaAuth = () => useContext(CartaAuthContext);

export function SignOutButton() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      await router.navigate({ to: "/login", replace: true });
    } catch {
      setError("Uscita non riuscita. Riprova.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="flex flex-col items-end gap-2"><Button variant="ghost" onClick={signOut} disabled={busy}><LogOut />{busy ? "Uscita…" : "Esci"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}

export function CartaPage({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex max-w-4xl items-center justify-between border-b px-6 py-5">
      <Link to="/" className="font-serif text-2xl font-semibold">Carta</Link><SignOutButton />
    </header>
    <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
  </div>;
}