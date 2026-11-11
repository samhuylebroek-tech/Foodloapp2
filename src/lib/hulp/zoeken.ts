/**
 * Zoeken in het Help Center en de assistent "Vraag het Foodlo".
 *
 * De assistent is bewust **geen** vrije AI: hij kiest het best passende artikel en geeft
 * letterlijk de stappen daaruit terug, met de titel als bron. Vindt hij niets dat goed past,
 * dan zegt hij dat en verwijst hij naar support. Zo kan hij nooit een knop of functie verzinnen.
 * Een generatieve laag kan later bovenop dezelfde bronnen (zie ONBOARDING-HELPCENTER-ONTWERP §3).
 */
import { lijktOp, normaliseerTekst } from "@/lib/zoeken";
import type { Artikel } from "./artikels";

// Woorden die in bijna elke vraag staan en niets zeggen over het onderwerp.
const STOPWOORDEN = new Set(
  (
    "de het een en of ik je jij u mijn mij me wij we ons onze jullie hoe wat waar wanneer waarom wie " +
    "kan kun kunnen moet moeten wil wilt willen mag doe doen is zijn ben bent was er dat dit die deze " +
    "in op aan van voor met naar bij uit om te tot ook nog al niet geen wel dan als zo maar want " +
    "foodlo app iets graag even hoe werkt"
  ).split(" "),
);

export function kernwoorden(vraag: string): string[] {
  return normaliseerTekst(vraag)
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWOORDEN.has(w));
}

function velden(a: Artikel) {
  return {
    titel: normaliseerTekst(a.titel),
    trefwoorden: normaliseerTekst(a.trefwoorden.join(" ")),
    samenvatting: normaliseerTekst(a.samenvatting),
    stappen: normaliseerTekst([...a.stappen, ...(a.tips ?? [])].join(" ")),
  };
}

function bevat(tekst: string, woord: string) {
  // Begin van een woord: "lijst" vindt "boodschappenlijst" niet per ongeluk wel "lijsten".
  return (" " + tekst).includes(" " + woord) || tekst.includes(woord);
}

export type Treffer = { artikel: Artikel; score: number; dekking: number };

export function zoekHulp(vraag: string, artikels: Artikel[]): Treffer[] {
  const woorden = kernwoorden(vraag);
  if (!woorden.length) return [];
  const zin = normaliseerTekst(vraag);
  const uit: Treffer[] = [];
  for (const a of artikels) {
    const v = velden(a);
    let score = 0;
    let gevonden = 0;
    for (const w of woorden) {
      let p = 0;
      if (bevat(v.titel, w)) p = 5;
      else if (bevat(v.trefwoorden, w)) p = 4;
      else if (bevat(v.samenvatting, w)) p = 2;
      else if (bevat(v.stappen, w)) p = 1;
      else if (lijktOp(w, v.titel) || lijktOp(w, v.trefwoorden)) p = 3;
      if (p) gevonden++;
      score += p;
    }
    // Een volledig trefwoord ("geen internet", "account wissen") in de vraag weegt zwaar.
    for (const t of a.trefwoorden)
      if (t.includes(" ") && zin.includes(normaliseerTekst(t))) score += 6;
    const dekking = gevonden / woorden.length;
    if (score > 0 && dekking >= 0.5) uit.push({ artikel: a, score, dekking });
  }
  return uit.sort((x, y) => y.score - x.score || y.dekking - x.dekking);
}

export type Antwoord =
  | { soort: "antwoord"; bron: Artikel; stappen: string[]; meer: Artikel[] }
  | { soort: "onzeker"; suggesties: Artikel[] }
  | { soort: "geen" };

/** Minimale score om een artikel als antwoord te geven (anders: suggesties of support). */
export const ZEKER_VANAF = 6;

export function beantwoord(vraag: string, artikels: Artikel[]): Antwoord {
  const treffers = zoekHulp(vraag, artikels);
  const beste = treffers[0];
  if (!beste) return { soort: "geen" };
  if (beste.score < ZEKER_VANAF)
    return { soort: "onzeker", suggesties: treffers.slice(0, 3).map((t) => t.artikel) };
  return {
    soort: "antwoord",
    bron: beste.artikel,
    stappen: beste.artikel.stappen,
    meer: treffers.slice(1, 3).map((t) => t.artikel),
  };
}
