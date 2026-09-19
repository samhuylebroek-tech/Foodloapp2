/**
 * Zoeken in je eigen recepten: hoofdletters, accenten en leestekens negeren,
 * per woord zoeken en de beste treffers (titel) bovenaan zetten.
 */

export function normaliseerTekst(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function zoekWoorden(term: string): string[] {
  return normaliseerTekst(term).split(" ").filter(Boolean);
}

export type ZoekVelden = {
  titel: string;
  beschrijving?: string;
  labels?: string[];
  soort?: string;
  ingredienten?: string[];
};

/**
 * Geeft een score: 0 = geen treffer. Hoe hoger, hoe beter de match.
 * Elk woord uit de zoekterm moet ergens voorkomen.
 */
export function zoekScore(velden: ZoekVelden, woorden: string[]): number {
  if (!woorden.length) return 1;

  const titel = normaliseerTekst(velden.titel);
  const beschrijving = normaliseerTekst(velden.beschrijving ?? "");
  const labels = normaliseerTekst((velden.labels ?? []).join(" "));
  const soort = normaliseerTekst(velden.soort ?? "");
  const ingredienten = normaliseerTekst((velden.ingredienten ?? []).join(" "));

  let totaal = 0;
  for (const woord of woorden) {
    let punten = 0;
    if (titel.includes(woord)) punten = 10;
    else if (labels.includes(woord)) punten = 6;
    else if (soort.includes(woord)) punten = 5;
    else if (ingredienten.includes(woord)) punten = 4;
    else if (beschrijving.includes(woord)) punten = 2;
    if (punten === 0) return 0;
    totaal += punten;
  }
  // exacte titeltreffer krijgt nog een duwtje naar boven
  if (titel.includes(normaliseerTekst(woorden.join(" ")))) totaal += 5;
  return totaal;
}
