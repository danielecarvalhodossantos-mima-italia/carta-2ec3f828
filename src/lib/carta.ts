import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export function slugFromName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const validSlug = (slug: string) => /^[a-z0-9-]{3,40}$/.test(slug);

export const membershipsOptions = (userId: string) => queryOptions({
  queryKey: ["restaurant-members", userId],
  queryFn: async () => {
    const rows = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from("restaurant_members")
        .select("restaurant_id, role, restaurants(id, name, slug)")
        .eq("user_id", userId).order("restaurant_id").range(offset, offset + pageSize - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < pageSize) return rows;
    }
  },
});

export const restaurantOptions = (userId: string, restaurantId: string) => queryOptions({
  queryKey: ["restaurant", userId, restaurantId],
  queryFn: async () => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId)) return null;
    const { data, error } = await supabase.from("restaurant_members")
      .select("role, restaurants(id, name)").eq("user_id", userId)
      .eq("restaurant_id", restaurantId).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export async function createRestaurant(args: Database["public"]["Functions"]["create_restaurant"]["Args"]) {
  return supabase.rpc("create_restaurant", args);
}

export function authErrorMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "Email o password non corrette";
  if (/email not confirmed/i.test(message)) return "Conferma la tua email prima di accedere";
  if (/already registered/i.test(message)) return "Questa email è già registrata";
  if (/rate limit|too many requests/i.test(message)) return "Troppi tentativi. Riprova tra qualche minuto";
  if (/password/i.test(message)) return "La password non soddisfa i requisiti: " + message;
  return "Operazione non riuscita: " + message;
}