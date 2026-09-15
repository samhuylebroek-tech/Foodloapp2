/**
 * Voedingswaarden berekenen uit ingrediënten — volledig lokaal, zonder AI en zonder internet.
 * Waarden per 100 g (of 100 ml) uit courante voedingswaardetabellen; steeds benaderend.
 */

export type Macro = {
  kcal: number;
  eiwit: number;
  koolhydraten: number;
  suikers: number;
  vet: number;
  verzadigd: number;
  vezels: number;
  natrium: number; // mg
};

/** Micronutriënten per 100 g. Eenheden: zie MICRO_META. */
export type Micro = Partial<{
  vitA: number; // µg
  vitB1: number; // mg
  vitB2: number; // mg
  vitB3: number; // mg
  vitB6: number; // mg
  vitB9: number; // µg
  vitB12: number; // µg
  vitC: number; // mg
  vitD: number; // µg
  vitE: number; // mg
  vitK: number; // µg
  calcium: number; // mg
  ijzer: number; // mg
  magnesium: number; // mg
  fosfor: number; // mg
  kalium: number; // mg
  zink: number; // mg
  selenium: number; // µg
}>;

export type MicroSleutel = keyof Micro;

export type Voeding = Macro & { micro: Micro };

type Item = Macro & { micro?: Micro; aliassen?: string[] };

/** EU-referentie-inname (RI) per dag voor een gemiddelde volwassene. */
export const RI = {
  kcal: 2000,
  eiwit: 50,
  koolhydraten: 260,
  suikers: 90,
  vet: 70,
  verzadigd: 20,
  vezels: 25,
  zout: 6, // g
} as const;

export const MICRO_META: Record<MicroSleutel, { label: string; eenheid: string; ri: number }> = {
  vitA: { label: "Vitamine A", eenheid: "µg", ri: 800 },
  vitB1: { label: "Vitamine B1", eenheid: "mg", ri: 1.1 },
  vitB2: { label: "Vitamine B2", eenheid: "mg", ri: 1.4 },
  vitB3: { label: "Vitamine B3", eenheid: "mg", ri: 16 },
  vitB6: { label: "Vitamine B6", eenheid: "mg", ri: 1.4 },
  vitB9: { label: "Vitamine B9 (foliumzuur)", eenheid: "µg", ri: 200 },
  vitB12: { label: "Vitamine B12", eenheid: "µg", ri: 2.5 },
  vitC: { label: "Vitamine C", eenheid: "mg", ri: 80 },
  vitD: { label: "Vitamine D", eenheid: "µg", ri: 5 },
  vitE: { label: "Vitamine E", eenheid: "mg", ri: 12 },
  vitK: { label: "Vitamine K", eenheid: "µg", ri: 75 },
  calcium: { label: "Calcium", eenheid: "mg", ri: 800 },
  ijzer: { label: "IJzer", eenheid: "mg", ri: 14 },
  magnesium: { label: "Magnesium", eenheid: "mg", ri: 375 },
  fosfor: { label: "Fosfor", eenheid: "mg", ri: 700 },
  kalium: { label: "Kalium", eenheid: "mg", ri: 2000 },
  zink: { label: "Zink", eenheid: "mg", ri: 10 },
  selenium: { label: "Selenium", eenheid: "µg", ri: 55 },
};

export const MICRO_VITAMINES: MicroSleutel[] = [
  "vitA", "vitB1", "vitB2", "vitB3", "vitB6", "vitB9", "vitB12", "vitC", "vitD", "vitE", "vitK",
];
export const MICRO_MINERALEN: MicroSleutel[] = [
  "calcium", "ijzer", "magnesium", "fosfor", "kalium", "zink", "selenium",
];

function m(
  kcal: number,
  eiwit: number,
  koolhydraten: number,
  suikers: number,
  vet: number,
  verzadigd: number,
  vezels: number,
  natrium: number,
  micro?: Micro,
  aliassen?: string[],
): Item {
  return { kcal, eiwit, koolhydraten, suikers, vet, verzadigd, vezels, natrium, micro, aliassen };
}

/** Canonieke ingrediënten met waarden per 100 g. */
const TABEL: Record<string, Item> = {
  // Vlees & gevogelte
  kip: m(165, 31, 0, 0, 3.6, 1, 0, 74, { vitB3: 13.7, vitB6: 0.6, fosfor: 220, kalium: 256, zink: 1, selenium: 22 }, ["kipfilet", "kippenborst", "kippendij", "chicken", "kipreepjes", "kalkoen"]),
  rundvlees: m(217, 26, 0, 0, 12, 5, 0, 66, { vitB12: 2.6, ijzer: 2.6, zink: 5, fosfor: 200, kalium: 318 }, ["rund", "biefstuk", "steak", "rundergehakt", "stoofvlees", "beef", "entrecote", "bavette"]),
  gehakt: m(250, 19, 0, 0, 19, 7.5, 0, 70, { vitB12: 2.2, ijzer: 2.2, zink: 4.6 }, ["gehaktbrood", "gehaktballen", "mince"]),
  varkensvlees: m(242, 27, 0, 0, 14, 5, 0, 62, { vitB1: 0.9, vitB12: 0.7, fosfor: 230, zink: 2.4 }, ["varken", "varkenshaas", "pork", "kotelet", "schnitzel"]),
  spek: m(541, 37, 1.4, 0, 42, 14, 0, 1700, { vitB1: 0.4, fosfor: 230, zink: 3 }, ["bacon", "spekblokjes", "pancetta", "ontbijtspek"]),
  ham: m(145, 21, 1.5, 1, 6, 2, 0, 1200, { vitB1: 0.6, fosfor: 200 }, ["hesp", "prosciutto", "achterham"]),
  worst: m(300, 13, 2, 1, 27, 10, 0, 850, {}, ["chorizo", "salami", "braadworst", "merguez"]),
  lamsvlees: m(258, 25, 0, 0, 17, 7, 0, 72, { vitB12: 2.6, ijzer: 1.9, zink: 4 }, ["lam"]),

  // Vis & zeevruchten
  zalm: m(208, 20, 0, 0, 13, 3.1, 0, 59, { vitD: 11, vitB12: 3.2, vitB3: 8, selenium: 36, kalium: 363, fosfor: 240 }, ["salmon", "zalmfilet"]),
  witvis: m(82, 18, 0, 0, 0.7, 0.1, 0, 78, { vitB12: 1.1, selenium: 33, fosfor: 200, vitD: 1 }, ["kabeljauw", "tilapia", "pangasius", "schol", "victoriabaars", "koolvis", "heek", "forel"]),
  tonijn: m(132, 28, 0, 0, 1.3, 0.4, 0, 47, { vitB12: 2.2, vitD: 2, selenium: 80, fosfor: 250 }, ["tuna"]),
  garnalen: m(99, 24, 0.2, 0, 0.3, 0.1, 0, 111, { vitB12: 1.1, selenium: 40, fosfor: 200, calcium: 70 }, ["garnaal", "scampi", "gamba", "gambas"]),
  mosselen: m(86, 12, 3.7, 0, 2.2, 0.4, 0, 286, { vitB12: 12, ijzer: 4, selenium: 45 }, ["mossel"]),

  // Eieren & zuivel
  ei: m(143, 13, 0.7, 0.4, 10, 3.1, 0, 142, { vitA: 160, vitB2: 0.46, vitB12: 1.1, vitD: 2, selenium: 30, fosfor: 198 }, ["eieren", "eitje", "eigeel", "eiwitten"]),
  melk: m(64, 3.4, 4.8, 4.8, 3.6, 2.3, 0, 44, { calcium: 120, vitB2: 0.18, vitB12: 0.4, fosfor: 95, kalium: 150, vitD: 0.1 }, ["volle melk", "halfvolle melk", "magere melk"]),
  room: m(292, 2.4, 3, 3, 30, 19, 0, 38, { vitA: 300, calcium: 78 }, ["slagroom", "kookroom", "crème fraîche", "creme fraiche", "zure room"]),
  boter: m(717, 0.9, 0.1, 0.1, 81, 51, 0, 11, { vitA: 684, vitD: 1.5, vitE: 2.3 }, ["roomboter"]),
  yoghurt: m(61, 3.5, 4.7, 4.7, 3.3, 2.1, 0, 46, { calcium: 121, vitB2: 0.14, vitB12: 0.4, fosfor: 95 }, ["griekse yoghurt", "yogurt"]),
  kaas: m(402, 25, 1.3, 0.5, 33, 21, 0, 621, { calcium: 721, vitA: 265, vitB12: 0.8, fosfor: 512, zink: 3.1 }, ["cheddar", "gouda", "geraspte kaas", "emmentaler", "gruyère", "gruyere", "kaasblokjes"]),
  parmezaan: m(392, 36, 3.2, 0.8, 26, 17, 0, 1600, { calcium: 1180, fosfor: 690, zink: 3 }, ["parmezaanse kaas", "parmigiano", "pecorino", "grana padano"]),
  mozzarella: m(280, 22, 2.2, 1, 20, 12, 0, 627, { calcium: 505, fosfor: 350 }, ["buffelmozzarella"]),
  feta: m(264, 14, 4.1, 4.1, 21, 15, 0, 917, { calcium: 493, fosfor: 337 }, ["fetakaas"]),

  // Granen & pasta
  pasta: m(371, 13, 75, 2.7, 1.5, 0.3, 3.2, 6, { vitB1: 0.5, vitB3: 5, ijzer: 1.3, magnesium: 53, selenium: 63 }, ["spaghetti", "penne", "macaroni", "tagliatelle", "fusilli", "lasagnebladen", "noedels", "noodles", "vermicelli"]),
  rijst: m(360, 7, 79, 0.1, 0.7, 0.2, 1.3, 5, { vitB1: 0.07, magnesium: 25, selenium: 15 }, ["basmatirijst", "risottorijst", "witte rijst", "zilvervliesrijst", "jasmijnrijst"]),
  bloem: m(364, 10, 76, 0.3, 1, 0.2, 2.7, 2, { vitB1: 0.12, ijzer: 1.2, magnesium: 22 }, ["tarwebloem", "patentbloem", "zelfrijzende bloem"]),
  brood: m(265, 9, 49, 5, 3.2, 0.7, 2.7, 490, { vitB1: 0.4, ijzer: 3.6, calcium: 150 }, ["broodkruimels", "paneermeel", "stokbrood", "toast", "ciabatta", "pistolet"]),
  havermout: m(379, 13, 67, 1, 6.5, 1.1, 10, 6, { vitB1: 0.5, magnesium: 177, ijzer: 4.3, zink: 3.6, fosfor: 410 }, ["haverylokken", "oats"]),
  couscous: m(376, 13, 77, 0.6, 0.6, 0.1, 5, 10, { selenium: 27, magnesium: 44 }, ["bulgur", "quinoa"]),
  aardappel: m(77, 2, 17, 0.8, 0.1, 0, 2.2, 6, { vitC: 19.7, kalium: 425, vitB6: 0.3, magnesium: 23 }, ["aardappelen", "krieltjes", "puree", "frieten"]),
  zoeteAardappel: m(86, 1.6, 20, 4.2, 0.1, 0, 3, 55, { vitA: 709, vitC: 2.4, kalium: 337 }, ["zoete aardappel", "zoete aardappelen", "bataat"]),

  // Peulvruchten & noten
  linzen: m(116, 9, 20, 1.8, 0.4, 0.1, 8, 2, { vitB9: 181, ijzer: 3.3, kalium: 369, fosfor: 180, zink: 1.3 }, ["linze"]),
  kikkererwten: m(164, 8.9, 27, 4.8, 2.6, 0.3, 7.6, 7, { vitB9: 172, ijzer: 2.9, magnesium: 48, fosfor: 168 }, ["chickpeas"]),
  bonen: m(127, 8.7, 23, 0.3, 0.5, 0.1, 6.4, 2, { vitB9: 130, ijzer: 2.2, kalium: 405, magnesium: 45 }, ["kidneybonen", "witte bonen", "zwarte bonen", "borlotti"]),
  erwten: m(81, 5.4, 14, 5.7, 0.4, 0.1, 5.1, 5, { vitC: 40, vitA: 38, vitB9: 65, ijzer: 1.5 }, ["doperwten", "erwt"]),
  amandelen: m(579, 21, 22, 4.4, 50, 3.8, 12.5, 1, { vitE: 25.6, magnesium: 270, calcium: 269, ijzer: 3.7, fosfor: 481 }, ["amandel", "amandelschaafsel"]),
  walnoten: m(654, 15, 14, 2.6, 65, 6.1, 6.7, 2, { vitE: 0.7, magnesium: 158, fosfor: 346, zink: 3.1 }, ["walnoot"]),
  pindas: m(567, 26, 16, 4.7, 49, 6.3, 8.5, 18, { vitB3: 12, vitE: 8.3, magnesium: 168, fosfor: 376 }, ["pinda", "pindakaas", "grondnoten"]),
  cashewnoten: m(553, 18, 30, 5.9, 44, 7.8, 3.3, 12, { magnesium: 292, ijzer: 6.7, zink: 5.8, fosfor: 593 }, ["cashew", "cashewnoot"]),

  // Groenten
  tomaat: m(18, 0.9, 3.9, 2.6, 0.2, 0, 1.2, 5, { vitC: 14, vitA: 42, kalium: 237, vitK: 8 }, ["tomaten", "cherrytomaten", "kerstomaten", "tomatenblokjes", "passata", "tomatenpuree", "tomatensaus", "tomato"]),
  ui: m(40, 1.1, 9.3, 4.2, 0.1, 0, 1.7, 4, { vitC: 7.4, vitB6: 0.12, kalium: 146 }, ["uien", "sjalot", "sjalotten", "rode ui", "lente-ui", "onion"]),
  knoflook: m(149, 6.4, 33, 1, 0.5, 0.1, 2.1, 17, { vitC: 31, vitB6: 1.2, calcium: 181, fosfor: 153, selenium: 14 }, ["look", "teentje knoflook", "knoflookteen", "garlic"]),
  wortel: m(41, 0.9, 10, 4.7, 0.2, 0, 2.8, 69, { vitA: 835, vitK: 13, kalium: 320, vitC: 5.9 }, ["wortelen", "worteltjes", "peen"]),
  paprika: m(31, 1, 6, 4.2, 0.3, 0, 2.1, 4, { vitC: 128, vitA: 157, vitB6: 0.29, vitE: 1.6 }, ["rode paprika", "gele paprika", "groene paprika"]),
  courgette: m(17, 1.2, 3.1, 2.5, 0.3, 0.1, 1, 8, { vitC: 18, vitK: 4, kalium: 261 }, ["zucchini"]),
  aubergine: m(25, 1, 5.9, 3.5, 0.2, 0, 3, 2, { kalium: 229, vitK: 3.5 }, ["aubergines"]),
  broccoli: m(34, 2.8, 6.6, 1.7, 0.4, 0.1, 2.6, 33, { vitC: 89, vitK: 102, vitB9: 63, kalium: 316, calcium: 47 }, []),
  spinazie: m(23, 2.9, 3.6, 0.4, 0.4, 0.1, 2.2, 79, { vitK: 483, vitA: 469, vitB9: 194, ijzer: 2.7, magnesium: 79, vitC: 28 }, ["bladspinazie"]),
  champignons: m(22, 3.1, 3.3, 2, 0.3, 0, 1, 5, { vitB2: 0.4, vitB3: 3.6, vitD: 0.2, kalium: 318, selenium: 9 }, ["champignon", "paddenstoelen", "kastanjechampignons"]),
  prei: m(61, 1.5, 14, 3.9, 0.3, 0, 1.8, 20, { vitK: 47, vitA: 83, vitC: 12 }, []),
  bloemkool: m(25, 1.9, 5, 1.9, 0.3, 0.1, 2, 30, { vitC: 48, vitK: 15, vitB9: 57 }, []),
  sla: m(15, 1.4, 2.9, 0.8, 0.2, 0, 1.3, 28, { vitA: 370, vitK: 126, vitB9: 38 }, ["ijsbergsla", "kropsla", "rucola", "veldsla", "salade"]),
  komkommer: m(15, 0.7, 3.6, 1.7, 0.1, 0, 0.5, 2, { vitK: 16, kalium: 147 }, ["komkommers"]),
  maïs: m(86, 3.3, 19, 3.2, 1.2, 0.2, 2.7, 15, { vitB9: 42, magnesium: 37, vitC: 6.8 }, ["mais", "maiskorrels"]),
  selder: m(16, 0.7, 3, 1.3, 0.2, 0, 1.6, 80, { vitK: 29, kalium: 260 }, ["selderij", "bleekselder"]),

  // Fruit
  appel: m(52, 0.3, 14, 10, 0.2, 0, 2.4, 1, { vitC: 4.6, kalium: 107 }, ["appels"]),
  banaan: m(89, 1.1, 23, 12, 0.3, 0.1, 2.6, 1, { vitB6: 0.37, vitC: 8.7, kalium: 358, magnesium: 27 }, ["bananen"]),
  citroen: m(29, 1.1, 9.3, 2.5, 0.3, 0, 2.8, 2, { vitC: 53, kalium: 138 }, ["citroensap", "limoen", "limoensap"]),
  sinaasappel: m(47, 0.9, 12, 9.4, 0.1, 0, 2.4, 0, { vitC: 53, vitB9: 30, calcium: 40, kalium: 181 }, ["sinaasappelsap", "mandarijn"]),
  aardbeien: m(32, 0.7, 7.7, 4.9, 0.3, 0, 2, 1, { vitC: 59, vitB9: 24, kalium: 153 }, ["aardbei", "frambozen", "bosbessen", "rood fruit"]),
  avocado: m(160, 2, 8.5, 0.7, 15, 2.1, 6.7, 7, { vitK: 21, vitB9: 81, vitE: 2.1, kalium: 485 }, ["avocado's"]),

  // Vetten, sauzen & rest
  olijfolie: m(884, 0, 0, 0, 100, 14, 0, 2, { vitE: 14, vitK: 60 }, ["olijf olie", "extra vierge olijfolie", "olive oil"]),
  olie: m(884, 0, 0, 0, 100, 10, 0, 0, { vitE: 15 }, ["zonnebloemolie", "arachideolie", "plantaardige olie", "sesamolie", "koolzaadolie", "bakolie"]),
  suiker: m(387, 0, 100, 100, 0, 0, 0, 1, {}, ["kristalsuiker", "bruine suiker", "poedersuiker", "rietsuiker"]),
  honing: m(304, 0.3, 82, 82, 0, 0, 0.2, 4, { vitC: 0.5 }, ["ahornsiroop", "siroop"]),
  zout: m(0, 0, 0, 0, 0, 0, 0, 38758, {}, ["zeezout", "keukenzout", "peper en zout"]),
  sojasaus: m(53, 8, 4.9, 0.4, 0.6, 0.1, 0.8, 5493, {}, ["soyasaus", "sojasaus zoutarm"]),
  mayonaise: m(680, 1, 0.6, 0.6, 75, 11, 0, 635, { vitK: 163 }, ["mayo"]),
  ketchup: m(101, 1.3, 26, 22, 0.1, 0, 0.3, 907, { vitC: 4 }, []),
  mosterd: m(66, 4, 5, 1, 3.3, 0.2, 3.3, 1135, {}, []),
  bouillon: m(7, 0.5, 0.6, 0.2, 0.2, 0.1, 0, 350, {}, ["kippenbouillon", "groentebouillon", "runderbouillon", "bouillonblokje", "fond"]),
  kokosmelk: m(197, 2, 2.8, 2.8, 21, 18, 0, 13, { ijzer: 3.3, magnesium: 37 }, ["kokosroom"]),
  chocolade: m(546, 4.9, 61, 48, 31, 19, 3.4, 24, { ijzer: 8, magnesium: 146 }, ["pure chocolade", "chocola", "cacao"]),
  wijn: m(83, 0.1, 2.6, 0.6, 0, 0, 0, 4, { kalium: 127 }, ["witte wijn", "rode wijn", "kookwijn"]),
  kruiden: m(20, 2, 3, 0.2, 0.4, 0.1, 2, 20, { vitK: 100, vitC: 20, ijzer: 2 }, ["peterselie", "basilicum", "tijm", "rozemarijn", "oregano", "koriander", "bieslook", "dille", "laurier", "verse kruiden", "provençaalse kruiden", "italiaanse kruiden", "peper", "paprikapoeder", "kerriepoeder", "komijn", "kaneel", "nootmuskaat", "chilipoeder", "currypoeder"]),
};

/** Standaardgewicht in gram voor eenheden zonder massa. */
const EENHEID_GRAM: Record<string, number> = {
  g: 1,
  gram: 1,
  kg: 1000,
  ml: 1,
  cl: 10,
  l: 1000,
  liter: 1000,
  el: 15,
  eetlepel: 15,
  tl: 5,
  theelepel: 5,
  snuf: 1,
  snufje: 1,
};

/** Standaardgewicht per stuk voor courante ingrediënten (in gram). */
const STUK_GRAM: Record<string, number> = {
  ei: 55,
  ui: 110,
  knoflook: 4,
  tomaat: 120,
  wortel: 70,
  paprika: 150,
  courgette: 200,
  aubergine: 250,
  aardappel: 150,
  zoeteAardappel: 180,
  appel: 180,
  banaan: 120,
  citroen: 70,
  sinaasappel: 140,
  avocado: 150,
  prei: 130,
  kip: 150,
  brood: 35,
  champignons: 20,
  komkommer: 300,
};

const STANDAARD_STUK = 100;

/** Zoekindex: canonieke naam + aliassen, langste eerst zodat "zoete aardappel" wint van "aardappel". */
const INDEX: { term: string; sleutel: string }[] = (() => {
  const rows: { term: string; sleutel: string }[] = [];
  for (const [sleutel, item] of Object.entries(TABEL)) {
    const basis = sleutel.replace(/([A-Z])/g, " $1").toLowerCase().trim();
    rows.push({ term: basis, sleutel });
    for (const a of item.aliassen ?? []) rows.push({ term: a.toLowerCase(), sleutel });
  }
  return rows.sort((a, b) => b.term.length - a.term.length);
})();

function normaliseer(naam: string) {
  return naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u0301]/g, "")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Zoekt de canonieke sleutel voor een ingrediëntnaam, of null. */
export function canoniek(naam: string): string | null {
  const n = normaliseer(naam);
  if (!n) return null;
  for (const rij of INDEX) {
    const t = normaliseer(rij.term);
    if (!t) continue;
    if (n === t || n.includes(t) || n.includes(`${t}en`) || n.includes(`${t}s`)) return rij.sleutel;
  }
  return null;
}

/** Zet hoeveelheid + eenheid om naar gram voor dit ingrediënt. */
export function naarGram(quantity: number, unit: string, sleutel: string | null): number | null {
  const u = normaliseer(unit);
  if (!u || u.startsWith("stuk") || u.startsWith("teen")) {
    const perStuk = u.startsWith("teen")
      ? (STUK_GRAM["knoflook"] ?? 4)
      : (sleutel ? STUK_GRAM[sleutel] : undefined) ?? STANDAARD_STUK;
    return quantity * perStuk;
  }
  const factor = EENHEID_GRAM[u];
  if (factor === undefined) return null;
  return quantity * factor;
}

export type VoedingIngredient = { name: string; quantity: number | null; unit: string };

export type VoedingResultaat = {
  /** Waarden per portie, of null wanneer er te weinig gegevens zijn. */
  perPortie: Voeding | null;
  /** Aantal ingrediënten dat meetelde. */
  geteld: number;
  totaal: number;
  /** Namen die we niet konden inschatten. */
  ontbrekend: string[];
  /** true zodra niet alles meetelt — dan tonen we "geschat". */
  geschat: boolean;
};

const LEEG: Macro = {
  kcal: 0, eiwit: 0, koolhydraten: 0, suikers: 0, vet: 0, verzadigd: 0, vezels: 0, natrium: 0,
};

/** Berekent de voedingswaarde per portie, volledig lokaal. */
export function berekenVoeding(
  ingredienten: VoedingIngredient[],
  porties: number,
): VoedingResultaat {
  const som: Macro = { ...LEEG };
  const micro: Micro = {};
  const ontbrekend: string[] = [];
  let geteld = 0;

  for (const ing of ingredienten) {
    const naam = (ing.name ?? "").trim();
    if (!naam) continue;
    const sleutel = canoniek(naam);
    const gram = ing.quantity === null || ing.quantity <= 0 ? null : naarGram(ing.quantity, ing.unit, sleutel);
    if (!sleutel || gram === null) {
      ontbrekend.push(naam);
      continue;
    }
    const item = TABEL[sleutel]!;
    const f = gram / 100;
    som.kcal += item.kcal * f;
    som.eiwit += item.eiwit * f;
    som.koolhydraten += item.koolhydraten * f;
    som.suikers += item.suikers * f;
    som.vet += item.vet * f;
    som.verzadigd += item.verzadigd * f;
    som.vezels += item.vezels * f;
    som.natrium += item.natrium * f;
    for (const [k, v] of Object.entries(item.micro ?? {}) as [MicroSleutel, number][]) {
      micro[k] = (micro[k] ?? 0) + v * f;
    }
    geteld += 1;
  }

  const totaal = ingredienten.filter((i) => (i.name ?? "").trim()).length;
  const delers = Math.max(1, porties);
  const genoeg = geteld >= 2 && geteld / Math.max(1, totaal) >= 0.5;

  if (!genoeg) {
    return { perPortie: null, geteld, totaal, ontbrekend, geschat: true };
  }

  const perPortie: Voeding = {
    kcal: som.kcal / delers,
    eiwit: som.eiwit / delers,
    koolhydraten: som.koolhydraten / delers,
    suikers: som.suikers / delers,
    vet: som.vet / delers,
    verzadigd: som.verzadigd / delers,
    vezels: som.vezels / delers,
    natrium: som.natrium / delers,
    micro: Object.fromEntries(
      (Object.entries(micro) as [MicroSleutel, number][]).map(([k, v]) => [k, v / delers]),
    ) as Micro,
  };

  return { perPortie, geteld, totaal, ontbrekend, geschat: geteld < totaal };
}

/** Zout in gram uit natrium in mg. */
export function zoutGram(natriumMg: number) {
  return (natriumMg * 2.5) / 1000;
}

export function rond(n: number, decimalen = 0) {
  const f = 10 ** decimalen;
  return Math.round(n * f) / f;
}

export function toonGetal(n: number) {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(rond(n, 1));
  return String(rond(n, n < 1 ? 2 : 1));
}
