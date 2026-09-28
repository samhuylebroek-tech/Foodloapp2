import { CATEGORIES } from "@/lib/types";

export type Eetstijl = "vegetarisch" | "vlees" | "vis";

export const EETSTIJLEN: { waarde: Eetstijl; label: string }[] = [
  { waarde: "vegetarisch", label: "Vegetarisch" },
  { waarde: "vlees", label: "Vlees" },
  { waarde: "vis", label: "Vis" },
];

export const SOORTEN = CATEGORIES.map((waarde) => ({
  waarde,
  label: waarde === "salade" ? "Slaatje" : waarde.charAt(0).toUpperCase() + waarde.slice(1),
}));

export function soortLabel(waarde: string) {
  return SOORTEN.find((soort) => soort.waarde === waarde)?.label ?? waarde;
}

export function eetstijlUitTags(tags: string[]): Eetstijl {
  const tekst = tags.join(" ").toLowerCase();
  if (tekst.includes("vis")) return "vis";
  if (tekst.includes("vlees")) return "vlees";
  return "vegetarisch";
}

export function tagsMetEetstijl(tags: string[], eetstijl: Eetstijl) {
  return [...new Set([...tags.filter((tag) => !EETSTIJLEN.some((keuze) => keuze.waarde === tag.toLowerCase())), eetstijl])];
}