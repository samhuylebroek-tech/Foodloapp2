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

/**
 * Bewerkafstand (Damerau-Levenshtein, beperkt): hoeveel tikfouten (weglating, toevoeging,
 * vervanging, omwisseling) tussen twee woorden. Stopt vroeg boven `max`.
 */
export function bewerkAfstand(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    let rijMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const kost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + kost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rijMin = Math.min(rijMin, v);
    }
    if (rijMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

/**
 * Lijkt `woord` op een woord in `tekst`, met tikfouten (BUG-100)? Korte woorden (< 4) nooit:
 * anders matcht "ui" op alles. 4–7 tekens: 1 fout, 8+: 2 fouten.
 */
export function lijktOp(woord: string, tekst: string): boolean {
  if (woord.length < 4) return false;
  const max = woord.length >= 8 ? 2 : 1;
  return tekst.split(" ").some(
    (t) =>
      t.length >= 3 &&
      (bewerkAfstand(woord, t, max) <= max ||
        // ook als het titelwoord langer is (samenstelling): vergelijk met het begin ervan
        (t.length > woord.length && bewerkAfstand(woord, t.slice(0, woord.length), max) <= max)),
  );
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
    // Tikfout? Dan nog een (lagere) treffer, zodat exacte treffers bovenaan blijven.
    else if (lijktOp(woord, titel)) punten = 7;
    else if (lijktOp(woord, ingredienten)) punten = 3;
    else if (lijktOp(woord, labels)) punten = 3;
    if (punten === 0) return 0;
    totaal += punten;
  }
  // exacte titeltreffer krijgt nog een duwtje naar boven
  if (titel.includes(normaliseerTekst(woorden.join(" ")))) totaal += 5;
  return totaal;
}
