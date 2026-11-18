/**
 * Planprofiel van de aangemelde gebruiker (P1): op het account (`planprofiel`, voorstel 0013)
 * of, zolang die tabel niet bestaat, op dit toestel.
 *
 * - Account zonder rij: wat al op het toestel stond, telt (niets gaat verloren).
 * - Het weekbudget van vroeger (alleen op dit toestel) blijft gelden tot je het opnieuw bewaart.
 * - Voorraadniveau en "voorraad bijhouden" (voorraad-modus.ts) blijven gelijk: volledig = je
 *   houdt je voorraad bij; geen of basis = niet.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BUDGET_GEWIJZIGD, leesWeekbudget } from "@/lib/budget";
import { leesKennismaking } from "@/lib/kennismaking";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import {
  apparatuurVan,
  ervaringVan,
  type Kookervaring,
  type Voorraadniveau,
} from "@/lib/planner/profiel";
import {
  bewaarToestelProfiel,
  leesProfiel,
  leesToestelProfiel,
  naarRij,
  PROFIEL_GEWIJZIGD,
  type PlanProfiel,
} from "@/lib/planner/profiel";
import type { Apparaat } from "@/lib/planner/apparatuur";
import { voorraadModus, zetVoorraadBijhouden } from "@/lib/intelligentie/voorraad-modus";

export const PLANPROFIEL_TABEL = "planprofiel";

export type PlanProfielStand = {
  profiel: PlanProfiel;
  /** Wat de engine gebruikt (met aannames ingevuld). */
  apparatuur: Apparaat[];
  /** true zolang je zelf geen apparatuur koos (dan "oven + kookplaat aangenomen"). */
  apparatuurAangenomen: boolean;
  kookervaring: Kookervaring | null;
  voorraadniveau: Voorraadniveau | null;
  weekbudget: number | null;
  /** "account" na migratie 0013, anders "toestel". */
  opslag: "account" | "toestel";
  laden: boolean;
  bewaar: (deel: Partial<PlanProfiel>) => Promise<void>;
};

export function usePlanProfiel(): PlanProfielStand {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { beschikbaar, laden: modLaden } = useModuleBeschikbaar(PLANPROFIEL_TABEL);
  const sleutel = ["planprofiel", user?.id, beschikbaar];
  const { data, isLoading } = useQuery({
    queryKey: sleutel,
    enabled: !!user && !modLaden,
    staleTime: 60_000,
    queryFn: async (): Promise<{ profiel: PlanProfiel; opslag: "account" | "toestel" }> => {
      const toestel = leesToestelProfiel(user!.id);
      if (!beschikbaar) return { profiel: toestel, opslag: "toestel" };
      const { data, error } = await db
        .from(PLANPROFIEL_TABEL)
        .select("apparatuur, kookervaring, voorraadniveau, basisvoorraad, weekbudget")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error || !data) return { profiel: toestel, opslag: error ? "toestel" : "account" };
      return { profiel: leesProfiel(data), opslag: "account" };
    },
  });

  // Toestelwijziging in een ander tabblad of vanuit een ander scherm: opnieuw lezen.
  useEffect(() => {
    const opnieuw = () => void qc.invalidateQueries({ queryKey: ["planprofiel"] });
    window.addEventListener(PROFIEL_GEWIJZIGD, opnieuw);
    window.addEventListener(BUDGET_GEWIJZIGD, opnieuw);
    return () => {
      window.removeEventListener(PROFIEL_GEWIJZIGD, opnieuw);
      window.removeEventListener(BUDGET_GEWIJZIGD, opnieuw);
    };
  }, [qc]);

  const profiel = useMemo(
    () => data?.profiel ?? leesToestelProfiel(user?.id),
    [data?.profiel, user?.id],
  );
  const apparatuur = useMemo(() => apparatuurVan(profiel), [profiel]);
  const opslag = data?.opslag ?? "toestel";
  const kennis = leesKennismaking(user?.id);
  const modus = voorraadModus(user?.id);

  async function bewaar(deel: Partial<PlanProfiel>) {
    if (!user) return;
    const nieuw: PlanProfiel = { ...profiel, ...deel };
    if (deel.voorraadniveau !== undefined && deel.voorraadniveau !== null)
      zetVoorraadBijhouden(user.id, deel.voorraadniveau === "volledig");
    if (beschikbaar) {
      const { error } = await db
        .from(PLANPROFIEL_TABEL)
        .upsert(
          { user_id: user.id, ...naarRij(nieuw), bijgewerkt_op: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    } else bewaarToestelProfiel(user.id, nieuw);
    qc.setQueryData(sleutel, { profiel: nieuw, opslag: beschikbaar ? "account" : "toestel" });
    await qc.invalidateQueries({ queryKey: ["planprofiel"] });
  }

  return {
    profiel,
    apparatuur,
    apparatuurAangenomen: profiel.apparatuur === null,
    kookervaring: ervaringVan(profiel, kennis.ervaring),
    voorraadniveau:
      profiel.voorraadniveau ??
      (modus === "bijhouden" ? "volledig" : modus === "niet" ? "geen" : null),
    // Zelfde regel als useWeekbudget: account wint, anders het toestel.
    weekbudget:
      opslag === "account"
        ? (profiel.weekbudget ?? leesWeekbudget(user?.id))
        : leesWeekbudget(user?.id),
    opslag,
    laden: !!user && (modLaden || isLoading),
    bewaar,
  };
}
