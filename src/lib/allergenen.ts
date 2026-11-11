/**
 * Allergenen herkennen in ingrediëntnamen (de 14 EU-allergenen, Verordening 1169/2011).
 * Dit is een **hulp, geen garantie**: we kennen de samenstelling van een product niet
 * (bv. bouillon met selder of gluten). Daarom altijd "mogelijk" en nooit stil wegfilteren.
 */
import { normaliseerTekst } from "@/lib/zoeken";

export type AllergeenId =
  | "gluten"
  | "schaaldieren"
  | "eieren"
  | "vis"
  | "pindas"
  | "soja"
  | "melk"
  | "noten"
  | "selder"
  | "mosterd"
  | "sesam"
  | "sulfiet"
  | "lupine"
  | "weekdieren";

type Regel = { id: AllergeenId; naam: string; woorden: string[]; niet?: string[] };

export const ALLERGENEN: Regel[] = [
  {
    id: "gluten",
    naam: "Gluten",
    woorden: [
      "tarwe",
      "bloem",
      "spelt",
      "rogge",
      "gerst",
      "haver",
      "pasta",
      "spaghetti",
      "tagliatelle",
      "lasagne",
      "macaroni",
      "noedel",
      "brood",
      "paneermeel",
      "couscous",
      "bulgur",
      "bier",
      "seitan",
      "peperkoek",
      "beschuit",
      "bladerdeeg",
      "pizzadeeg",
      "wrap",
      "tortilla",
      "croutons",
    ],
    niet: [
      "bloemkool",
      "maisbloem",
      "rijstbloem",
      "glutenvrij",
      "boekweit",
      "rijstnoedel",
      "maistortilla",
      "zonnebloem",
    ],
  },
  {
    id: "schaaldieren",
    naam: "Schaaldieren",
    woorden: ["garna", "krab", "kreeft", "scampi", "langoustine", "rivierkreeft"],
  },
  {
    id: "eieren",
    naam: "Eieren",
    woorden: ["ei", "eieren", "eigeel", "eiwit", "eidooier", "mayonaise", "mayo"],
  },
  {
    id: "vis",
    naam: "Vis",
    woorden: [
      "vis",
      "zalm",
      "tonijn",
      "kabeljauw",
      "ansjovis",
      "makreel",
      "forel",
      "haring",
      "koolvis",
      "tilapia",
      "vissaus",
      "sardien",
    ],
    niet: ["inktvis"],
  },
  { id: "pindas", naam: "Pinda's", woorden: ["pinda", "arachide", "satesaus", "pindakaas"] },
  { id: "soja", naam: "Soja", woorden: ["soja", "tofu", "tempeh", "edamame", "miso", "ketjap"] },
  {
    id: "melk",
    naam: "Melk (lactose)",
    woorden: [
      "melk",
      "room",
      "boter",
      "kaas",
      "yoghurt",
      "mascarpone",
      "ricotta",
      "parmezaan",
      "mozzarella",
      "feta",
      "karnemelk",
      "kwark",
      "creme fraiche",
      "zure room",
      "geitenkaas",
      "emmentaler",
      "gruyere",
      "cheddar",
      "burrata",
    ],
    niet: [
      "kokosmelk",
      "amandelmelk",
      "havermelk",
      "sojamelk",
      "rijstmelk",
      "pindakaas",
      "kokosroom",
      "boterham",
    ],
  },
  {
    id: "noten",
    naam: "Noten",
    woorden: [
      "hazelno",
      "walno",
      "amandel",
      "cashew",
      "pecan",
      "pistache",
      "macadamia",
      "paranoot",
      "noten",
      "notenmix",
    ],
    niet: ["nootmuskaat", "kokosnoot"],
  },
  { id: "selder", naam: "Selder", woorden: ["selder", "selderij", "knolselder", "bleekselder"] },
  { id: "mosterd", naam: "Mosterd", woorden: ["mosterd"] },
  { id: "sesam", naam: "Sesam", woorden: ["sesam", "tahin"] },
  {
    id: "sulfiet",
    naam: "Sulfiet",
    woorden: ["wijn", "wijnazijn", "gedroogde abrikoos"],
    niet: ["wijnsteen"],
  },
  { id: "lupine", naam: "Lupine", woorden: ["lupine"] },
  {
    id: "weekdieren",
    naam: "Weekdieren",
    woorden: [
      "mossel",
      "oester",
      "inktvis",
      "calamar",
      "sint jakobsvrucht",
      "coquille",
      "slak",
      "octopus",
    ],
  },
];

/** Korte woorden (ei, vis) alleen als heel woord, langere ook als begin van een woord. */
function treft(naam: string, woord: string): boolean {
  const tokens = naam.split(" ");
  if (woord.includes(" ")) return naam.includes(woord);
  if (woord.length <= 3) return tokens.includes(woord);
  return tokens.some((t) => t.includes(woord));
}

export type AllergeenTreffer = { id: AllergeenId; naam: string; ingredienten: string[] };

export function allergenenIn(ingredienten: string[], gekozen: string[]): AllergeenTreffer[] {
  if (!gekozen.length) return [];
  const uit: AllergeenTreffer[] = [];
  for (const r of ALLERGENEN) {
    if (!gekozen.includes(r.id)) continue;
    const hits = ingredienten.filter((ing) => {
      const n = normaliseerTekst(ing);
      if (r.niet?.some((x) => n.includes(x))) return false;
      return r.woorden.some((w) => treft(n, normaliseerTekst(w)));
    });
    if (hits.length) uit.push({ id: r.id, naam: r.naam, ingredienten: [...new Set(hits)] });
  }
  return uit;
}
