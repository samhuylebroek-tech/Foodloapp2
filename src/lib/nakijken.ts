/**
 * Nakijkscherm (fase 2): elk ingelezen recept wordt eerst nagekeken, nooit stil bewaard.
 *
 * - `vindDubbel`: "Dit lijkt op je recept X" op basis van naam, ingrediënten en bron.
 * - `onzekerVelden`: welke velden de gebruiker zeker moet nakijken.
 *
 * Zuivere functies; de schermen halen de eigen recepten zelf op.
 */
import { basis, normaliseer } from "@/lib/stap-ingredienten";
import type { Onzeker } from "@/lib/recept-tekst";

export type DubbelKandidaat = {
  id: string;
  title: string;
  ingredienten: readonly string[];
  source_url?: string | null;
};

export type Dubbel = {
  recept: DubbelKandidaat;
  score: number;
  reden: "bron" | "naam" | "ingredienten";
};

const STOPWOORDEN = new Set([
  "de",
  "het",
  "een",
  "met",
  "van",
  "en",
  "in",
  "op",
  "of",
  "a",
  "la",
  "le",
  "les",
  "au",
  "aux",
  "the",
  "with",
  "and",
  "mijn",
  "onze",
  "oma",
  "opa",
  "mama",
  "papa",
  "s",
  "lekkere",
  "lekker",
  "snelle",
  "snel",
  "makkelijke",
  "makkelijk",
  "huisgemaakte",
  "zelfgemaakte",
  "recept",
  "wijze",
  "style",
  "stijl",
  "echte",
  "heerlijke",
  "uit",
  "voor",
  "bij",
  "zonder",
  "na",
  "nieuwe",
]);

/** "frietjes" en "frieten" vallen samen: verkleinwoord weg, dan de gewone basisvorm. */
function kern(woord: string): string {
  const zonderVerkleining = woord.length > 6 ? woord.replace(/(?<=t)jes$|(?<=t)je$/, "") : woord;
  return basis(zonderVerkleining);
}

function woorden(titel: string): Set<string> {
  return new Set(
    normaliseer(titel)
      .split(" ")
      .filter((w) => w.length > 1 && !STOPWOORDEN.has(w))
      .map(kern),
  );
}

function ingredientSleutel(naam: string): string {
  const w = normaliseer(naam)
    .split(" ")
    .filter((x) => x.length > 1 && !STOPWOORDEN.has(x));
  // Het laatste woord draagt meestal de betekenis: "verse rode ui" -> "ui".
  return kern(w[w.length - 1] ?? "");
}

/** Jaccard van de betekenisvolle woorden in de naam (0..1). */
export function naamGelijkenis(a: string, b: string): number {
  const x = woorden(a);
  const y = woorden(b);
  if (!x.size || !y.size) return 0;
  let samen = 0;
  for (const w of x) if (y.has(w)) samen++;
  return samen / (x.size + y.size - samen);
}

/** Aandeel gedeelde ingrediënten t.o.v. het kleinste recept (0..1); 0 bij minder dan 3. */
export function ingredientGelijkenis(a: readonly string[], b: readonly string[]): number {
  const x = new Set(a.map(ingredientSleutel).filter(Boolean));
  const y = new Set(b.map(ingredientSleutel).filter(Boolean));
  if (x.size < 3 || y.size < 3) return 0;
  let samen = 0;
  for (const w of x) if (y.has(w)) samen++;
  return samen / Math.min(x.size, y.size);
}

function zelfdeBron(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const kort = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.hostname.replace(/^(www|m)\./, "")}${x.pathname.replace(/\/$/, "")}${x.searchParams.get("v") ?? ""}`;
    } catch {
      return u.trim();
    }
  };
  return kort(a) === kort(b);
}

/**
 * Het eigen recept dat het meest op het nieuwe lijkt, of null. Drempels: dezelfde bron, of een
 * naam die sterk lijkt (≥ 0,6), of een gelijkaardige naam met grotendeels dezelfde ingrediënten,
 * of (bij ≥ 4 ingrediënten) bijna dezelfde ingrediëntenlijst.
 */
export function vindDubbel(
  nieuw: { title: string; ingredienten: readonly string[]; source_url?: string | null },
  bestaande: readonly DubbelKandidaat[],
): Dubbel | null {
  let beste: Dubbel | null = null;
  for (const r of bestaande) {
    if (zelfdeBron(nieuw.source_url, r.source_url)) return { recept: r, score: 1, reden: "bron" };
    const naam = naamGelijkenis(nieuw.title, r.title);
    const ing = ingredientGelijkenis(nieuw.ingredienten, r.ingredienten);
    let score = 0;
    let reden: Dubbel["reden"] = "naam";
    if (naam >= 0.6) score = naam;
    else if (naam >= 0.3 && ing >= 0.6) score = (naam + ing) / 2 + 0.15;
    else if (ing >= 0.85 && Math.min(nieuw.ingredienten.length, r.ingredienten.length) >= 4) {
      score = ing * 0.8;
      reden = "ingredienten";
    }
    if (score >= 0.6 && (!beste || score > beste.score))
      beste = { recept: r, score: Math.min(1, score), reden };
  }
  return beste;
}

/** Welke velden moet je zeker nakijken? Voor resultaten van AI of van een pagina. */
export function onzekerVelden(r: {
  title: string;
  ingredients: readonly { name: string; quantity: number | null }[];
  instructions: readonly string[];
  is_suggestie?: boolean;
  ontbrekend?: readonly string[];
}): Onzeker[] {
  const uit: Onzeker[] = [];
  if (r.is_suggestie)
    uit.push({
      veld: "gok",
      uitleg: "Dit recept is een voorstel op basis van een foto. Kijk alles goed na.",
    });
  if (!r.title.trim()) uit.push({ veld: "naam", uitleg: "Geef het gerecht een naam." });
  if (!r.ingredients.length)
    uit.push({ veld: "ingredienten", uitleg: "We vonden geen ingrediënten. Vul ze aan." });
  const zonderMaat = r.ingredients.filter(
    (i) => i.quantity === null && !/naar smaak|snuf|scheut|beetje|optioneel/i.test(i.name),
  );
  if (zonderMaat.length && r.ingredients.length)
    uit.push({
      veld: "hoeveelheden",
      uitleg: `Geen hoeveelheid bij: ${zonderMaat.map((i) => i.name).join(", ")}.`,
    });
  if (!r.instructions.length)
    uit.push({ veld: "stappen", uitleg: "We vonden geen bereiding. Vul de stappen aan." });
  return uit;
}
