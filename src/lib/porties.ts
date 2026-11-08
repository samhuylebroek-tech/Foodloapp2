/**
 * Schat voor hoeveel personen een recept is, als de bron dat niet zegt.
 * Puur rekenwerk op de hoeveelheden — geen AI, geen credits.
 */

import { normaliseerTekst } from "@/lib/zoeken";

type Ing = { name: string; quantity: number | null; unit: string };

/** Richtwaarden per persoon (in gram of stuks). */
const PER_PERSOON: { woorden: string[]; eenheid: "g" | "stuk"; per: number }[] = [
  { woorden: ["pasta", "spaghetti", "penne", "macaroni", "noedels"], eenheid: "g", per: 100 },
  { woorden: ["rijst", "couscous", "quinoa", "bulgur"], eenheid: "g", per: 80 },
  { woorden: ["aardappel", "aardappelen"], eenheid: "g", per: 250 },
  { woorden: ["gehakt", "kip", "kippenfilet", "rundvlees", "varkensvlees", "vis", "zalm", "kabeljauw"], eenheid: "g", per: 150 },
  { woorden: ["ei", "eieren"], eenheid: "stuk", per: 2 },
];

function naarGram(hoeveelheid: number, eenheid: string): number | null {
  const e = eenheid.trim().toLowerCase();
  if (e === "g") return hoeveelheid;
  if (e === "kg") return hoeveelheid * 1000;
  if (e === "ml") return hoeveelheid;
  if (e === "l") return hoeveelheid * 1000;
  return null;
}

/** Samenstellingen die geen hoofdingrediënt zijn ("kippenbouillon", "vissaus", ...). */
const BIJPRODUCT = /(bouillon|fond|saus|azijn|kruiden|poeder|blokje|blokjes|olie|pasta$)/;

/**
 * True als één van de woorden in de naam met het trefwoord begint
 * ("kippenfilet" bij "kip"), maar niet als het een bijproduct is of het
 * trefwoord midden in een woord staat ("kleine" bevat "ei", "geitenkaas" ook).
 */
function bevatTrefwoord(naam: string, trefwoord: string): boolean {
  return naam.split(" ").some((woord) => {
    if (woord === trefwoord) return true;
    if (!woord.startsWith(trefwoord)) return false;
    // Korte trefwoorden ("ei", "vis", "kip") alleen als heel woord of meervoud,
    // of (voor vlees/vis) als begin van een samenstelling zonder bijproduct.
    if (trefwoord.length <= 2) return woord === `${trefwoord}eren` || woord === `${trefwoord}en`;
    return !BIJPRODUCT.test(woord.slice(trefwoord.length));
  });
}

/** Geeft een geschat aantal personen (1-12), of null als we het niet weten. */
export function schatPersonen(ingredienten: Ing[]): number | null {
  const schattingen: number[] = [];

  for (const ing of ingredienten) {
    if (!ing.quantity || ing.quantity <= 0) continue;
    const naam = normaliseerTekst(ing.name);
    for (const regel of PER_PERSOON) {
      if (!regel.woorden.some((w) => bevatTrefwoord(naam, w))) continue;
      if (regel.eenheid === "g") {
        const gram = naarGram(ing.quantity, ing.unit);
        if (gram) schattingen.push(gram / regel.per);
      } else {
        const los = ing.unit.trim() === "" || /stuk/i.test(ing.unit);
        if (los) schattingen.push(ing.quantity / regel.per);
      }
      break;
    }
  }

  if (!schattingen.length) return null;
  const gemiddeld = schattingen.reduce((a, b) => a + b, 0) / schattingen.length;
  const afgerond = Math.round(gemiddeld);
  if (!Number.isFinite(afgerond) || afgerond < 1) return null;
  return Math.min(12, afgerond);
}
