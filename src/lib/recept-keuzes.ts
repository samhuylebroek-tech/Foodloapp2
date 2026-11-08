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
  return SOORTEN.find((soort) => soort.waarde === waarde.toLowerCase())?.label ?? waarde;
}

/** De eetstijl die als tag bewaard is (exacte tag), of null als er nog geen gekozen is. */
export function bewaardeEetstijl(tags: string[]): Eetstijl | null {
  const schoon = tags.map((t) => t.trim().toLowerCase());
  return EETSTIJLEN.find((k) => schoon.includes(k.waarde))?.waarde ?? null;
}

export function eetstijlUitTags(tags: string[]): Eetstijl {
  return bewaardeEetstijl(tags) ?? "vegetarisch";
}

export function tagsMetEetstijl(tags: string[], eetstijl: Eetstijl) {
  return [
    ...new Set([
      ...tags.filter((tag) => !EETSTIJLEN.some((keuze) => keuze.waarde === tag.toLowerCase())),
      eetstijl,
    ]),
  ];
}
