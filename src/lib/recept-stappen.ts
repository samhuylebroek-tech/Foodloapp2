/**
 * Recept invoeren in stappen (voor beginners): 1 Naam en foto, 2 Ingrediënten, 3 Bereiding,
 * 4 Klopt alles?. Alle velden blijven bestaan tijdens het wisselen, dus heen en weer gaan
 * verliest niets. De keuze voor de stappen wordt op dit toestel onthouden.
 */
export const RECEPT_STAPPEN = [
  { nr: 1, titel: "Naam en foto" },
  { nr: 2, titel: "Ingrediënten" },
  { nr: 3, titel: "Bereiding" },
  { nr: 4, titel: "Klopt alles?" },
] as const;

export type ReceptStap = (typeof RECEPT_STAPPEN)[number]["nr"];

export const AANTAL_STAPPEN = RECEPT_STAPPEN.length;

export function volgendeStap(s: ReceptStap): ReceptStap {
  return Math.min(AANTAL_STAPPEN, s + 1) as ReceptStap;
}

export function vorigeStap(s: ReceptStap): ReceptStap {
  return Math.max(1, s - 1) as ReceptStap;
}

export function stapTitel(s: ReceptStap): string {
  return RECEPT_STAPPEN[s - 1]!.titel;
}

/** "Stap 2 van 4: Ingrediënten" */
export function voortgangTekst(s: ReceptStap): string {
  return `Stap ${s} van ${AANTAL_STAPPEN}: ${stapTitel(s)}`;
}

/** Is dit blok zichtbaar? Zonder stappenmodus is alles zichtbaar. */
export function toonInStap(stapsgewijs: boolean, huidig: ReceptStap, blok: ReceptStap): boolean {
  return !stapsgewijs || huidig === blok;
}

/** Wat ontbreekt nog om te bewaren (stap 4)? Alleen de naam is verplicht. */
export function ontbreektVoorBewaren(v: { titel: string }): string | null {
  return v.titel.trim() ? null : "Geef je gerecht eerst een naam (stap 1).";
}

const SLEUTEL = "foodlo:recept-stappen";

export function leesStappenKeuze(): boolean {
  try {
    return window.localStorage.getItem(SLEUTEL) === "aan";
  } catch {
    return false;
  }
}

export function bewaarStappenKeuze(aan: boolean) {
  try {
    window.localStorage.setItem(SLEUTEL, aan ? "aan" : "uit");
  } catch {
    /* privévenster: alleen voor nu */
  }
}
