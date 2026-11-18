/**
 * Alles wat Foodloapp Intelligence nodig heeft voor voorstellen, in één keer en voor elke plek
 * hetzelfde (Vandaag, Week): ingrediënten, voorraad (alleen als je die bijhoudt; anders hooguit
 * "onlangs gekocht", zie voorraad-modus.ts), weekmenu van de
 * laatste 180 dagen, sterren en favorieten. Alleen bestaande tabellen; niets verlaat het toestel.
 * `aan = false` ("Slimme voorstellen" uit): er wordt niets opgevraagd.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { OudInHuis } from "@/lib/intelligentie/gebruik-eerst";
import { bruikbareVoorraad, useVoorraadBijhouden } from "@/lib/intelligentie/voorraad-modus";
import { lokaleDatum } from "@/lib/tijd";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import {
  herkenApparatuur,
  vereistenVoorRecept,
  type Apparaat,
  type Vereiste,
} from "@/lib/planner/apparatuur";
import { leesVereisten, VEREISTEN_TABEL } from "@/lib/planner/vereisten-db";

export type VoorstelBronnen = {
  ingredienten: Record<string, string[]>;
  /** Alleen als je je voorraad bijhoudt; anders leeg (onbekend = niet aanwezig). */
  voorraad: string[];
  oudInHuis: OudInHuis[];
  /** Voorraad niet bijgehouden: recent gekocht (hint, niet "in huis"). */
  onlangsGekocht: string[];
  plan: { recipe_id: string | null; plan_date: string }[];
  sterren: Record<string, number>;
  favorieten: string[];
  /** Apparatuur per recept (P1): herkend uit de tekst, of zelf gekozen in de editor. */
  vereist: Record<string, Vereiste[]>;
};

export function useVoorstelBronnen(receptIds: string[], aan = true) {
  const { user } = useAuth();
  const [bijgehouden] = useVoorraadBijhouden();
  const { beschikbaar: vereistenTabel } = useModuleBeschikbaar(VEREISTEN_TABEL);
  return useQuery({
    queryKey: ["voorstel-bronnen", user?.id, receptIds.join(","), bijgehouden, vereistenTabel],
    enabled: !!user && receptIds.length > 0 && aan,
    queryFn: async (): Promise<VoorstelBronnen> => {
      const van = lokaleDatum(new Date(Date.now() - 180 * 86400000));
      // Ingrediënten in blokken van 100: elk recept moet nagekeken kunnen worden (allergieën).
      const blokken: string[][] = [];
      for (let i = 0; i < receptIds.length; i += 100) blokken.push(receptIds.slice(i, i + 100));
      const [ingr, voorraad, plan, sterren, favorieten, teksten, zelf] = await Promise.all([
        Promise.all(
          blokken.map((ids) =>
            supabase.from("recipe_ingredients").select("recipe_id, name").in("recipe_id", ids),
          ),
        ),
        supabase
          .from("pantry_items")
          .select("naam, created_at, updated_at")
          .eq("user_id", user!.id),
        supabase
          .from("meal_plan")
          .select("recipe_id, plan_date")
          .eq("user_id", user!.id)
          .gte("plan_date", van)
          .limit(600),
        supabase.from("recipe_ratings").select("recipe_id, stars").eq("user_id", user!.id),
        supabase.from("favorites").select("recipe_id").eq("user_id", user!.id),
        // Apparatuur herkennen: titel, beschrijving, labels en stappen (alleen lezen).
        Promise.all(
          blokken.map((ids) =>
            supabase
              .from("recipes")
              .select("id, title, description, tags, instructions")
              .in("id", ids),
          ),
        ),
        vereistenTabel ? leesVereisten(receptIds) : Promise.resolve({}),
      ]);
      // Zonder ingrediënten kan de allergieregel niets nakijken: dan liever geen voorstellen.
      const fout = ingr.find((r) => r.error);
      if (fout?.error) throw fout.error;
      const per: Record<string, string[]> = {};
      for (const r of ingr) for (const i of r.data ?? []) (per[i.recipe_id] ??= []).push(i.name);
      const v = bruikbareVoorraad(voorraad.data ?? [], bijgehouden);
      const vereist: Record<string, Vereiste[]> = {};
      for (const r of teksten)
        for (const t of r.data ?? [])
          vereist[t.id] = vereistenVoorRecept(
            herkenApparatuur({
              title: t.title,
              description: t.description,
              tags: t.tags,
              stappen: t.instructions,
            }),
            (zelf as Record<string, Apparaat[]>)[t.id],
          );
      return {
        ingredienten: per,
        voorraad: v.inHuis,
        oudInHuis: v.oudInHuis,
        onlangsGekocht: v.onlangsGekocht,
        // Geschiedenis, sterren en favorieten zijn hulp: lukt het niet, dan zonder.
        plan: plan.data ?? [],
        sterren: Object.fromEntries((sterren.data ?? []).map((s) => [s.recipe_id, s.stars])),
        favorieten: (favorieten.data ?? []).map((f) => f.recipe_id as string),
        vereist,
      };
    },
  });
}
