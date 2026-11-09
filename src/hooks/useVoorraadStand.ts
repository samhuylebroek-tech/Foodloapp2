/**
 * Keuken als één geheel: weten recepten wat er in huis is?
 * Eén gedeelde bron voor receptkaarten, receptdetail en de Keuken-wissel.
 * Valt onder de queryKey ["voorraad", …], dus wordt vernieuwd zodra de voorraad wijzigt
 * (gekocht, gekookt, ±).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isBasis, zitInVoorraad } from "@/lib/voorraad-match";

export function useVoorraadNamen() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["voorraad", user?.id, "namen"],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("naam")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((v) => v.naam as string);
    },
  });
}

/** Per recept: hoeveel ingrediënten (zonder zout, water…) ontbreken er nog? */
export function useVoorraadStand(receptIds: string[]) {
  const { user } = useAuth();
  const { data: voorraad = [] } = useVoorraadNamen();
  const ids = receptIds.slice(0, 100);
  const { data: ontbreekt } = useQuery({
    queryKey: ["voorraad", user?.id, "stand", ids.join(","), voorraad.join("|")],
    enabled: !!user && ids.length > 0 && voorraad.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name")
        .in("recipe_id", ids);
      if (error) throw error;
      const per = new Map<string, number>();
      for (const id of ids) per.set(id, 0);
      for (const i of data ?? []) {
        const naam = String(i.name).trim();
        if (!naam || isBasis(naam)) continue;
        if (!zitInVoorraad(naam, voorraad)) per.set(i.recipe_id, (per.get(i.recipe_id) ?? 0) + 1);
      }
      return per;
    },
  });
  return { voorraad, ontbreekt };
}
