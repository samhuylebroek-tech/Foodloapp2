/**
 * Eenheden omrekenen, zonder te gokken.
 *
 * - Gewicht: mg, g, kg. Volume: ml, cl, dl, l, el (15 ml), tl/kl (5 ml).
 * - Stuks ↔ gram alleen met een gekend gemiddeld stukgewicht per ingrediënt
 *   (`STUKGEWICHT`). Onbekend ingrediënt = niet omrekenen (null), nooit raden.
 * - Gewicht ↔ volume nooit (dat hangt af van het product).
 */
import { canoniekeNaam } from "@/lib/product-herkenning";

export type Familie = "g" | "ml" | "stuk";
export type Maat = { familie: Familie | string; waarde: number };

const GEWICHT: Record<string, number> = { mg: 0.001, g: 1, gr: 1, gram: 1, kg: 1000, kilo: 1000 };
const VOLUME: Record<string, number> = {
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  liter: 1000,
  el: 15,
  eetlepel: 15,
  eetlepels: 15,
  tl: 5,
  kl: 5,
  theelepel: 5,
  theelepels: 5,
  koffielepel: 5,
  koffielepels: 5,
};
const STUKS = new Set(["", "stuk", "stuks", "stuk(s)", "st", "x"]);

export function schoonEenheid(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase().replace(/\.$/, "");
}

/** Familie en waarde in de basiseenheid (g, ml of stuk). Andere eenheden ("blik") blijven zichzelf. */
export function naarBasis(quantity: number | null, unit: string | null | undefined): Maat | null {
  if (quantity == null || !Number.isFinite(quantity)) return null;
  const u = schoonEenheid(unit);
  if (u in GEWICHT) return { familie: "g", waarde: quantity * GEWICHT[u]! };
  if (u in VOLUME) return { familie: "ml", waarde: quantity * VOLUME[u]! };
  if (STUKS.has(u)) return { familie: "stuk", waarde: quantity };
  return { familie: u, waarde: quantity };
}

/** Familie van een eenheid, ook zonder hoeveelheid. */
export function familieVan(unit: string | null | undefined): string {
  return naarBasis(1, unit)!.familie;
}

/**
 * Gemiddeld gewicht van één stuk, in gram (afgeronde richtwaarden). Alleen ingrediënten die
 * je echt per stuk koopt of telt. Sleutel = canonieke naam.
 */
const STUKGEWICHT_RUW: Record<string, number> = {
  ui: 120,
  "rode ui": 120,
  sjalot: 30,
  tomaat: 120,
  paprika: 180,
  "rode paprika": 180,
  "groene paprika": 180,
  "gele paprika": 180,
  courgette: 300,
  aubergine: 300,
  wortel: 100,
  aardappel: 150,
  pompoen: 1200,
  butternut: 1200,
  komkommer: 400,
  prei: 250,
  witloof: 130,
  broccoli: 450,
  bloemkool: 800,
  appel: 180,
  peer: 180,
  banaan: 150,
  citroen: 100,
  limoen: 70,
  sinaasappel: 200,
  avocado: 200,
  ei: 60,
  knoflook: 5,
  "knoflook teen": 5,
  kip: 150,
  zalm: 125,
};

export const STUKGEWICHT: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(STUKGEWICHT_RUW).map(([k, v]) => [canoniekeNaam(k), v]),
);

/** Stukgewicht in gram, of null als Foodlo het niet weet. */
export function stukgewicht(naam: string): number | null {
  return STUKGEWICHT[canoniekeNaam(naam)] ?? null;
}

/**
 * Een maat in een andere familie uitdrukken. g ↔ ml nooit; stuk ↔ g alleen met een gekend
 * stukgewicht. Geeft null als het niet kan.
 */
export function inFamilie(maat: Maat, doel: string, naam: string): Maat | null {
  if (maat.familie === doel) return maat;
  const gewicht = stukgewicht(naam);
  if (!gewicht) return null;
  if (maat.familie === "stuk" && doel === "g")
    return { familie: "g", waarde: maat.waarde * gewicht };
  if (maat.familie === "g" && doel === "stuk")
    return { familie: "stuk", waarde: maat.waarde / gewicht };
  return null;
}

/**
 * Hoeveelheid omrekenen van de ene eenheid naar de andere ("1,5 kg" → "1500 g",
 * "2 stuks ui" → "240 g"). Geeft null als het niet zonder gokken kan.
 */
export function rekenOm(
  quantity: number,
  van: string | null | undefined,
  naar: string | null | undefined,
  naam = "",
): number | null {
  const bron = naarBasis(quantity, van);
  const doelEenheid = schoonEenheid(naar);
  const doel = naarBasis(1, naar);
  if (!bron || !doel) return null;
  if (
    bron.familie === doel.familie &&
    bron.familie !== "g" &&
    bron.familie !== "ml" &&
    bron.familie !== "stuk"
  )
    return schoonEenheid(van) === doelEenheid ? quantity : null;
  const omgezet = inFamilie(bron, doel.familie, naam);
  if (!omgezet) return null;
  return rond(omgezet.waarde / doel.waarde);
}

export function rond(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Basiswaarde terug naar een toonbare eenheid: 1500 g → 1,5 kg; 250 ml → 25 cl. */
export function toonbaar(maat: Maat): { quantity: number; unit: string } {
  if (maat.familie === "g")
    return maat.waarde >= 1000
      ? { quantity: rond(maat.waarde / 1000), unit: "kg" }
      : { quantity: Math.round(maat.waarde), unit: "g" };
  if (maat.familie === "ml") {
    if (maat.waarde >= 1000) return { quantity: rond(maat.waarde / 1000), unit: "l" };
    if (maat.waarde >= 50 && maat.waarde % 10 === 0)
      return { quantity: maat.waarde / 10, unit: "cl" };
    return { quantity: Math.round(maat.waarde), unit: "ml" };
  }
  if (maat.familie === "stuk") return { quantity: rond(maat.waarde), unit: "" };
  return { quantity: rond(maat.waarde), unit: maat.familie };
}
