/**
 * Foodloapp Intelligence I-1, usecase 9: "In de winkel, citroen vergeten bij de vis van morgen."
 * Uit Slim aanvullen (`berekenAanvulling`): wat je voor vandaag of morgen nog moet kopen en dat
 * niet in huis is en niet op je lijst staat. Puur; geen databank, geen klok van zichzelf.
 */
import type { Regel } from "@/lib/kringloop";

export type VoorMorgen = {
  /** Sleutels voor `vulAan` (zet precies deze regels op de lijst). */
  sleutels: string[];
  namen: string[];
  /** Voor welke gerechten (uniek, in volgorde van de dag). */
  gerechten: string[];
  /** "Voor morgen", "Voor vandaag" of "Voor vandaag en morgen". */
  kop: string;
};

function plusEenDag(datum: string): string {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nogNodigVoorMorgen(kopen: Regel[], vandaag: string): VoorMorgen | null {
  const morgen = plusEenDag(vandaag);
  const telt = (dag: string) => dag === vandaag || dag === morgen;
  const regels = kopen.filter((r) => r.voor.some((v) => telt(v.dag)));
  if (!regels.length) return null;
  const voor = regels
    .flatMap((r) => r.voor.filter((v) => telt(v.dag)))
    .sort((a, b) => a.dag.localeCompare(b.dag));
  const vandaagOok = voor.some((v) => v.dag === vandaag);
  const morgenOok = voor.some((v) => v.dag === morgen);
  return {
    sleutels: regels.map((r) => r.sleutel),
    namen: regels.map((r) => r.naam),
    gerechten: [...new Set(voor.map((v) => v.titel))],
    kop:
      vandaagOok && morgenOok
        ? "Voor vandaag en morgen nog nodig"
        : vandaagOok
          ? "Voor vandaag nog nodig"
          : "Voor morgen nog nodig",
  };
}
