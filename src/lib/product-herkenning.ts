import { normaliseerTekst } from "@/lib/zoeken";
import { stam } from "@/lib/stap-ingredienten";

/**
 * Centrale productherkenning voor heel Foodlo.
 *
 * Eén engine voor recept, weekmenu, handmatige invoer, voorraad en gedeelde
 * lijsten. Doel: "1 teentje look" en "1 bussel look" zijn hetzelfde product,
 * maar "melk" en "amandelmelk" zijn dat niet.
 *
 * Regels:
 * - synoniemen en meertaligheid (NL/FR/DE/EN) vallen samen op één canonieke naam;
 * - woordvolgorde en meervouden doen er niet toe ("rijpe tomaten" = "tomaat");
 * - varianten met een betekenisvol woord blijven apart ("rode ui" ≠ "ui",
 *   "kerstomaat" ≠ "tomaat", "amandelmelk" ≠ "melk");
 * - geen AI, volledig deterministisch.
 */

/** Synoniemen → canonieke vorm. Sleutels zijn genormaliseerd (kleine letters, geen accenten). */
const SYNONIEMEN: Record<string, string> = {
  // look / knoflook
  look: "knoflook", knoflook: "knoflook", garlic: "knoflook", ail: "knoflook", knoblauch: "knoflook",
  knoflookteen: "knoflook", knoflookteentje: "knoflook", knoflookteentjes: "knoflook",
  // ui
  ui: "ui", uien: "ui", ajuin: "ui", ajuinen: "ui", onion: "ui", onions: "ui", oignon: "ui", oignons: "ui", zwiebel: "ui", zwiebeln: "ui",
  sjalot: "sjalot", sjalotje: "sjalot", sjalotjes: "sjalot", shallot: "sjalot", shallots: "sjalot", echalote: "sjalot",
  // tomaat
  tomaat: "tomaat", tomaten: "tomaat", tomato: "tomaat", tomatoes: "tomaat", tomate: "tomaat", tomates: "tomaat", tomateN: "tomaat",
  // aardappel
  aardappel: "aardappel", aardappelen: "aardappel", aardappels: "aardappel", patat: "aardappel", pataten: "aardappel",
  potato: "aardappel", potatoes: "aardappel", "pomme de terre": "aardappel", "pommes de terre": "aardappel", kartoffel: "aardappel", kartoffeln: "aardappel",
  // wortel
  wortel: "wortel", wortelen: "wortel", wortels: "wortel", worteltje: "wortel", worteltjes: "wortel",
  carrot: "wortel", carrots: "wortel", carotte: "wortel", carottes: "wortel", karotte: "wortel", mohrrube: "wortel",
  // paprika
  paprika: "paprika", "paprika's": "paprika", "bell pepper": "paprika", "bell peppers": "paprika", poivron: "paprika", poivrons: "paprika",
  // courgette
  courgette: "courgette", courgettes: "courgette", zucchini: "courgette", zucchine: "courgette",
  // aubergine
  aubergine: "aubergine", aubergines: "aubergine", eggplant: "aubergine", eggplants: "aubergine",
  // prei
  prei: "prei", preien: "prei", leek: "prei", leeks: "prei", poireau: "prei", poireaux: "prei", lauch: "prei",
  // selder
  selder: "selderij", selderij: "selderij", bleekselderij: "selderij", celery: "selderij", celeri: "selderij", sellerie: "selderij",
  // champignon
  champignon: "champignon", champignons: "champignon", paddestoel: "champignon", paddestoelen: "champignon",
  mushroom: "champignon", mushrooms: "champignon", "champignon de paris": "champignon", pilz: "champignon", pilze: "champignon",
  // melk & co (varianten bewust NIET naar melk: amandelmelk blijft apart)
  melk: "melk", milk: "melk", lait: "melk", milch: "melk",
  room: "room", cream: "room", creme: "room", "creme fraiche": "room", sahne: "room",
  boter: "boter", butter: "boter", beurre: "boter",
  kaas: "kaas", cheese: "kaas", fromage: "kaas", kase: "kaas",
  yoghurt: "yoghurt", yogurt: "yoghurt", yaourt: "yoghurt", joghurt: "yoghurt",
  ei: "ei", eieren: "ei", eitje: "ei", eitjes: "ei", egg: "ei", eggs: "ei", oeuf: "ei", oeufs: "ei",
  // bloem / suiker / brood
  bloem: "bloem", flour: "bloem", farine: "bloem", mehl: "bloem",
  suiker: "suiker", sugar: "suiker", sucre: "suiker", zucker: "suiker",
  brood: "brood", bread: "brood", pain: "brood", brot: "brood",
  rijst: "rijst", rice: "rijst", riz: "rijst", reis: "rijst",
  // kip / vlees / vis
  kip: "kip", kippen: "kip", chicken: "kip", poulet: "kip", hahnchen: "kip", huhn: "kip",
  gehakt: "gehakt", "minced meat": "gehakt", hachis: "gehakt", hackfleisch: "gehakt",
  rundvlees: "rundvlees", beef: "rundvlees", boeuf: "rundvlees", rindfleisch: "rundvlees",
  varkensvlees: "varkensvlees", pork: "varkensvlees", porc: "varkensvlees", schweinefleisch: "varkensvlees",
  zalm: "zalm", salmon: "zalm", saumon: "zalm", lachs: "zalm",
  tonijn: "tonijn", tuna: "tonijn", thon: "tonijn", thunfisch: "tonijn",
  garnaal: "garnaal", garnalen: "garnaal", shrimp: "garnaal", shrimps: "garnaal", crevette: "garnaal", crevettes: "garnaal",
  // kruiden & specerijen
  peterselie: "peterselie", parsley: "peterselie", persil: "peterselie", petersilie: "peterselie",
  basilicum: "basilicum", basil: "basilicum", basilic: "basilicum", basilikum: "basilicum",
  tijm: "tijm", thyme: "tijm", thym: "tijm", thymian: "tijm",
  rozemarijn: "rozemarijn", rosemary: "rozemarijn", romarin: "rozemarijn", rosmarin: "rozemarijn",
  oregano: "oregano", origan: "oregano",
  koriander: "koriander", cilantro: "koriander", coriander: "koriander", coriandre: "koriander",
  peper: "peper", pepper: "peper", poivre: "peper", pfeffer: "peper",
  zout: "zout", salt: "zout", sel: "zout", salz: "zout",
  kaneel: "kaneel", cinnamon: "kaneel", cannelle: "kaneel", zimt: "kaneel",
  komijn: "komijn", cumin: "komijn", kreuzkummel: "komijn",
  kurkuma: "kurkuma", turmeric: "kurkuma", curcuma: "kurkuma",
  gember: "gember", ginger: "gember", gingembre: "gember", ingwer: "gember",
  chilipeper: "chilipeper", chili: "chilipeper", chilli: "chilipeper", piment: "chilipeper",
  laurier: "laurier", laurierblad: "laurier", "bay leaf": "laurier", "bay leaves": "laurier", lorbeer: "laurier", lorbeerblatt: "laurier",
  // olie & azijn
  olijfolie: "olijfolie", "olive oil": "olijfolie", "huile d'olive": "olijfolie", olivenol: "olijfolie",
  olie: "olie", oil: "olie", huile: "olie",
  azijn: "azijn", vinegar: "azijn", vinaigre: "azijn", essig: "azijn",
  // pasta & deegwaren
  spaghetti: "spaghetti", penne: "penne", macaroni: "macaroni", lasagne: "lasagne", lasagnebladen: "lasagne",
  tagliatelle: "tagliatelle", fusilli: "fusilli", farfalle: "farfalle",
  // bonen & peulvruchten
  bonen: "boon", boon: "boon", bean: "boon", beans: "boon", haricot: "boon", haricots: "boon", bohne: "boon", bohnen: "boon",
  linzen: "linze", linze: "linze", lentil: "linze", lentils: "linze", lentille: "linze", lentilles: "linze", linse: "linze", linsen: "linze",
  kikkererwten: "kikkererwt", kikkererwt: "kikkererwt", chickpea: "kikkererwt", chickpeas: "kikkererwt", "pois chiche": "kikkererwt", "pois chiches": "kikkererwt",
  erwten: "erwt", erwt: "erwt", doperwt: "erwt", doperwten: "erwt", pea: "erwt", peas: "erwt", "petit pois": "erwt", "petits pois": "erwt", erbse: "erwt", erbsen: "erwt",
  // groenten verder
  broccoli: "broccoli", bloemkool: "bloemkool", cauliflower: "bloemkool", "chou-fleur": "bloemkool", blumenkohl: "bloemkool",
  spinazie: "spinazie", spinach: "spinazie", epinard: "spinazie", epinards: "spinazie", spinat: "spinazie",
  sla: "sla", lettuce: "sla", laitue: "sla", salat: "sla",
  komkommer: "komkommer", cucumber: "komkommer", concombre: "komkommer", gurke: "komkommer",
  witloof: "witloof", witlof: "witloof", chicory: "witloof", endive: "witloof", chicoree: "witloof",
  pompoen: "pompoen", pumpkin: "pompoen", potiron: "pompoen", kurbis: "pompoen",
  zoete: "", // bewerkerswoord, geen eigen product
  // fruit
  appel: "appel", appels: "appel", apple: "appel", apples: "appel", pomme: "appel", pommes: "appel", apfel: "appel",
  banaan: "banaan", bananen: "banaan", banana: "banaan", bananas: "banaan", banane: "banaan", bananes: "banaan",
  citroen: "citroen", citroenen: "citroen", lemon: "citroen", lemons: "citroen", zitrone: "citroen",
  limoen: "limoen", lime: "limoen", limes: "limoen", "citron vert": "limoen", limette: "limoen",
  sinaasappel: "sinaasappel", orange: "sinaasappel", oranges: "sinaasappel", apfelsine: "sinaasappel",
  aardbei: "aardbei", aardbeien: "aardbei", strawberry: "aardbei", strawberries: "aardbei", fraise: "aardbei", fraises: "aardbei", erdbeere: "aardbei", erdbeeren: "aardbei",
  // noten & zaden
  pijnboompitten: "pijnboompit", pijnboompit: "pijnboompit", "pine nut": "pijnboompit", "pine nuts": "pijnboompit", "pignon de pin": "pijnboompit",
  amandel: "amandel", amandelen: "amandel", almond: "amandel", almonds: "amandel", amande: "amandel", amandes: "amandel", mandel: "amandel", mandeln: "amandel",
  walnoot: "walnoot", walnoten: "walnoot", walnut: "walnoot", walnuts: "walnoot", noix: "walnoot", walnuss: "walnoot",
  sesamzaad: "sesamzaad", sesam: "sesamzaad", sesame: "sesamzaad", "sesame seeds": "sesamzaad",
  // huishoud (niet-eten)
  toiletpapier: "toiletpapier", "toilet papier": "toiletpapier", "wc papier": "toiletpapier", "wc-papier": "toiletpapier", "toilet paper": "toiletpapier", "papier toilette": "toiletpapier",
  afwasmiddel: "afwasmiddel", "dish soap": "afwasmiddel", "dishwashing liquid": "afwasmiddel", "liquide vaisselle": "afwasmiddel", spulmittel: "afwasmiddel",
  wasmiddel: "wasmiddel", detergent: "wasmiddel", lessive: "wasmiddel", waschmittel: "wasmiddel",
  keukenpapier: "keukenpapier", "keukenrol": "keukenpapier", "paper towel": "keukenpapier", "paper towels": "keukenpapier", "essuie-tout": "keukenpapier", kuchenrolle: "keukenpapier",
  // dranken
  water: "water", eau: "water", wasser: "water",
  koffie: "koffie", coffee: "koffie", cafe: "koffie", kaffee: "koffie",
  thee: "thee", tea: "thee", the: "thee", tee: "thee",
  wijn: "wijn", wine: "wijn", vin: "wijn", wein: "wijn",
  bier: "bier", beer: "bier", biere: "bier",
  frisdrank: "frisdrank", soda: "frisdrank", limonade: "frisdrank",
  // sauzen & basis
  mayonaise: "mayonaise", mayo: "mayonaise",
  ketchup: "ketchup", "tomato ketchup": "ketchup",
  mosterd: "mosterd", mustard: "mosterd", moutarde: "mosterd", senf: "mosterd",
  sojasaus: "sojasaus", "soy sauce": "sojasaus", "sauce soja": "sojasaus", sojasauce: "sojasaus",
  tomatenpuree: "tomatenpuree", "tomato paste": "tomatenpuree", "tomato puree": "tomatenpuree", "concentre de tomate": "tomatenpuree", tomatenmark: "tomatenpuree",
  passata: "passata", "tomatenpassata": "passata",
  bouillon: "bouillon", stock: "bouillon", broth: "bouillon", bruhe: "bouillon",
  bouillonblokje: "bouillonblokje", bouillonblokjes: "bouillonblokje", "stock cube": "bouillonblokje", "stock cubes": "bouillonblokje",
  honing: "honing", honey: "honing", miel: "honing", honig: "honing",
  // broodbeleg & ontbijt
  hagelslag: "hagelslag", jam: "jam", confiture: "jam", marmelade: "jam",
  pindakaas: "pindakaas", "peanut butter": "pindakaas", "beurre de cacahuete": "pindakaas", erdnussbutter: "pindakaas",
  choco: "chocopasta", chocopasta: "chocopasta", nutella: "chocopasta", "chocolate spread": "chocopasta", "pate a tartiner": "chocopasta",
  muesli: "muesli", granola: "granola", cornflakes: "cornflakes", ontbijtgranen: "ontbijtgranen", cereal: "ontbijtgranen", cereals: "ontbijtgranen",
  havermout: "havermout", oats: "havermout", oatmeal: "havermout", "flocon d'avoine": "havermout", "flocons d'avoine": "havermout", haferflocken: "havermout",
  // kaassoorten die vaak voorkomen
  mozzarella: "mozzarella", parmezaan: "parmezaan", "parmezaanse kaas": "parmezaan", parmesan: "parmezaan", parmigiano: "parmezaan",
  feta: "feta", gorgonzola: "gorgonzola", ricotta: "ricotta", mascarpone: "mascarpone", cheddar: "cheddar", gruyere: "gruyere",
  // tofu & vleesvervangers
  tofu: "tofu", tempeh: "tempeh", seitan: "seitan",
};

/** Woorden die geen eigen product betekenen en bij de sleutel genegeerd worden. */
const BIJWOORDEN = new Set([
  "vers", "verse", "fijn", "fijne", "fijngesneden", "gesneden", "gehakt", "gemalen",
  "grof", "grove", "gedroogd", "gedroogde", "groot", "grote", "klein", "kleine",
  "rijpe", "rijp", "biologisch", "biologische", "bio", "volle", "halfvolle", "magere",
  "licht", "light", "extra", "beetje", "snuf", "naar", "smaak", "eventueel",
  "gekookt", "gekookte", "gebakken", "geroosterd", "geroosterde", "geraspt", "geraspte",
  "ontpitte", "ontpit", "geschild", "geschildde", "rauw", "rauwe", "diepvries",
  "verse", "half", "halve", "heel", "hele", "stuk", "stukje", "stukjes",
  "de", "het", "een", "van", "met", "en", "of", "in", "op", "voor", "uit",
]);

/**
 * Woord dat een eigen variant aanduidt: dit mag nooit wegvallen, anders zou
 * "rode ui" op "ui" vallen. Deze woorden blijven dus altijd in de sleutel.
 */
function canoniekWoord(woord: string): string {
  const w = stam(woord);
  return SYNONIEMEN[w] ?? SYNONIEMEN[woord] ?? w;
}

/** WP5: "Diepvriesspinazie (i.p.v. spinazie)" — vervangen in de winkel, zie `vervanging`. */
const IPV = /\s*\((?:i\.?\s?p\.?\s?v\.?|in plaats van)\s+([^)]+)\)\s*$/i;

/**
 * Een product dat in de winkel vervangen werd, draagt het oorspronkelijke product in de naam
 * mee. Zo blijft het voor de geplande maaltijd, de voorraad en "wat ontbreekt" hetzelfde product,
 * zonder extra kolom in de databank.
 */
export function vervanging(naam: string): { naam: string; voor: string | null } {
  const m = IPV.exec(naam);
  if (!m) return { naam: naam.trim(), voor: null };
  return { naam: naam.slice(0, m.index).trim(), voor: m[1]!.trim() || null };
}

/** Naam voor een vervangen product: "Diepvriesspinazie (i.p.v. spinazie)". */
export function vervangNaam(nieuw: string, oud: string): string {
  const oorspronkelijk = vervanging(oud);
  const voor = oorspronkelijk.voor ?? oorspronkelijk.naam;
  const eigen = vervanging(nieuw).naam;
  return zelfdeProduct(eigen, voor) ? eigen : `${eigen} (i.p.v. ${voor})`;
}

/** Canonieke productnaam: synoniemen samengebracht, bijwoorden weg, volgorde geneutraliseerd. */
export function canoniekeNaam(name: string): string {
  const ruw = normaliseerTekst(vervanging(name).naam).split(" ").filter(Boolean);
  const alle = ruw.map(canoniekWoord).filter(Boolean);
  // Bijwoord herkennen vóór én na de stam ("diepvries" werd anders "diepvrie" en bleef staan).
  const zonderBijwoorden = ruw
    .filter((w) => !BIJWOORDEN.has(w))
    .map(canoniekWoord)
    .filter((w) => w && !BIJWOORDEN.has(w));
  // Is de naam zélf een bijwoord ("gehakt", "light")? Dan is dat het product: anders
  // werd de sleutel leeg en herkende Foodlo "gehakt" op de lijst nooit (dubbel aanvullen).
  const woorden = zonderBijwoorden.length ? zonderBijwoorden : alle;
  // uniek houden en sorteren zodat "rijpe tomaten" en "tomaat" samenvallen
  return [...new Set(woorden)].sort().join(" ");
}

/** Toonvorm: de canonieke naam met hoofdletter, voor samengevoegde items. */
export function canoniekeTitel(name: string): string {
  const c = canoniekeNaam(name);
  if (!c) return name.trim();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** Zelfde product? (ongeacht eenheid — "1 bussel look" en "2 teentjes look" = zelfde product) */
export function zelfdeProduct(a: string, b: string): boolean {
  const gelijk = (x: string, y: string) => {
    const kx = canoniekeNaam(x);
    return kx !== "" && kx === canoniekeNaam(y);
  };
  if (gelijk(a, b)) return true;
  // Vervangen in de winkel: telt ook als het oorspronkelijke product.
  const va = vervanging(a).voor;
  const vb = vervanging(b).voor;
  return Boolean((va && gelijk(va, b)) || (vb && gelijk(a, vb)));
}
