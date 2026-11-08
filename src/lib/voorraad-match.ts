/**
 * "Wat kan ik koken met wat ik heb?" — zonder AI, zonder kosten.
 * Rangschikt recepten op hoeveel ingrediënten al in de voorraadkast staan.
 */
import { canoniekeNaam } from "@/lib/product-herkenning";

/** Dingen die (bijna) iedereen in huis heeft; tellen nooit als "ontbreekt". */
const BASIS = ["zout", "peper", "water", "kraantjeswater"];

export type ReceptMetIngredienten = {
  id: string;
  title: string;
  ingredienten: { name: string }[];
};

export type Match = {
  id: string;
  title: string;
  /** Aantal ingrediënten dat meetelt (zonder basis zoals zout en water). */
  totaal: number;
  aanwezig: string[];
  ontbreekt: string[];
  /** 0..1 */
  score: number;
};

function woorden(naam: string): string[] {
  return canoniekeNaam(naam).split(" ").filter(Boolean);
}

/** Zelfde product, of het ene is een preciezere vorm van het andere ("rundvlees" ↔ "rundvlees stoofvlees"). */
export function zitInVoorraad(ingredient: string, voorraad: string[]): boolean {
  const ing = woorden(ingredient);
  if (!ing.length) return false;
  return voorraad.some((v) => {
    const vw = woorden(v);
    if (!vw.length) return false;
    return vw.every((w) => ing.includes(w)) || ing.every((w) => vw.includes(w));
  });
}

export function isBasis(ingredient: string): boolean {
  const ing = woorden(ingredient);
  return ing.length > 0 && ing.every((w) => BASIS.includes(w) || /^snuf/.test(w));
}

/**
 * Geeft recepten terug waarvoor je al minstens `minAanwezig` ingrediënten hebt,
 * gesorteerd op het minste aantal ontbrekende, dan op het hoogste aandeel.
 */
export function watKanIkKoken(
  recepten: ReceptMetIngredienten[],
  voorraadNamen: string[],
  { minAanwezig = 1, max = 6 }: { minAanwezig?: number; max?: number } = {},
): Match[] {
  if (!voorraadNamen.length) return [];
  const uit: Match[] = [];
  for (const r of recepten) {
    const telt = r.ingredienten.map((i) => i.name.trim()).filter((n) => n && !isBasis(n));
    if (!telt.length) continue;
    const aanwezig = telt.filter((n) => zitInVoorraad(n, voorraadNamen));
    if (aanwezig.length < minAanwezig) continue;
    const ontbreekt = telt.filter((n) => !aanwezig.includes(n));
    uit.push({
      id: r.id,
      title: r.title,
      totaal: telt.length,
      aanwezig,
      ontbreekt,
      score: aanwezig.length / telt.length,
    });
  }
  return uit
    .sort(
      (a, b) =>
        a.ontbreekt.length - b.ontbreekt.length ||
        b.score - a.score ||
        a.title.localeCompare(b.title),
    )
    .slice(0, max);
}
