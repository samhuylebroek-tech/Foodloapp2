import { vervanging } from "@/lib/product-herkenning";

/** Snelle voorstellen voor een vervanging. Geen AI: gewoon de gebruikelijke alternatieven. */
export function vervangVoorstellen(naam: string): string[] {
  const basis = vervanging(naam).voor ?? vervanging(naam).naam;
  const kort = basis.replace(/^(verse?|biologische?|bio)\s+/i, "").trim();
  if (!kort) return [];
  const klein = kort.charAt(0).toLowerCase() + kort.slice(1);
  return [`Diepvries ${klein}`, `${kort.charAt(0).toUpperCase()}${kort.slice(1)} uit blik`];
}
