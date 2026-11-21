/**
 * Alles wat de planner-engine nodig heeft (P1): je recepten en die van je gezin, hoeveelheden,
 * bronnen (voorraad, geschiedenis, sterren …) en de kandidaten in de vorm van de engine.
 * Gedeeld door "Stel mijn week samen", "Maak mijn week goedkoper" en de assistent (P4).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVoorstelBronnen } from "@/hooks/useVoorstelBronnen";
import { alleRijen } from "@/lib/pagineer";
import { moeilijkheidVan } from "@/lib/planner/apparatuur";
import type { PlanKandidaat } from "@/lib/planner/engine";
import type { Recipe } from "@/lib/types";
import { minutenVan } from "@/lib/weekmenu-voorstel";
import { zichtbareEigenaren } from "@/lib/zichtbare-eigenaren";

export type Regel = { name: string; quantity: number | null; unit: string };

/** Alle gegevens die de engine nodig heeft (recepten, hoeveelheden, bronnen, gezin). */
export function usePlannerGegevens() {
  const { user } = useAuth();
  const { data: recepten, isSuccess: receptenKlaar } = useQuery({
    queryKey: ["planner-recepten", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Tweede laag naast RLS (BUG-105): alleen jouw recepten en die van je gezin.
      const eigenaren = await zichtbareEigenaren();
      if (!eigenaren.length) return [] as Recipe[];
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .in("user_id", eigenaren)
        .is("deleted_at", null)
        .eq("is_concept", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Recipe[];
    },
  });
  const ids = useMemo(() => (recepten ?? []).map((r) => r.id), [recepten]);
  const { data: regels, isSuccess: regelsKlaar } = useQuery({
    queryKey: ["planner-regels", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const uit: Record<string, Regel[]> = {};
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await alleRijen(
          supabase
            .from("recipe_ingredients")
            .select("recipe_id, name, quantity, unit")
            .in("recipe_id", ids.slice(i, i + 100))
            .order("id"),
          20_000,
        );
        for (const r of data) (uit[r.recipe_id as string] ??= []).push(r as unknown as Regel);
      }
      return uit;
    },
  });
  const { data: bronnen, isSuccess: bronnenKlaar } = useVoorstelBronnen(ids, true);
  const klaar =
    receptenKlaar && (ids.length === 0 || (regelsKlaar && bronnenKlaar && !!regels && !!bronnen));
  return { recepten: recepten ?? [], regels: regels ?? {}, bronnen, klaar };
}

/** Kandidaten voor de engine (zelfde vorm voor samenstellen en goedkoper). */
export function useKandidaten(g: ReturnType<typeof usePlannerGegevens>): PlanKandidaat[] {
  return useMemo(
    () =>
      g.recepten.map((r) => ({
        id: r.id,
        title: r.title,
        minuten: minutenVan(r),
        category: r.category ?? null,
        tags: r.tags ?? [],
        ingredienten: g.bronnen?.ingredienten[r.id] ?? [],
        regels: g.regels[r.id] ?? [],
        servings: r.servings,
        vereist: g.bronnen?.vereist[r.id] ?? [],
        moeilijkheid: moeilijkheidVan({
          difficulty: r.difficulty,
          stappen: r.instructions,
          minuten: minutenVan(r),
        }),
      })),
    [g.recepten, g.regels, g.bronnen],
  );
}
