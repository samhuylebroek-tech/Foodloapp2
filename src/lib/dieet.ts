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

function bevat(tekst: string, woorden: string[]) {
  return woorden.some((w) => tekst.includes(w));
}

/** Bepaalt of een gerecht vlees, vis of vegetarisch is op basis van naam, labels en ingrediënten. */
export function bepaalDieet(
  title: string,
  tags: string[],
  ingredientNamen: string[] = [],
): Dieet {
  const tagTekst = tags.join(" ").toLowerCase();
  if (tagTekst.includes("vegan") || tagTekst.includes("vegetar")) return "vegetarisch";
  if (tagTekst.includes("vis")) return "vis";
  if (tagTekst.includes("vlees")) return "vlees";

  const tekst = [title, ...tags, ...ingredientNamen].join(" ").toLowerCase();
  if (bevat(tekst, VIS)) return "vis";
  if (bevat(tekst, VLEES)) return "vlees";
  return "vegetarisch";
}
