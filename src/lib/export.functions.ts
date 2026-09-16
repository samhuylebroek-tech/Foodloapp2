import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Alles wat de gebruiker zelf van Foodlo mag meenemen, in één bestand. */
export const exporteerMijnGegevens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profiel, recepten, ingredienten, weekmenu, lijsten, items, favorieten, voorraad, kaarten] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, handle, taal, thema, momenten, onboarding_klaar, created_at")
          .eq("id", userId)
          .maybeSingle(),

        supabase.from("recipes").select("*").eq("user_id", userId),
        supabase.from("recipe_ingredients").select("*"),
        supabase.from("meal_plan").select("*").eq("user_id", userId),
        supabase.from("shopping_lists").select("*").eq("user_id", userId),
        supabase.from("shopping_items").select("*").eq("user_id", userId),
        supabase.from("favorites").select("*").eq("user_id", userId),
        supabase.from("pantry_items").select("*").eq("user_id", userId),
        supabase.from("loyalty_cards").select("id, winkel_naam, kaartnaam, formaat, favoriet, created_at").eq("user_id", userId),
      ]);

    const receptIds = new Set((recepten.data ?? []).map((r) => r.id));

    return {
      gemaakt_op: new Date().toISOString(),
      profiel: profiel.data ?? null,
      recepten: recepten.data ?? [],
      ingredienten: (ingredienten.data ?? []).filter((i) => receptIds.has(i.recipe_id)),
      weekmenu: weekmenu.data ?? [],
      boodschappenlijsten: lijsten.data ?? [],
      boodschappen: items.data ?? [],
      favorieten: favorieten.data ?? [],
      voorraadkast: voorraad.data ?? [],
      // Kaartnummers blijven bewust buiten de export.
      klantenkaarten: kaarten.data ?? [],
    };
  });
