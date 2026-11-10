/**
 * Boodschappen ordenen zoals in de winkel: elk product krijgt een categorie
 * op basis van zijn naam. Volledig lokaal, geen AI, geen credits.
 */

import { normaliseerTekst } from "@/lib/zoeken";
import { stam } from "@/lib/stap-ingredienten";

export const CATEGORIE_VOLGORDE = [
  "groenten-fruit",
  "vlees-vis",
  "zuivel-eieren",
  "brood-bakkerij",
  "diepvries",
  "dranken",
  "non-food",
  "voorraadkast",
  "overige",
] as const;

export type CategorieId = (typeof CATEGORIE_VOLGORDE)[number];

export const CATEGORIE_LABEL: Record<CategorieId, string> = {
  "groenten-fruit": "Groenten & fruit",
  "vlees-vis": "Vlees & vis",
  "zuivel-eieren": "Zuivel & eieren",
  "brood-bakkerij": "Brood & bakkerij",
  diepvries: "Diepvries",
  dranken: "Dranken",
  "non-food": "Non-food",
  voorraadkast: "Al in huis?",
  overige: "Overige",
};

/** Zaken die bijna iedereen thuis heeft staan. */
const VOORRAADKAST = [
  "zout", "peper", "peperkorrels", "olijfolie", "olie", "zonnebloemolie", "arachideolie",
  "water", "suiker", "bloem", "bruine suiker", "azijn", "balsamico", "mosterd", "ketchup",
  "mayonaise", "sojasaus", "bouillon", "bouillonblokje", "kruiden", "peterselie gedroogd",
  "oregano", "tijm", "rozemarijn", "laurier", "paprikapoeder", "kerriepoeder", "komijn",
  "kaneel", "nootmuskaat", "currypoeder", "chilipoeder", "vanille", "bakpoeder", "gist",
  "honing", "maizena", "tomatenpuree", "rijst", "pasta", "spaghetti", "couscous", "linzen",
];

const WOORDEN: Record<Exclude<CategorieId, "overige" | "voorraadkast">, string[]> = {
  "groenten-fruit": [
    "ui", "uien", "sjalot", "look", "knoflook", "wortel", "wortelen", "prei", "selder", "selderij",
    "tomaat", "tomaten", "kerstomaat", "paprika", "courgette", "aubergine", "champignon",
    "champignons", "broccoli", "bloemkool", "spinazie", "sla", "komkommer", "aardappel",
    "aardappelen", "witloof", "boontjes", "erwten", "maïs", "mais", "pompoen", "venkel", "biet",
    "kool", "spruitjes", "radijs", "rucola", "basilicum", "peterselie", "koriander", "munt",
    "citroen", "limoen", "appel", "peer", "banaan", "sinaasappel", "druiven", "aardbeien",
    "frambozen", "bosbessen", "mango", "ananas", "avocado", "perzik", "kiwi", "meloen", "gember",
  ],
  "vlees-vis": [
    "kip", "kippenfilet", "kippendij", "gehakt", "rundsgehakt", "rundvlees", "biefstuk", "steak",
    "varken", "varkensvlees", "spek", "hesp", "ham", "worst", "chorizo", "salami", "lam",
    "kalkoen", "kalfsvlees", "bacon", "vis", "zalm", "kabeljauw", "tonijn", "garnalen", "mosselen",
    "scampi", "inktvis", "tofu", "seitan", "vegaburger",
  ],
  "zuivel-eieren": [
    "melk", "room", "slagroom", "kookroom", "yoghurt", "boter", "margarine", "kaas", "geraspte kaas",
    "parmezaan", "mozzarella", "feta", "geitenkaas", "platte kaas", "ricotta", "mascarpone", "ei",
    "eieren", "eiwit", "eigeel", "karnemelk",
  ],
  "brood-bakkerij": [
    "brood", "stokbrood", "pistolet", "baguette", "wrap", "tortilla", "pita", "beschuit",
    "croissant", "toast", "bladerdeeg", "kruimeldeeg", "pizzadeeg", "cake", "taart",
  ],
  diepvries: ["diepvries", "diepvriesgroenten", "ijs", "frieten", "ijsblokjes", "vissticks"],
  dranken: [
    "water fles", "spuitwater", "cola", "limonade", "sap", "appelsap", "sinaasappelsap", "wijn",
    "rode wijn", "witte wijn", "bier", "koffie", "thee", "melkdrank", "tonic",
  ],
  "non-food": [
    "wc-papier", "keukenrol", "afwasmiddel", "wasmiddel", "vuilzak", "vuilniszak", "aluminiumfolie",
    "bakpapier", "plasticfolie", "zeep", "tandpasta", "shampoo", "servetten", "batterijen",
  ],
};

/**
 * Fase 5: aanvullingen (meervouden en ontbrekende producten). Apart gehouden zodat de lijsten
 * hierboven ongewijzigd blijven; getest via de productcatalogus (catalogus.test.ts).
 */
const EXTRA: Partial<Record<keyof typeof WOORDEN, string[]>> = {
  "groenten-fruit": ["citroenen", "limoenen", "peren", "bananen", "appels", "sinaasappels"],
  "vlees-vis": ["kipfilet"],
  diepvries: ["friet", "frietjes", "pizza"],
  dranken: ["water", "fruitsap"],
};
/** "water" om te kopen is een drank, niet iets uit de voorraadkast. */
const NIET_VOORRAADKAST = new Set(["water"]);

function raakt(naam: string, woord: string): boolean {
  const n = ` ${naam} `;
  if (n.includes(` ${woord} `) || naam === woord) return true;
  // Meervoud en verkleinwoord: "appels" = "appel", "pistolets" = "pistolet" (zelfde stam
  // als de productherkenning). Alleen voor woorden van één woord.
  if (woord.includes(" ")) return false;
  const s = stam(woord);
  return naam.split(" ").some((w) => w === woord || stam(w) === s);
}

/** Bepaalt de categorie van een boodschap op basis van de naam. */
export function raadCategorie(naam: string): CategorieId {
  const n = normaliseerTekst(naam);
  if (!n) return "overige";

  for (const woord of VOORRAADKAST) {
    if (NIET_VOORRAADKAST.has(woord)) continue;
    if (raakt(n, normaliseerTekst(woord))) return "voorraadkast";
  }
  for (const id of Object.keys(WOORDEN) as (keyof typeof WOORDEN)[]) {
    for (const woord of [...(EXTRA[id] ?? []), ...WOORDEN[id]]) {
      if (raakt(n, normaliseerTekst(woord))) return id;
    }
  }
  return "overige";
}

const SLEUTEL = "boodschappen-categorie";

/** Handmatige correcties van de gebruiker, lokaal bewaard per productnaam. */
export function leesCorrecties(): Record<string, CategorieId> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SLEUTEL) ?? "{}") as Record<string, CategorieId>;
  } catch {
    return {};
  }
}

export function bewaarCorrectie(naam: string, categorie: CategorieId): Record<string, CategorieId> {
  const alles = { ...leesCorrecties(), [normaliseerTekst(naam)]: categorie };
  try {
    window.localStorage.setItem(SLEUTEL, JSON.stringify(alles));
  } catch {
    // niet erg: dan blijft de automatische indeling gelden
  }
  return alles;
}

export function categorieVan(
  naam: string,
  correcties: Record<string, CategorieId>,
): CategorieId {
  return correcties[normaliseerTekst(naam)] ?? raadCategorie(naam);
}
