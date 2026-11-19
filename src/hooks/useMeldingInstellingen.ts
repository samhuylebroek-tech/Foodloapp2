/**
 * P5 — Welke meldingen in de app je wilt (per soort aan/uit): op het account
 * (`app_melding_instellingen`, voorstel 0017) of, zolang die tabel niet bestaat, op dit toestel.
 * Zelfde opbouw als useSuggesties (P4); beide staan op Instellingen › Suggesties en meldingen.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { MELDING_INSTELLINGEN_TABEL } from "@/lib/samenwerking/db";
import {
  bewaarToestelMeldingen,
  leesMeldingInstellingen,
  leesToestelMeldingen,
  STANDAARD_MELDINGEN,
  zetMeldingSoort,
  type MeldingInstellingen,
  type MeldingSoort,
} from "@/lib/samenwerking/meldingen";

export function useMeldingInstellingen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { beschikbaar, laden: modLaden } = useModuleBeschikbaar(MELDING_INSTELLINGEN_TABEL);
  const sleutel = ["melding-instellingen", user?.id, beschikbaar];
  const { data, isLoading } = useQuery({
    queryKey: sleutel,
    enabled: !!user && !modLaden,
    staleTime: 60_000,
    queryFn: async (): Promise<{ inst: MeldingInstellingen; opslag: "account" | "toestel" }> => {
      const toestel = leesToestelMeldingen(user!.id);
      if (!beschikbaar) return { inst: toestel, opslag: "toestel" };
      const { data, error } = await db
        .from(MELDING_INSTELLINGEN_TABEL)
        .select("uit")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return { inst: toestel, opslag: "toestel" };
      return { inst: data ? leesMeldingInstellingen(data) : toestel, opslag: "account" };
    },
  });
  const inst = data?.inst ?? STANDAARD_MELDINGEN;
  const opslag = data?.opslag ?? (beschikbaar ? "account" : "toestel");

  async function zet(soort: MeldingSoort, aan: boolean) {
    if (!user) return;
    const vorige = data;
    const nieuw = zetMeldingSoort(inst, soort, aan);
    qc.setQueryData(sleutel, { inst: nieuw, opslag });
    try {
      if (beschikbaar) {
        const { error } = await db
          .from(MELDING_INSTELLINGEN_TABEL)
          .upsert(
            { user_id: user.id, uit: nieuw.uit, bijgewerkt_op: new Date().toISOString() },
            { onConflict: "user_id" },
          );
        if (error) throw error;
      } else bewaarToestelMeldingen(user.id, nieuw);
    } catch (fout) {
      qc.setQueryData(sleutel, vorige);
      throw fout;
    }
  }

  return { inst, opslag, laden: !!user && (modLaden || isLoading), zet };
}
