/**
 * Privacylaag voor externe AI (BUG-142, beslissing D-2026-11-13-2, docs/foodlo/AI_ARCHITECTURE.md §2).
 *
 * Regel: persoonlijke allergieën, intoleranties, dieet en gezondheidsinformatie gaan NOOIT naar een
 * externe AI-dienst. Vrije tekst van de gebruiker (bv. "Wat eet je liever niet?") kan zulke
 * informatie bevatten. Deze functie laat alleen neutrale smaakwensen door ("bloemkool",
 * "paddenstoelen") en laat elk deel weg dat op een allergeen, intolerantie, dieet of gezondheid lijkt.
 *
 * De volledige tekst blijft op het toestel gebruikt voor het filteren achteraf
 * (`vermijdWoorden`, `veiligheid.ts`). Alleen wat naar de server en de AI gaat, wordt opgeschoond.
 * Deze functie draait op het toestel én nog eens op de server (dubbele bescherming).
 */
import { ALLERGENEN, allergenenIn } from "@/lib/allergenen";
import { normaliseerTekst } from "@/lib/zoeken";

/** Woorden die op gezondheid, allergie, intolerantie of dieet wijzen (genormaliseerd, zonder accenten). */
const GEVOELIG = [
  "allergi",
  "allergeen",
  "allergenen",
  "intoleran",
  "overgevoelig",
  "coeliakie",
  "celiakie",
  "glutenvrij",
  "lactosevrij",
  "lactose",
  "histamine",
  "fructose",
  "diabet",
  "suikerziekte",
  "zwanger",
  "borstvoeding",
  "nier",
  "lever",
  "hart",
  "cholesterol",
  "bloeddruk",
  "jicht",
  "crohn",
  "colitis",
  "prikkelbare",
  "fodmap",
  "medicijn",
  "medicatie",
  "dokter",
  "arts",
  "dieet",
  "vegan",
  "veganist",
  "vegetari",
  "pescotari",
  "halal",
  "kosjer",
  "koosjer",
  "religie",
  "geloof",
  "anafylax",
  "epipen",
  "ziek",
  "gezondheid",
];

/** De 14 EU-allergenen, via dezelfde (geteste) herkenning als in recepten, met uitzonderingen. */
const ALLE_ALLERGENEN = ALLERGENEN.map((r) => r.id);
const ALLERGEENNAMEN = ALLERGENEN.flatMap((r) => [r.id, r.naam]).map((w) => normaliseerTekst(w));

function isGevoelig(deel: string): boolean {
  const n = normaliseerTekst(deel);
  if (!n) return false;
  if (GEVOELIG.some((g) => n.includes(g))) return true;
  if (ALLERGEENNAMEN.some((a) => n.split(/\s+/).some((t) => t === a || t === `${a}s`))) return true;
  return allergenenIn([deel], ALLE_ALLERGENEN).length > 0;
}

export type Opgeschoond = { tekst: string; weggelaten: number };

/**
 * Schoont vrije voorkeurstekst op vóór een AI-aanroep. Splitst op komma, puntkomma, schuine streep,
 * nieuwe regel en " en "; houdt alleen neutrale delen over. Nooit de weggelaten tekst loggen.
 */
export function voorAI(tekst: string | null | undefined): Opgeschoond {
  const delen = (tekst ?? "")
    .split(/[,;/\n]+|\s+en\s+/i)
    .map((d) => d.trim())
    .filter(Boolean);
  const over = delen.filter((d) => !isGevoelig(d));
  return { tekst: over.join(", ").slice(0, 300), weggelaten: delen.length - over.length };
}

/** Zelfde regel voor een hint als "Vermijd: …" (alleen het deel na de dubbele punt wordt opgeschoond). */
export function hintVoorAI(hint: string | null | undefined): string {
  const h = (hint ?? "").trim();
  if (!h) return "";
  const m = /^vermijd:\s*(.*)$/i.exec(h);
  if (m) {
    const { tekst } = voorAI(m[1]);
    return tekst ? `Vermijd: ${tekst}` : "";
  }
  const { tekst } = voorAI(h);
  return tekst;
}
