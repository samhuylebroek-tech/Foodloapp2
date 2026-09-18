import { CATEGORIES } from "@/lib/types";

export type Soort = (typeof CATEGORIES)[number];

/** Woorden die wijzen op een bepaalde soort gerecht. */
const WOORDEN: Record<Soort, string[]> = {
  soep: ["soep", "bouillon", "bisque", "gazpacho", "velouté", "veloute", "ramen", "pho", "minestrone"],
  salade: ["salade", "sla ", "slaatje", "coleslaam", "coleslaw", "salad", "rauwkost"],
  nagerecht: [
    "dessert", "nagerecht", "taart", "cake", "mousse", "pudding", "ijs", "sorbet", "tiramisu",
    "brownie", "koek", "koekjes", "crumble", "cheesecake", "clafoutis", "chocolademousse",
    "panna cotta", "wafels", "donut", "muffin", "rijstpap", "creme brulee", "crème brûlée",
    "appeltaart", "pavlova", "bavarois", "eclair", "macaron", "flan",
  ],
  ontbijt: [
    "ontbijt", "brunch", "pannenkoek", "pannenkoeken", "wentelteefjes", "granola", "havermout",
    "porridge", "overnight oats", "croissant", "roerei", "spiegelei", "yoghurtbowl", "smoothiebowl",
    "brioche", "bagel",
  ],
  drank: [
    "smoothie", "milkshake", "cocktail", "mocktail", "limonade", "sap", "thee", "koffie",
    "chocomelk", "punch", "sangria", "ijskoffie", "drank", "shake",
  ],
  voorgerecht: [
    "voorgerecht", "aperitief", "hapje", "hapjes", "amuse", "tapas", "carpaccio", "bruschetta",
    "garnaalkroket", "kroketjes", "toast", "borrelhapje", "antipasti", "ceviche",
  ],
  bijgerecht: [
    "bijgerecht", "puree", "frieten", "frietjes", "gratin", "aardappelgratin", "groentemix",
    "rijstschotel bijgerecht", "gebakken aardappelen", "stoemp", "dip", "saus", "dressing",
    "kroketten bijgerecht",
  ],
  snack: [
    "snack", "tussendoortje", "reep", "energiereep", "popcorn", "chips", "nachos", "wrapje",
    "blokjes", "bites", "balletjes snack",
  ],
  hoofdgerecht: [
    "hoofdgerecht", "stoofpotje", "ovenschotel", "pasta", "lasagne", "spaghetti", "curry",
    "risotto", "wok", "burger", "pizza", "stoverij", "vol-au-vent", "gehaktballen", "chili",
    "tajine", "paella", "quiche", "schnitzel", "kip met", "vis met",
  ],
};

/** Hoe zwaar een treffer telt, afhankelijk van waar hij staat. */
const GEWICHT = { titel: 5, tag: 3, ingredient: 1 } as const;

function scoreVan(tekst: string, woorden: string[]) {
  const t = ` ${tekst.toLowerCase()} `;
  return woorden.reduce((n, w) => (t.includes(w.toLowerCase()) ? n + 1 : n), 0);
}

/**
 * Raadt de soort van een gerecht op basis van naam, labels en ingrediënten.
 * Werkt volledig lokaal, zonder AI.
 */
export function raadSoort(
  title: string,
  tags: string[] = [],
  ingredientNamen: string[] = [],
): Soort {
  const tagTekst = tags.join(" ");
  const ingTekst = ingredientNamen.join(" ");

  let beste: Soort = "hoofdgerecht";
  let besteScore = 0;

  for (const soort of CATEGORIES) {
    const woorden = WOORDEN[soort] ?? [];
    const score =
      scoreVan(title, woorden) * GEWICHT.titel +
      scoreVan(tagTekst, woorden) * GEWICHT.tag +
      scoreVan(ingTekst, woorden) * GEWICHT.ingredient;
    if (score > besteScore) {
      besteScore = score;
      beste = soort;
    }
  }

  return besteScore > 0 ? beste : "hoofdgerecht";
}

/** Geeft de meegegeven soort terug als die klopt, anders een slimme gok. */
export function kiesSoort(
  bron: string | null | undefined,
  title: string,
  tags: string[] = [],
  ingredientNamen: string[] = [],
): Soort {
  const schoon = (bron ?? "").trim().toLowerCase();
  if ((CATEGORIES as readonly string[]).includes(schoon)) return schoon as Soort;
  return raadSoort(title, tags, ingredientNamen);
}
