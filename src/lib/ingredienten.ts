import { UNITS } from "@/lib/types";

export type ParsedIngredient = { name: string; quantity: number | null; unit: string };

const UNIT_ALIAS: Record<string, string> = {
  g: "g",
  gr: "g",
  gram: "g",
  kg: "kg",
  ml: "ml",
  cl: "ml",
  l: "l",
  liter: "l",
  el: "el",
  eetlepel: "el",
  eetlepels: "el",
  tl: "tl",
  theelepel: "tl",
  theelepels: "tl",
  stuk: "stuk(s)",
  stuks: "stuk(s)",
  teen: "teen(tjes)",
  teentjes: "teen(tjes)",
  snuf: "snuf",
  snufje: "snuf",
};

/** Zet een regel als "500 g bloem" om in losse velden. */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  const clean = line.replace(/^[-•*]\s*/, "").trim();
  if (!clean) return null;

  const match = clean.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zé()]+)?\s*(.*)$/);
  if (!match) return { name: clean, quantity: null, unit: "" };

  const quantity = match[1] ? Number(match[1].replace(",", ".")) : null;
  const maybeUnit = (match[2] ?? "").toLowerCase();
  const alias = UNIT_ALIAS[maybeUnit];
  const rest = (match[3] ?? "").trim();

  if (alias && rest) return { name: rest, quantity, unit: alias };
  const naam = [match[2], rest].filter(Boolean).join(" ").trim();
  if (!naam) return { name: clean, quantity: null, unit: "" };
  return { name: naam, quantity, unit: "" };
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
  const unit = UNITS.includes(i.unit) ? i.unit : i.unit;
  return [i.quantity ?? "", unit, i.name].join(" ").replace(/\s+/g, " ").trim();
}
