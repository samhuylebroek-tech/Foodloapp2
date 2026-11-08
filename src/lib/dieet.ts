export type Dieet = "vlees" | "vis" | "vegetarisch";

export const DIETEN: Dieet[] = ["vlees", "vis", "vegetarisch"];

const VLEES = [
  "vlees", "kip", "kalkoen", "rund", "biefstuk", "steak", "gehakt", "varken", "spek", "ham",
  "worst", "chorizo", "salami", "lam", "kalf", "eend", "konijn", "bacon", "hesp", "stoofvlees",
  "burger", "schnitzel", "ribbetjes", "braadworst", "prosciutto", "pancetta", "kipfilet",
];

const VIS = [
  "vis", "zalm", "kabeljauw", "tonijn", "garnaal", "garnalen", "scampi", "mossel", "schelp",
  "inktvis", "calamares", "forel", "haring", "makreel", "ansjovis", "sardine", "tilapia",
  "pangasius", "krab", "kreeft", "zeevruchten", "schol", "victoriabaars", "sushi",
];

/**
 * True als een woord met een trefwoord begint of eindigt ("rundvlees", "kippenfilet",
 * "rundergehakt"). Geen match midden in een woord: "champignons" bevat "ham",
 * maar is geen vlees.
 */
function bevat(tekst: string, woorden: string[]) {
  const tokens = tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
  return tokens.some((t) => woorden.some((w) => t.startsWith(w) || t.endsWith(w)));
}

/** Exacte eetstijl-tag (zoals de app die zelf bewaart), of null. */
function eetstijlTag(tags: string[]): Dieet | null {
  const schoon = tags.map((t) => t.trim().toLowerCase());
  if (schoon.some((t) => t === "vegan" || t === "veganistisch" || t === "vegetarisch")) return "vegetarisch";
  if (schoon.includes("vis")) return "vis";
  if (schoon.includes("vlees")) return "vlees";
  return null;
}

/** Bepaalt of een gerecht vlees, vis of vegetarisch is op basis van naam, labels en ingrediënten. */
export function bepaalDieet(
  title: string,
  tags: string[],
  ingredientNamen: string[] = [],
): Dieet {
  const gekozen = eetstijlTag(tags);
  if (gekozen) return gekozen;

  // Tags zijn losse labels: alleen exacte treffers ("kip"), geen woorddelen ("visueel").
  const tagSet = new Set(tags.map((t) => t.trim().toLowerCase()));
  const tekst = [title, ...ingredientNamen].join(" ");
  if (VIS.some((w) => tagSet.has(w)) || bevat(tekst, VIS)) return "vis";
  if (VLEES.some((w) => tagSet.has(w)) || bevat(tekst, VLEES)) return "vlees";
  return "vegetarisch";
}
