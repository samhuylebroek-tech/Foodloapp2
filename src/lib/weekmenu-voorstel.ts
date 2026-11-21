import type { Recipe } from "@/lib/types";

/** Vlees, vis of vegetarisch — of "laat Foodlo kiezen" (null). */
export type Soortkeuze = "vlees" | "vis" | "vega" | null;

export type DagRegel = {
  datum: string;
  moment: string;
  maxMinuten: number; // 0 = maakt niet uit
  soort: Soortkeuze;
  over: boolean;
};

export type Voorstel = {
  datum: string;
  moment: string;
  recept: Recipe | null;
  titel: string;
  /** Nieuw idee van buiten je eigen recepten. */
  extern: boolean;
  /** Er staat al iets ingepland op dat moment. */
  bezet: boolean;
  aan: boolean;
};

export type Weekdoelen = { vlees: number; vis: number; vega: number };

const VIS = [
  "vis", "zalm", "kabeljauw", "tonijn", "garnaal", "garnalen", "scampi", "mossel", "mosselen",
  "inktvis", "schol", "tong", "forel", "haring", "makreel", "sardine", "ansjovis", "zeewolf",
  "pangasius", "tilapia", "krab", "kreeft", "victoriabaars", "heilbot", "coquille",
];

/** BUG-128: ook het label "vlees" en Belgische vleesgerechten. */
const VLEES_EXTRA = [
  "vlees",
  "stoofvlees",
  "stoverij",
  "carbonade",
  "vol-au-vent",
  "frikandel",
  "boulet",
  "gyros",
];

const VLEES = [
  "kip", "rund", "rundvlees", "gehakt", "varken", "varkens", "spek", "ham", "worst", "chorizo",
  "salami", "lam", "kalkoen", "eend", "kalfs", "biefstuk", "steak", "ribbetjes", "bacon",
  "braadworst", "shoarma", "kebab", "kipfilet", "vleesbrood", "burger", "balletjes", "konijn",
  "hesp", "pancetta", "prosciutto",
  ...VLEES_EXTRA,
];
/** Wat wél "vlees" zegt, maar het niet is. */
const GEEN_VLEES =
  /vleesvervang\w*|vleesloos|zonder vlees|vegetarisch gehakt|vegagehakt|veggie gehakt/g;

const VEGA_WOORDEN = ["vegetarisch", "vega", "veganistisch", "vegan", "plantaardig", "meatless"];

function tekstVan(r: Recipe, ingredienten: string[]) {
  return [r.title, r.description, ...(r.tags ?? []), ...ingredienten].join(" ").toLowerCase();
}

function bevat(tekst: string, woorden: string[]) {
  return woorden.some((w) => new RegExp(`(^|[^a-z])${w}`, "i").test(tekst));
}

/** Wat voor soort maaltijd is dit? Puur op woorden, geen AI. */
export function soortVan(r: Recipe, ingredienten: string[] = []): "vlees" | "vis" | "vega" {
  const tekst = tekstVan(r, ingredienten).replace(GEEN_VLEES, " ");
  if (bevat(tekst, VIS)) return "vis";
  if (bevat(tekst, VLEES)) return "vlees";
  if (bevat(tekst, VEGA_WOORDEN)) return "vega";
  return "vega";
}

export function minutenVan(r: Recipe) {
  return (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
}

export function vermijdWoorden(tekst: string) {
  return tekst
    .toLowerCase()
    .split(/[,;\n]| en /)
    .map((w) => w.replace(/geen|liever niet|zonder/g, "").trim())
    .filter((w) => w.length > 2);
}

/** Alleen gerechten die je echt als maaltijd op tafel zet. */
const MAALTIJD_SOORTEN = ["hoofdgerecht", "soep", "salade", "ontbijt", "bijgerecht"];

