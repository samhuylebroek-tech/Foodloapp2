/**
 * Fase 5 — productcatalogus (zoals de tegels in Bring!): gangbare Belgische boodschappen per
 * afdeling, met een herkenbaar beeldje. Statisch en zonder kosten; uitbreidbaar zonder databank.
 * Beeldjes zijn systeememoji (geen eigen illustraties of merkbeelden).
 */
import type { CategorieId } from "@/lib/categorie";
import { normaliseerTekst } from "@/lib/zoeken";

export type CatalogusProduct = { naam: string; beeld: string };

export const CATALOGUS: { afdeling: CategorieId; producten: CatalogusProduct[] }[] = [
  {
    afdeling: "groenten-fruit",
    producten: [
      { naam: "appels", beeld: "🍎" },
      { naam: "bananen", beeld: "🍌" },
      { naam: "citroenen", beeld: "🍋" },
      { naam: "sinaasappels", beeld: "🍊" },
      { naam: "druiven", beeld: "🍇" },
      { naam: "aardbeien", beeld: "🍓" },
      { naam: "tomaten", beeld: "🍅" },
      { naam: "komkommer", beeld: "🥒" },
      { naam: "sla", beeld: "🥬" },
      { naam: "wortelen", beeld: "🥕" },
      { naam: "uien", beeld: "🧅" },
      { naam: "look", beeld: "🧄" },
      { naam: "aardappelen", beeld: "🥔" },
      { naam: "paprika", beeld: "🫑" },
      { naam: "broccoli", beeld: "🥦" },
      { naam: "champignons", beeld: "🍄" },
      { naam: "avocado", beeld: "🥑" },
      { naam: "prei", beeld: "🥬" },
    ],
  },
  {
    afdeling: "vlees-vis",
    producten: [
      { naam: "kipfilet", beeld: "🍗" },
      { naam: "gehakt", beeld: "🥩" },
      { naam: "steak", beeld: "🥩" },
      { naam: "spek", beeld: "🥓" },
      { naam: "hesp", beeld: "🍖" },
      { naam: "worsten", beeld: "🌭" },
      { naam: "zalm", beeld: "🐟" },
      { naam: "scampi", beeld: "🦐" },
    ],
  },
  {
    afdeling: "zuivel-eieren",
    producten: [
      { naam: "melk", beeld: "🥛" },
      { naam: "eieren", beeld: "🥚" },
      { naam: "boter", beeld: "🧈" },
      { naam: "kaas", beeld: "🧀" },
      { naam: "yoghurt", beeld: "🥣" },
      { naam: "room", beeld: "🥛" },
    ],
  },
  {
    afdeling: "brood-bakkerij",
    producten: [
      { naam: "brood", beeld: "🍞" },
      { naam: "pistolets", beeld: "🥖" },
      { naam: "croissants", beeld: "🥐" },
      { naam: "wraps", beeld: "🫓" },
    ],
  },
  {
    afdeling: "diepvries",
    producten: [
      { naam: "diepvriesgroenten", beeld: "🧊" },
      { naam: "frietjes", beeld: "🍟" },
      { naam: "ijs", beeld: "🍨" },
      { naam: "pizza", beeld: "🍕" },
    ],
  },
  {
    afdeling: "dranken",
    producten: [
      { naam: "water", beeld: "💧" },
      { naam: "koffie", beeld: "☕" },
      { naam: "thee", beeld: "🍵" },
      { naam: "fruitsap", beeld: "🧃" },
      { naam: "bier", beeld: "🍺" },
      { naam: "wijn", beeld: "🍷" },
    ],
  },
  {
    afdeling: "voorraadkast",
    producten: [
      { naam: "pasta", beeld: "🍝" },
      { naam: "rijst", beeld: "🍚" },
      { naam: "bloem", beeld: "🌾" },
      { naam: "suiker", beeld: "🍬" },
      { naam: "olijfolie", beeld: "🫒" },
      { naam: "tomatenpassata", beeld: "🥫" },
      { naam: "choco", beeld: "🍫" },
      { naam: "confituur", beeld: "🍯" },
      { naam: "ontbijtgranen", beeld: "🥣" },
    ],
  },
  {
    afdeling: "non-food",
    producten: [
      { naam: "wc-papier", beeld: "🧻" },
      { naam: "keukenrol", beeld: "🧻" },
      { naam: "afwasmiddel", beeld: "🧴" },
      { naam: "wasmiddel", beeld: "🧺" },
      { naam: "tandpasta", beeld: "🪥" },
      { naam: "vuilniszakken", beeld: "🗑️" },
    ],
  },
];

/** Zoekt in de catalogus (begin van een woord telt); lege zoekterm = alles. */
export function zoekCatalogus(term: string) {
  const t = normaliseerTekst(term);
  if (!t) return CATALOGUS;
  return CATALOGUS.map((g) => ({
    ...g,
    producten: g.producten.filter(
      (p) =>
        normaliseerTekst(p.naam)
          .split(" ")
          .some((w) => w.startsWith(t)) || normaliseerTekst(p.naam).includes(t),
    ),
  })).filter((g) => g.producten.length > 0);
}

/** Beeldje voor een productnaam (ook voor iets op de lijst dat niet uit de catalogus kwam). */
export function beeldVoor(naam: string): string | null {
  const n = normaliseerTekst(naam);
  for (const g of CATALOGUS)
    for (const p of g.producten) if (normaliseerTekst(p.naam) === n) return p.beeld;
  return null;
}
