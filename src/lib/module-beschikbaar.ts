/**
 * Nieuwe modules (makers, verzamelingen, community, …) gebruiken tabellen die in productie pas
 * bestaan na een (nog niet uitgevoerde) migratie. Deze hulp zorgt dat de app dan een rustige
 * "binnenkort"-staat toont in plaats van een fout.
 *
 * - `db`: ongetypeerde client voor tabellen die (nog) niet in de gegenereerde types staan.
 * - `isOntbrekendeTabel(fout)`: herkent "tabel bestaat niet" van Postgres en PostgREST.
 * - `useModuleBeschikbaar(tabel)`: één lichte `select("id").limit(1)` per tabel (gecachet).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as unknown as SupabaseClient<any>;

export { isOntbrekendeTabel } from "@/lib/ontbrekende-tabel";
import { isOntbrekendeTabel } from "@/lib/ontbrekende-tabel";

/** Controleert of een tabel bestaat. Andere fouten (netwerk) tellen niet als "ontbreekt". */
export async function controleerTabel(tabel: string): Promise<boolean> {
  const { error } = await db.from(tabel).select("id").limit(1);
  if (!error) return true;
  if (isOntbrekendeTabel(error)) return false;
  throw error;
}

/**
 * `{ beschikbaar, laden }` voor een module. Bij een netwerkfout geldt de module als beschikbaar:
 * het scherm toont dan zijn eigen foutstaat (met opnieuw proberen), geen "binnenkort".
 */
export function useModuleBeschikbaar(tabel: string): { beschikbaar: boolean; laden: boolean } {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["module-beschikbaar", tabel],
    queryFn: () => controleerTabel(tabel),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  if (isError) return { beschikbaar: true, laden: false };
  return { beschikbaar: data === true, laden: isLoading };
}
