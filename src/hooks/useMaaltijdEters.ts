/**
 * Wie eet mee per geplande maaltijd, en het veiligheidsoordeel daarvoor — overal hetzelfde
 * (Vandaag, Week, recept, kookstand, boodschappen).
 *
 * - `useMaaltijdEters(planIds)`: bewaarde mee-eters (account via `maaltijd_eters`, of dit toestel
 *   vóór migratie 0010). Niets bewaard = het hele huishouden. `zet()` bewaart met "Ongedaan maken".
 * - `useEtersOordelen(vragen)`: één oordeel (hard / zacht / ok) per gerecht voor zijn mee-eters,
 *   via `maaltijdOordeel` (voorstel-eters.ts). Ingrediënten en het serveroordeel (voor leden
 *   waarvan je de gegevens niet mag lezen) worden in één keer opgehaald.
 *
 * Alles op het toestel; allergieën en dieet gaan nooit naar een AI.
 */
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEigenGezinId } from "@/hooks/useVoorstelEters";
import type { HuishoudenLid, LidVoeding } from "@/lib/gezin-veiligheid";
import { leesKennismaking } from "@/lib/kennismaking";
import {
  bewaarToestelEters,
  etersVoorMaaltijd,
  leesToestelEters,
  metEigenRegels,
} from "@/lib/maaltijd-eters";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { bewaarEters, haalEters, serverOordeel, useHuishouden } from "@/lib/voeding-db";
import { maaltijdOordeel, namenLijst, type MaaltijdOordeel } from "@/lib/voorstel-eters";

const GEEN_LEDEN: HuishoudenLid[] = [];

export function useMaaltijdEters(
  planIds: readonly string[],
  opties: { gezinId?: string | null | undefined } = {},
) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const eigen = useEigenGezinId();
  const gezinId = opties.gezinId === undefined ? eigen : opties.gezinId;
  const { data: huis } = useHuishouden(gezinId);
  const leden = huis?.beschikbaar ? huis.data.leden : GEEN_LEDEN;
  const voeding = useMemo<ReadonlyMap<string, LidVoeding>>(
    () => huis?.data.voeding ?? new Map(),
    [huis],
  );
  const { beschikbaar, laden } = useModuleBeschikbaar("maaltijd_eters");
  const ids = [...new Set(planIds)].sort();
  const sleutel = ["maaltijd-eters", ids.join(","), beschikbaar ? "account" : "toestel"];
  const { data: bewaard = GEEN } = useQuery({
    queryKey: sleutel,
    enabled: !!user && leden.length > 0 && ids.length > 0 && !laden,
    queryFn: async (): Promise<Record<string, string[]>> => {
      if (!beschikbaar) {
        const alles = leesToestelEters(user?.id);
        return Object.fromEntries(ids.filter((id) => alles[id]).map((id) => [id, alles[id]!]));
      }
      return Object.fromEntries(await haalEters(ids));
    },
  });

  async function opslaan(planId: string, lidIds: readonly string[] | null) {
    if (beschikbaar) await bewaarEters(planId, lidIds ? [...lidIds] : []);
    else bewaarToestelEters(user?.id, planId, lidIds);
  }

  function ververs() {
    void qc.invalidateQueries({ queryKey: ["maaltijd-eters"] });
  }

  /**
   * Bewaart wie meeëet, met een melding en "Ongedaan maken". Mislukt het, dan verandert er
   * niets en zegt Foodlo dat.
   */
  async function zet(planId: string, lidIds: readonly string[], melding?: string) {
    const vorige = bewaard[planId] ?? null;
    try {
      await opslaan(planId, lidIds);
    } catch {
      toast.error("Wie meeëet, kon niet bewaard worden. Probeer het opnieuw.");
      return false;
    }
    ververs();
    const namen = leden.filter((l) => lidIds.includes(l.id)).map((l) => l.naam);
    toast.success(melding ?? `Eet mee: ${namenLijst(namen)}`, {
      duration: 8000,
      action: {
        label: "Ongedaan maken",
        onClick: async () => {
          try {
            await opslaan(planId, vorige);
            toast("Teruggezet");
          } catch {
            toast.error("Terugzetten lukte niet. Kijk even na wie meeëet.");
          } finally {
            ververs();
          }
        },
      },
    });
    return true;
  }

  return {
    gezinId,
    leden,
    voeding,
    kijkerId: user?.id ?? null,
    /** Waar de keuze bewaard wordt: op je account, of (vóór migratie 0010) op dit toestel. */
    opslag: beschikbaar ? ("account" as const) : ("toestel" as const),
    /** Mee-eters van een maaltijd (standaard iedereen). */
    etersVan: (planId: string | null | undefined) =>
      etersVoorMaaltijd(leden, planId ? bewaard[planId] : null),
    /** Is er voor deze maaltijd zelf gekozen (anders: standaard)? */
    isGekozen: (planId: string) => !!bewaard[planId]?.length,
    zet,
    /** Bewaren zonder melding (bij het inplannen zelf; die melding heeft al "Ongedaan maken"). */
    bewaarStil: async (planId: string, lidIds: readonly string[]) => {
      await opslaan(planId, lidIds);
      ververs();
    },
  };
}

export type MaaltijdEters = ReturnType<typeof useMaaltijdEters>;

const GEEN: Record<string, string[]> = {};
const GEEN_SERVER: Record<string, Map<string, boolean>> = {};

export type OordeelVraag = {
  /** Eigen sleutel (bv. plan-id); het resultaat staat onder deze sleutel. */
  sleutel: string;
  recept: { id: string; title: string; tags?: string[] | null } | null | undefined;
  eters: readonly HuishoudenLid[];
  /** Al bekende ingrediënten; anders haalt de hook ze op. */
  ingredienten?: readonly string[] | undefined;
};

/**
 * Oordeel per vraag. Je eigen regels (kennismaking + account) tellen mee voor jouw lid in het
 * huishouden, tenzij `metMijzelf` false is (bv. waar je eigen allergiewaarschuwing al staat).
 */
export function useEtersOordelen(
  vragen: readonly OordeelVraag[],
  basis: {
    voeding: ReadonlyMap<string, LidVoeding>;
    kijkerId: string | null | undefined;
    metMijzelf?: boolean;
  },
): Record<string, MaaltijdOordeel> {
  const metMijzelf = basis.metMijzelf ?? true;
  const actief = vragen.filter((v) => v.recept && v.eters.length);
  const ontbrekend = [...new Set(actief.filter((v) => !v.ingredienten).map((v) => v.recept!.id))]
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .sort();
  const { data: namen = GEEN, isFetched } = useQuery({
    queryKey: ["eters-ingredienten", ontbrekend.join(",")],
    enabled: ontbrekend.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name")
        .in("recipe_id", ontbrekend);
      if (error) throw error;
      const uit: Record<string, string[]> = {};
      for (const r of data ?? []) (uit[r.recipe_id as string] ??= []).push(r.name as string);
      return uit;
    },
  });
  const kijker = basis.kijkerId;
  const nietLeesbaar = [
    ...new Set(
      actief.flatMap((v) =>
        v.eters.filter((l) => !basis.voeding.get(l.id) && l.user_id !== kijker).map((l) => l.id),
      ),
    ),
  ].sort();
  // Alleen bewaarde recepten (een nieuw recept heeft nog geen id op de server).
  const receptIds = [...new Set(actief.map((v) => v.recept!.id))]
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .sort()
    .slice(0, 12);
  const { data: server = GEEN_SERVER } = useQuery({
    queryKey: ["voorstel-eters-server", receptIds.join(","), nietLeesbaar.join(",")],
    enabled: nietLeesbaar.length > 0 && receptIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const uit: Record<string, Map<string, boolean>> = {};
      await Promise.all(
        receptIds.map(async (id) => {
          uit[id] = await serverOordeel(id, nietLeesbaar);
        }),
      );
      return uit;
    },
  });

  // Jouw eigen regels voor jouw lid (als je geen aparte lid-voeding hebt).
  const kennis = metMijzelf ? leesKennismaking(kijker) : null;
  const kennisSleutel = kennis ? `${kennis.allergieen.join(",")}|${kennis.dieet ?? ""}` : "";
  const ik = vragen.flatMap((v) => v.eters).find((l) => l.user_id === kijker);
  const voeding = useMemo(
    () => metEigenRegels(basis.voeding, ik, kijker, kennis),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basis.voeding, kijker, kennisSleutel, ik?.id],
  );

  const uit: Record<string, MaaltijdOordeel> = {};
  for (const v of actief) {
    const r = v.recept!;
    // Nog aan het laden: geen "niet te controleren" tonen op basis van een lege lijst.
    if (!v.ingredienten && !isFetched && !namen[r.id]) continue;
    uit[v.sleutel] = maaltijdOordeel(
      {
        id: r.id,
        title: r.title,
        tags: r.tags ?? [],
        ingredienten: [...(v.ingredienten ?? namen[r.id] ?? [])],
      },
      { eters: v.eters, voeding, kijkerId: kijker, server },
    );
  }
  return uit;
}
