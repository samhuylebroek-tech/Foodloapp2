import { supabase } from "@/integrations/supabase/client";

export type ShoppingList = { id: string; name: string; created_at: string };

/** Geeft het eerste lijstje van de gebruiker terug, of maakt er één aan. */
export async function zorgVoorLijst(userId: string): Promise<string> {
  const { data } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id;

  const { data: nieuw, error } = await supabase
    .from("shopping_lists")
    .insert({ user_id: userId, name: "Boodschappen" })
    .select("id")
    .single();
  if (error) throw error;
  return nieuw.id;
}
