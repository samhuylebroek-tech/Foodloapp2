import { canoniekeNaam, vervanging } from "@/lib/product-herkenning";

/** Producten die je vaak ook diepgevroren vindt. */
const DIEPVRIES = new Set(
  [
    "spinazie",
    "erwt",
    "boon",
    "broccoli",
    "bloemkool",
    "spruit",
    "maïs",
    "mais",
    "wortel",
    "framboos",
    "aardbei",
    "bes",
    "blauwe bes",
    "mango",
    "ui",
    "paprika",
    "prei",
    "kervel",
    "peterselie",
    "bieslook",
    "garnaal",
    "kabeljauw",
    "zalm",
    "vis",
    "kip",
    "gehakt",
  ].map((w) => canoniekeNaam(w)),
);
/** Producten die je vaak ook in blik of bokaal vindt. */
const BLIK = new Set(
  [
    "tomaat",
    "boon",
    "kikkererwt",
    "linze",
    "maïs",
    "mais",
    "erwt",
    "champignon",
    "tonijn",
    "ananas",
    "perzik",
    "artisjok",
    "olijf",
    "rode biet",
    "kers",
  ].map((w) => canoniekeNaam(w)),
);

/**
 * Snelle voorstellen voor een vervanging. Geen AI: alleen de gebruikelijke alternatieven, en
 * alleen waar ze kloppen (geen "diepvries citroen").
 */
export function vervangVoorstellen(naam: string): string[] {
  const basis = vervanging(naam).voor ?? vervanging(naam).naam;
  const kort = basis.replace(/^(verse?|biologische?|bio)\s+/i, "").trim();
  if (!kort) return [];
  const sleutel = canoniekeNaam(kort);
  const klein = kort.charAt(0).toLowerCase() + kort.slice(1);
  const groot = kort.charAt(0).toUpperCase() + kort.slice(1);
  const uit: string[] = [];
  if (DIEPVRIES.has(sleutel)) uit.push(`Diepvries ${klein}`);
  if (BLIK.has(sleutel)) uit.push(`${groot} uit blik`);
  return uit;
}
