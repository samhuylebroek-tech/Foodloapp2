/**
 * Lokaal en seizoen (MODULE_DESIGNS §8): welke ideeën gebruiken groenten of fruit die nu in België
 * van eigen bodem komen? Bouwt op de vaste seizoenslijst (`seizoen-producten.ts`, pure data, geen
 * externe dienst). Titel, labels én ingrediënten tellen mee.
 */
import { inSeizoen, seizoensProductenIn } from "@/lib/intelligentie/seizoen-producten";

export const MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

/** Seizoensproducten in dit gerecht (lijstvolgorde, uniek). */
export function seizoenIn(
  r: { title: string; tags?: readonly string[] | null },
  ingredienten: readonly string[],
  maand0: number,
): string[] {
  return seizoensProductenIn([r.title, ...(r.tags ?? []), ...ingredienten], maand0);
}

/** Alleen de gerechten met minstens één seizoensproduct van bij ons. */
export function filterSeizoen<
  T extends { id: string; title: string; tags?: readonly string[] | null },
>(
  recepten: readonly T[],
  ingredientenPerId: ReadonlyMap<string, readonly string[]> | undefined,
  maand0: number,
): T[] {
  return recepten.filter(
    (r) => seizoenIn(r, ingredientenPerId?.get(r.id) ?? [], maand0).length > 0,
  );
}

/** "In november van bij ons: witloof, pompoen, spruitjes, prei en meer." */
export function seizoenUitleg(maand0: number, max = 5): string {
  const lijst = inSeizoen(maand0);
  const kort = lijst.slice(0, max);
  const rest = lijst.length > max ? " en meer" : "";
  return `In ${MAANDEN[maand0]} van bij ons: ${kort.join(", ")}${rest}.`;
}
