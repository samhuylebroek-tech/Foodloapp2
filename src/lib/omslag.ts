/**
 * V2: kies voor een recept zonder foto een passende, warme omslag
 * (kleurverloop + icoon) op basis van soort gerecht en eetstijl.
 */
import { bepaalDieet } from "@/lib/dieet";

export type OmslagStijl =
  "vlees" | "vis" | "groen" | "soep" | "zoet" | "ontbijt" | "drank" | "neutraal";

export type OmslagIcoon =
  | "beef"
  | "fish"
  | "carrot"
  | "soup"
  | "salad"
  | "cake"
  | "croissant"
  | "cup"
  | "cookie"
  | "utensils";

export function kiesOmslag(recept: {
  title?: string | null;
  category?: string | null;
  tags?: string[] | null;
}): { stijl: OmslagStijl; icoon: OmslagIcoon } {
  const soort = (recept.category ?? "").toLowerCase();
  const tags = recept.tags ?? [];
  switch (soort) {
    case "soep":
      return { stijl: "soep", icoon: "soup" };
    case "salade":
      return { stijl: "groen", icoon: "salad" };
    case "nagerecht":
      return { stijl: "zoet", icoon: "cake" };
    case "ontbijt":
      return { stijl: "ontbijt", icoon: "croissant" };
    case "drank":
      return { stijl: "drank", icoon: "cup" };
    case "snack":
      return { stijl: "ontbijt", icoon: "cookie" };
  }
  if (!recept.title && !tags.length) return { stijl: "neutraal", icoon: "utensils" };
  const dieet = bepaalDieet(recept.title ?? "", tags);
  if (dieet === "vis") return { stijl: "vis", icoon: "fish" };
  if (dieet === "vlees") return { stijl: "vlees", icoon: "beef" };
  return { stijl: "groen", icoon: "carrot" };
}
