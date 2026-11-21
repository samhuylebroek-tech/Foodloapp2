/**
 * Synoniemen voor België en Nederland, als data. De centrale productherkenning
 * (`product-herkenning.ts`) gebruikt deze lijst bovenop haar eigen (meertalige) synoniemen.
 *
 * - `SYNONIEM_GROEPEN`: de eerste naam is de canonieke vorm; de rest valt erop samen.
 * - `BIJVOEGLIJK`: achteraan geplaatste bijvoeglijke vormen ("paprika rood") krijgen dezelfde
 *   vorm als vooraan ("rode paprika"), zodat de woordvolgorde er niet toe doet.
 *
 * Bewust NIET samengevoegd: varianten met een andere betekenis ("zure room" ≠ "room",
 * "rode ui" ≠ "ui", "amandelmelk" ≠ "melk").
 */
export const SYNONIEM_GROEPEN: readonly (readonly string[])[] = [
  ["ui", "ajuin", "ajuinen", "uien", "uitje", "uitjes"],
  ["room", "slagroom", "kookroom", "vloeibare room", "verse room"],
  ["courgette", "courgettes", "zucchini"],
  ["aardappel", "aardappelen", "patat", "pataten", "patatten"],
  ["knoflook", "look", "lookteen", "lookteentje", "lookteentjes"],
  ["selderij", "selder", "bleekselder", "bleekselderij"],
  ["witloof", "witlof", "chicon", "chicons", "brussels lof"],
  ["prei", "preien", "poreien", "porei"],
  ["champignon", "champignons", "paddenstoel", "paddenstoelen"],
  ["sinaasappel", "appelsien", "appelsienen", "sinaasappelen", "sinaasappels"],
  ["gehakt", "gemengd gehakt", "half om half gehakt"],
  ["kip", "kippenfilet", "kipfilet", "kippenborst", "kipfilets", "kippenfilets"],
  ["ham", "hesp"],
  ["passata", "tomatenpassata", "gezeefde tomaten"],
  ["spek", "spekjes", "lardons", "spekblokjes"],
  ["koriander", "verse koriander"],
  ["rozijn", "rozijnen", "krenten"],
  ["olie", "zonnebloemolie", "frituurolie", "plantaardige olie"],
];

/** Achteraan geplaatst bijvoeglijk naamwoord → vorm vooraan ("paprika rood" = "rode paprika"). */
export const BIJVOEGLIJK: Readonly<Record<string, string>> = {
  rood: "rode",
  groen: "groene",
  geel: "gele",
  wit: "witte",
  zwart: "zwarte",
  zuur: "zure",
};

/** Opzoektabel naam → canonieke vorm, uit de groepen hierboven. */
export const EXTRA_SYNONIEMEN: Readonly<Record<string, string>> = Object.fromEntries(
  SYNONIEM_GROEPEN.flatMap((g) => g.map((naam) => [naam, g[0]!] as const)),
);
