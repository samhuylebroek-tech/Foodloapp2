/**
 * Fase 3 — voorraadscherm: waar staat iets (koelkast, diepvries, kast), zoeken, "bijna op" en
 * hoeveelheden met gewone eenheden. Pure functies; de plek komt uit de kolom `plek`
 * (voorstel 0020) of, zolang die er niet is, uit een keuze op dit toestel, anders een gok op
 * basis van de naam (zelfde afdelingen als de boodschappenlijst).
 */
import { categorieVan } from "@/lib/categorie";
import { naarBasis, schoonEenheid } from "@/lib/ingredient";
import { normaliseerTekst } from "@/lib/zoeken";

export const PLEKKEN = ["koelkast", "diepvries", "kast"] as const;
export type Plek = (typeof PLEKKEN)[number];
export const PLEK_LABEL: Record<Plek, string> = {
  koelkast: "Koelkast",
  diepvries: "Diepvries",
  kast: "Kast",
};

/** Groenten en fruit die meestal níét in de koelkast liggen. */
const BUITEN_KOELKAST = new Set(
  [
    "ui",
    "uien",
    "sjalot",
    "sjalotten",
    "look",
    "knoflook",
    "aardappel",
    "aardappelen",
    "krieltjes",
    "pompoen",
    "banaan",
    "bananen",
    "appel",
    "appels",
    "peer",
    "peren",
    "sinaasappel",
    "sinaasappelen",
    "citroen",
    "citroenen",
    "limoen",
    "avocado",
    "tomaat",
    "tomaten",
    "mango",
    "ananas",
    "gember",
    "meloen",
  ].map((w) => normaliseerTekst(w)),
);

/** Een redelijke plek op basis van de naam. */
export function standaardPlek(naam: string): Plek {
  const n = normaliseerTekst(naam);
  if (/\b(diepvries|bevroren|ijs|ijsjes|diepgevroren)\b/.test(n)) return "diepvries";
  const c = categorieVan(naam, {});
  if (c === "diepvries") return "diepvries";
  if (c === "vlees-vis" || c === "zuivel-eieren") return "koelkast";
  if (c === "groenten-fruit") {
    const woorden = n.split(" ");
    return woorden.some((w) => BUITEN_KOELKAST.has(w)) ? "kast" : "koelkast";
  }
  return "kast";
}

export function isPlek(x: unknown): x is Plek {
  return typeof x === "string" && (PLEKKEN as readonly string[]).includes(x);
}

/** Plek van een item: kolom > keuze op het toestel > gok. */
export function plekVan(
  item: { id: string; naam: string; plek?: unknown },
  lokaal: Readonly<Record<string, Plek>> = {},
): Plek {
  if (isPlek(item.plek)) return item.plek;
  return lokaal[item.id] ?? standaardPlek(item.naam);
}

/** Zoeken in de voorraad: op woorden, zonder accenten of hoofdletters. */
export function zoekVoorraad<T extends { naam: string }>(items: readonly T[], zoek: string): T[] {
  const z = normaliseerTekst(zoek).trim();
  if (!z) return [...items];
  const delen = z.split(" ").filter(Boolean);
  return items.filter((i) => {
    const n = normaliseerTekst(i.naam);
    return delen.every((d) => n.includes(d));
  });
}

/**
 * Bijna op? Alleen als de hoeveelheid gekend is: hooguit 1 stuk, of minder dan 150 g / 150 ml.
 * Zonder hoeveelheid weet Foodlo het niet en zegt het niets.
 */
export function isBijnaOp(item: { hoeveelheid: number | null; eenheid: string | null }): boolean {
  if (item.hoeveelheid == null || item.hoeveelheid <= 0) return false;
  const m = naarBasis(item.hoeveelheid, item.eenheid);
  if (!m) return false;
  if (m.familie === "g" || m.familie === "ml") return m.waarde < 150;
  if (m.familie === "stuk") return m.waarde <= 1;
  return false;
}

/** Eenheden die je bij "Aanpassen" kan kiezen ("" = stuks). */
export const EENHEDEN = ["", "g", "kg", "ml", "cl", "l"] as const;
export const EENHEID_LABEL: Record<(typeof EENHEDEN)[number], string> = {
  "": "stuks",
  g: "gram",
  kg: "kilogram",
  ml: "milliliter",
  cl: "centiliter",
  l: "liter",
};

/**
 * Een ingetypte hoeveelheid ("1,5", "250") naar een getal; ongeldig of ≤ 0 = null.
 * Belgische notatie met komma.
 */
export function leesHoeveelheid(tekst: string): number | null {
  const t = tekst.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Math.round(n * 100) / 100;
}

/** De eenheid van een item als keuze uit de lijst (onbekend = stuks). */
export function eenheidKeuze(eenheid: string | null | undefined): (typeof EENHEDEN)[number] {
  const e = schoonEenheid(eenheid);
  return (EENHEDEN as readonly string[]).includes(e) ? (e as (typeof EENHEDEN)[number]) : "";
}

// ---------------------------------------------------------------- plek op dit toestel

const sleutel = (userId: string) => `foodlo:voorraad-plek:${userId}`;

export function leesPlekken(userId: string | null | undefined): Record<string, Plek> {
  if (!userId) return {};
  try {
    const ruw = window.localStorage.getItem(sleutel(userId));
    const o = ruw ? (JSON.parse(ruw) as unknown) : {};
    if (!o || typeof o !== "object") return {};
    return Object.fromEntries(
      Object.entries(o as Record<string, unknown>).filter(([, v]) => isPlek(v)),
    ) as Record<string, Plek>;
  } catch {
    return {};
  }
}

export function bewaarPlek(userId: string, itemId: string, plek: Plek) {
  try {
    window.localStorage.setItem(
      sleutel(userId),
      JSON.stringify({ ...leesPlekken(userId), [itemId]: plek }),
    );
  } catch {
    // Opslag geblokkeerd: dan geldt de keuze tot je de pagina sluit.
  }
}
