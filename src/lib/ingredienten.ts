export type ParsedIngredient = { name: string; quantity: number | null; unit: string };

type EenheidRegel = { unit: string; factor?: number };

const UNIT_ALIAS: Record<string, EenheidRegel> = {
  g: { unit: "g" }, gr: { unit: "g" }, gram: { unit: "g" }, grams: { unit: "g" }, gramme: { unit: "g" }, grammes: { unit: "g" },
  kg: { unit: "kg" }, kilogram: { unit: "kg" }, kilograms: { unit: "kg" }, kilo: { unit: "kg" },
  mg: { unit: "mg" }, milligram: { unit: "mg" }, milligrams: { unit: "mg" },
  ml: { unit: "ml" }, milliliter: { unit: "ml" }, milliliters: { unit: "ml" }, millilitre: { unit: "ml" }, millilitres: { unit: "ml" }, cc: { unit: "ml" },
  cl: { unit: "cl" }, centiliter: { unit: "cl" }, centiliters: { unit: "cl" }, centilitre: { unit: "cl" }, centilitres: { unit: "cl" },
  dl: { unit: "dl" }, deciliter: { unit: "dl" }, deciliters: { unit: "dl" }, decilitre: { unit: "dl" }, decilitres: { unit: "dl" },
  l: { unit: "l" }, liter: { unit: "l" }, liters: { unit: "l" }, litre: { unit: "l" }, litres: { unit: "l" },
  el: { unit: "el" }, eetlepel: { unit: "el" }, eetlepels: { unit: "el" }, tbsp: { unit: "el" }, tbsps: { unit: "el" }, tablespoon: { unit: "el" }, tablespoons: { unit: "el" },
  tl: { unit: "tl" }, theelepel: { unit: "tl" }, theelepels: { unit: "tl" }, tsp: { unit: "tl" }, tsps: { unit: "tl" }, teaspoon: { unit: "tl" }, teaspoons: { unit: "tl" },
  "stuk(s)": { unit: "stuk(s)" }, stuk: { unit: "stuk(s)" }, stuks: { unit: "stuk(s)" }, piece: { unit: "stuk(s)" }, pieces: { unit: "stuk(s)" }, pcs: { unit: "stuk(s)" },
  "teen(tjes)": { unit: "teen(tjes)" }, teen: { unit: "teen(tjes)" }, tenen: { unit: "teen(tjes)" }, teentje: { unit: "teen(tjes)" }, teentjes: { unit: "teen(tjes)" }, clove: { unit: "teen(tjes)" }, cloves: { unit: "teen(tjes)" },
  snuf: { unit: "snuf" }, snufje: { unit: "snuf" }, pinch: { unit: "snuf" }, pinches: { unit: "snuf" },
  blik: { unit: "blik" }, can: { unit: "blik" }, cans: { unit: "blik" }, tin: { unit: "blik" }, tins: { unit: "blik" },
  pak: { unit: "pak" }, packet: { unit: "pak" }, packets: { unit: "pak" }, package: { unit: "pak" }, packages: { unit: "pak" },
  bos: { unit: "bos" }, bunch: { unit: "bos" }, bunches: { unit: "bos" },
  snee: { unit: "snee" }, sneden: { unit: "snee" }, slice: { unit: "snee" }, slices: { unit: "snee" },
  cup: { unit: "cl", factor: 24 }, cups: { unit: "cl", factor: 24 },
  oz: { unit: "g", factor: 28.35 }, ounce: { unit: "g", factor: 28.35 }, ounces: { unit: "g", factor: 28.35 },
  lb: { unit: "g", factor: 453.6 }, lbs: { unit: "g", factor: 453.6 }, pound: { unit: "g", factor: 453.6 }, pounds: { unit: "g", factor: 453.6 },
  "fl oz": { unit: "cl", factor: 3 }, "fluid ounce": { unit: "cl", factor: 3 }, "fluid ounces": { unit: "cl", factor: 3 },
  pint: { unit: "cl", factor: 47 }, pints: { unit: "cl", factor: 47 },
  quart: { unit: "cl", factor: 95 }, quarts: { unit: "cl", factor: 95 },
  gallon: { unit: "l", factor: 3.79 }, gallons: { unit: "l", factor: 3.79 },
  dozen: { unit: "stuk(s)", factor: 12 },
};

function eenheidSleutel(unit: string): string {
  return unit.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
}

function rondMaat(waarde: number): number {
  if (waarde >= 100) return Math.round(waarde);
  if (waarde >= 10) return Math.round(waarde * 10) / 10;
  return Math.round(waarde * 100) / 100;
}

/** Zet opgeslagen of geïmporteerde maten om naar gangbare Belgische eenheden. */
export function belgischeMaat(quantity: number | null, unit: string | null | undefined) {
  const sleutel = eenheidSleutel(unit ?? "");
  const regel = UNIT_ALIAS[sleutel];
  if (!regel) return { quantity, unit: (unit ?? "").trim() };
  let waarde = quantity === null ? null : quantity * (regel.factor ?? 1);
  let doel = regel.unit;
  if (waarde !== null && doel === "g" && waarde >= 1000) {
    waarde /= 1000;
    doel = "kg";
  } else if (waarde !== null && doel === "cl" && waarde >= 100) {
    waarde /= 100;
    doel = "l";
  }
  return { quantity: waarde === null ? null : rondMaat(waarde), unit: doel };
}

export function toonBelgischeMaat(quantity: number | null, unit: string | null | undefined): string {
  const maat = belgischeMaat(quantity, unit);
  if (maat.quantity === null) return maat.unit;
  return `${String(maat.quantity).replace(".", ",")} ${maat.unit}`.trim();
}

function leesAantal(geheel: string, teller?: string, noemer?: string): number | null {
  const basis = geheel ? Number(geheel.replace(",", ".")) : 0;
  const breuk = teller && noemer ? Number(teller) / Number(noemer) : 0;
  const waarde = basis + breuk;
  return Number.isFinite(waarde) ? waarde : null;
}

/** Zet een regel als "500 g bloem" om in losse velden. */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  const clean = line.replace(/^[-•*]\s*/, "").trim();
  if (!clean) return null;

  const match = clean.match(/^(\d+(?:[.,]\d+)?)?(?:\s+(\d+)\s*\/\s*(\d+)|\s*\/\s*(\d+))?\s*([a-zA-ZéÉ()]+(?:\s+[a-zA-Z]+)?)?\s*(.*)$/);
  if (!match) return { name: clean, quantity: null, unit: "" };

  const quantity = leesAantal(match[1] ?? "", match[2] ?? match[4], match[3] ?? (match[4] ? match[1] : undefined));
  const maybeUnit = eenheidSleutel(match[5] ?? "");
  const rest = (match[6] ?? "").trim();
  let alias = UNIT_ALIAS[maybeUnit];
  let naam = rest;
  if (!alias && maybeUnit.includes(" ")) {
    const [eerste, ...overig] = maybeUnit.split(" ");
    alias = UNIT_ALIAS[eerste ?? ""];
    naam = [...overig, rest].filter(Boolean).join(" ");
  }

  if (alias && naam) {
    const maat = belgischeMaat(quantity, maybeUnit.includes(" ") && !UNIT_ALIAS[maybeUnit] ? maybeUnit.split(" ")[0] : maybeUnit);
    return { name: naam, quantity: maat.quantity, unit: maat.unit };
  }
  const losseNaam = [match[5], rest].filter(Boolean).join(" ").trim();
  if (!losseNaam) return { name: clean, quantity: null, unit: "" };
  return { name: losseNaam, quantity, unit: "" };
}

export function parseIngredientText(text: string): ParsedIngredient[] {
  return text
    .split("\n")
    .map(parseIngredientLine)
    .filter((x): x is ParsedIngredient => x !== null);
}

export function ingredientToLine(i: {
  name: string;
  quantity: number | null;
  unit: string;
}): string {
  return [toonBelgischeMaat(i.quantity, i.unit), i.name].filter(Boolean).join(" ").trim();
}
