/**
 * P4 — Suggestie-instellingen van de aangemelde gebruiker: op het account
 * (`suggestie_instellingen`, voorstel 0016) of, zolang die tabel niet bestaat, op dit toestel.
 * Account zonder rij: wat op het toestel stond, telt (niets gaat verloren).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import {
  bewaarToestelSuggesties,
  leesSuggesties,
  leesToestelSuggesties,
  verberg as verbergIn,
  zetSoort,
  STANDAARD_SUGGESTIES,
  type SuggestieInstellingen,
  type SuggestieSoort,
} from "@/lib/suggesties";

export const SUGGESTIES_TABEL = "suggestie_instellingen";

export function useSuggesties() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { beschikbaar, laden: modLaden } = useModuleBeschikbaar(SUGGESTIES_TABEL);
  const sleutel = ["suggesties", user?.id, beschikbaar];
  const { data, isLoading } = useQuery({
    queryKey: sleutel,
    enabled: !!user && !modLaden,
    staleTime: 60_000,
    queryFn: async (): Promise<{ inst: SuggestieInstellingen; opslag: "account" | "toestel" }> => {
      const toestel = leesToestelSuggesties(user!.id);
      if (!beschikbaar) return { inst: toestel, opslag: "toestel" };
      const { data, error } = await db
        .from(SUGGESTIES_TABEL)
        .select("uit, verborgen")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return { inst: toestel, opslag: "toestel" };
      return { inst: data ? leesSuggesties(data) : toestel, opslag: "account" };
    },
  });
  const inst = data?.inst ?? STANDAARD_SUGGESTIES;
  const opslag = data?.opslag ?? (beschikbaar ? "account" : "toestel");

  async function bewaar(nieuw: SuggestieInstellingen) {
    if (!user) return;
    const vorige = data;
    qc.setQueryData(sleutel, { inst: nieuw, opslag });
    try {
      if (beschikbaar) {
        const { error } = await db.from(SUGGESTIES_TABEL).upsert(
          {
            user_id: user.id,
            uit: nieuw.uit,
            verborgen: nieuw.verborgen,
            bijgewerkt_op: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
      } else bewaarToestelSuggesties(user.id, nieuw);
    } catch (fout) {
      qc.setQueryData(sleutel, vorige);
      throw fout;
    }
  }

  return {
    inst,
    opslag,
    laden: !!user && (modLaden || isLoading),
    zet: (soort: SuggestieSoort, aan: boolean) => bewaar(zetSoort(inst, soort, aan)),
    verberg: (kaart: string) => bewaar(verbergIn(inst, kaart)),
    toonVerborgen: () => bewaar({ ...inst, verborgen: [] }),
    herstel: (vorig: SuggestieInstellingen) => bewaar(vorig),
  };
}
