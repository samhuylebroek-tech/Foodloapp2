import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus, Plus, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  oordeelVoorEters,
  personenVoor,
  waarschuwingTekst,
  type EterOordeel,
  type HuishoudenLid,
} from "@/lib/gezin-veiligheid";
import { heeftVoeding } from "@/lib/persoonlijke-voeding";
import { serverOordeel, useHuishouden } from "@/lib/voeding-db";
import { etiketVoorEters } from "@/lib/voorstel-eters";

/**
 * "Wie eet mee?" bij het inplannen. Zonder gezin (of vóór migratie 0010) is er geen keuze en
 * blijft de gewone personenteller werken.
 */
export function useMeeEters(gezinId: string | null | undefined) {
  const { data } = useHuishouden(gezinId);
  const leden = useMemo(() => (data?.beschikbaar ? data.data.leden : []), [data]);
  const [gekozen, setGekozen] = useState<string[] | null>(null);
  const [gasten, setGasten] = useState(0);
  useEffect(() => {
    if (gekozen === null && leden.length) setGekozen(leden.map((l) => l.id));
  }, [leden, gekozen]);
  const eters = leden.filter((l) => (gekozen ?? []).includes(l.id));
  return {
    actief: leden.length > 0,
    leden,
    eters,
    gekozen: gekozen ?? [],
    voeding: data?.data.voeding ?? new Map(),
    gasten,
    setGasten,
    wissel: (id: string) =>
      setGekozen((g) => {
        const nu = g ?? [];
        return nu.includes(id) ? nu.filter((x) => x !== id) : [...nu, id];
      }),
    personen: personenVoor(eters.length, gasten),
  };
}

export type MeeEters = ReturnType<typeof useMeeEters>;

export function WieEetMee({ mee }: { mee: MeeEters }) {
  return (
    <div className="border-b border-border px-4 py-3">
      <p id="wie-eet-mee" className="text-base font-medium">
        Wie eet mee?{" "}
        <span className="font-normal text-muted-foreground">
          {mee.personen === 1 ? "1 persoon" : `${mee.personen} personen`}
        </span>
      </p>
      <div role="group" aria-labelledby="wie-eet-mee" className="mt-2 flex flex-wrap gap-2">
        {mee.leden.map((l) => {
          const aan = mee.gekozen.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={aan}
              onClick={() => mee.wissel(l.id)}
              className={
                aan
                  ? "inline-flex min-h-12 items-center gap-1.5 rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground"
                  : "inline-flex min-h-12 items-center rounded-full bg-card px-4 text-base font-semibold ring-1 ring-border hover:bg-muted"
              }
            >
              {aan ? <Check className="size-4" aria-hidden /> : null}
              {l.naam}
            </button>
          );
        })}
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary pl-3">
          <span className="text-base font-semibold">
            {mee.gasten ? `Gast +${mee.gasten}` : "Gast"}
          </span>
          <Button
            variant="ghost"
            onClick={() => mee.setGasten(Math.max(0, mee.gasten - 1))}
            disabled={mee.gasten === 0}
            aria-label="Eén gast minder"
            className="size-12 p-0"
          >
            <Minus className="size-5" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => mee.setGasten(Math.min(20, mee.gasten + 1))}
            aria-label="Eén gast meer"
            className="size-12 p-0"
          >
            <Plus className="size-5" />
          </Button>
        </span>
      </div>
    </div>
  );
}

/** Ingrediëntnamen per recept, alleen opgehaald als een mee-eter voorkeuren heeft. */
export function useVeiligheidVoorEters(
  mee: MeeEters,
  recepten: { id: string; title: string; tags?: string[] | null }[],
  kijkerId: string | null | undefined,
) {
  const nodig = mee.eters.length > 0;
  const ids = recepten.slice(0, 60).map((r) => r.id);
  const leesbaar = mee.eters.filter((l) => heeftVoeding(mee.voeding.get(l.id)));
  const nietLeesbaar = mee.eters.filter((l) => !mee.voeding.get(l.id));
  const { data: namen = {} } = useQuery({
    queryKey: ["eters-ingredienten", ids.join(",")],
    enabled: nodig && leesbaar.length > 0 && ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name")
        .in("recipe_id", ids);
      if (error) throw error;
      const uit: Record<string, string[]> = {};
      for (const r of data ?? []) {
        const id = r.recipe_id as string;
        (uit[id] ??= []).push(r.name as string);
      }
      return uit;
    },
  });
  // Leden waarvan je de gegevens niet mag lezen: alleen waar/onwaar van de server (0010).
  const { data: server = {} } = useQuery({
    queryKey: ["eters-server", ids.slice(0, 30).join(","), nietLeesbaar.map((l) => l.id).join(",")],
    enabled: nodig && nietLeesbaar.length > 0 && ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const uit: Record<string, Map<string, boolean>> = {};
      await Promise.all(
        ids.slice(0, 30).map(async (id) => {
          uit[id] = await serverOordeel(
            id,
            nietLeesbaar.map((l) => l.id),
          );
        }),
      );
      return uit;
    },
  });
  return (recept: { id: string; title: string; tags?: string[] | null }): string | null => {
    if (!nodig) return null;
    const oordelen = oordeelVoorEters(
      { title: recept.title, tags: recept.tags ?? [], ingredienten: namen[recept.id] ?? [] },
      mee.eters,
      mee.voeding,
      kijkerId,
      server[recept.id],
    );
    return tekstMetReden(oordelen);
  };
}

/** "Niet veilig voor Lotte" — met reden alleen als die gedeeld is ("Gust: past niet bij …"). */
export function tekstMetReden(oordelen: EterOordeel[]): string | null {
  const t = waarschuwingTekst(oordelen);
  // Geen harde botsing: dan eventueel de zachte ("Liever niet voor Jan (Jan: liever geen kokos)").
  if (!t) return etiketVoorEters(oordelen);
  const redenen = oordelen
    .filter((o) => o.veilig === false && o.reden)
    .map((o) => `${o.naam}: ${o.reden}`);
  return redenen.length ? `${t} (${redenen.join("; ")})` : t;
}

export function EtersWaarschuwing({ tekst }: { tekst: string | null }) {
  if (!tekst) return null;
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-xl bg-honing-zacht px-3 py-2 text-base font-semibold text-honing-foreground"
    >
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span className="min-w-0">{tekst}</span>
    </p>
  );
}

export function oordeelVoorGerecht(
  mee: MeeEters,
  g: { title: string; ingredienten: string[] },
  kijkerId: string | null | undefined,
): string | null {
  if (!mee.eters.length) return null;
  return tekstMetReden(oordeelVoorEters(g, mee.eters, mee.voeding, kijkerId));
}

export type { HuishoudenLid };
