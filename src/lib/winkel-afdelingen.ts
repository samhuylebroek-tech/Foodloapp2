import {
  Apple,
  Croissant,
  Milk,
  Beef,
  Sandwich,
  Wheat,
  Snowflake,
  CupSoda,
  Candy,
  SprayCan,
  Bath,
  Baby,
  type LucideIcon,
} from "lucide-react";

/**
 * Een wandeling door de supermarkt: afdelingen met typische producten.
 * Volledig lokaal — geen AI, geen credits. Belgische benamingen.
 */
export type Afdeling = { id: string; naam: string; icoon: LucideIcon; producten: string[] };

export const AFDELINGEN: Afdeling[] = [
  { id: "groenten-fruit", naam: "Groenten & fruit", icoon: Apple, producten: ["bananen", "appels", "peren", "sinaasappels", "citroen", "druiven", "aardbeien", "tomaten", "komkommer", "sla", "ajuin", "look", "wortelen", "paprika", "courgette", "broccoli", "champignons", "prei", "spinazie", "aardappelen", "avocado", "witloof"] },
  { id: "brood-bakkerij", naam: "Brood & bakkerij", icoon: Croissant, producten: ["brood", "stokbrood", "pistolets", "croissants", "sandwiches", "beschuiten", "wraps", "toastbrood", "ontbijtkoek"] },
  { id: "zuivel-eieren", naam: "Zuivel & eieren", icoon: Milk, producten: ["melk", "eieren", "boter", "yoghurt", "platte kaas", "room", "pudding", "chocomelk", "margarine", "plantaardige melk"] },
  { id: "vlees-vis", naam: "Vlees & vis", icoon: Beef, producten: ["gehakt", "kipfilet", "spek", "worsten", "biefstuk", "zalm", "kabeljauw", "scampi", "vegetarisch gehakt", "tofu"] },
  { id: "kaas-beleg", naam: "Kaas & beleg", icoon: Sandwich, producten: ["kaas", "gemalen kaas", "hesp", "salami", "préparé", "choco", "confituur", "pindakaas", "smeerkaas", "mozzarella", "parmezaan"] },
  { id: "voorraadkast", naam: "Voorraadkast", icoon: Wheat, producten: ["pasta", "rijst", "bloem", "suiker", "olijfolie", "tomatensaus", "passata", "bouillon", "koffie", "thee", "ontbijtgranen", "havermout", "mayonaise", "ketchup", "mosterd", "zout", "peper", "kikkererwten", "tonijn in blik"] },
  { id: "diepvries", naam: "Diepvries", icoon: Snowflake, producten: ["frieten", "diepvriesgroenten", "erwtjes", "pizza", "ijs", "vissticks", "diepvriesspinazie", "ijsblokjes"] },
  { id: "dranken", naam: "Dranken", icoon: CupSoda, producten: ["water", "bruiswater", "fruitsap", "cola", "bier", "wijn", "limonade", "ice tea"] },
  { id: "snoep-koek", naam: "Snoep & koek", icoon: Candy, producten: ["koekjes", "chocolade", "chips", "nootjes", "snoep", "speculoos", "wafels", "popcorn"] },
  { id: "huishouden", naam: "Huishouden", icoon: SprayCan, producten: ["wc-papier", "keukenrol", "afwasmiddel", "vaatwastabletten", "wasmiddel", "wasverzachter", "vuilniszakken", "allesreiniger", "sponsjes", "aluminiumfolie", "batterijen"] },
  { id: "verzorging", naam: "Verzorging", icoon: Bath, producten: ["tandpasta", "tandenborstel", "shampoo", "douchegel", "deodorant", "zeep", "zakdoeken", "watten", "maandverband", "scheermesjes"] },
  { id: "baby-dier", naam: "Baby & dier", icoon: Baby, producten: ["luiers", "babydoekjes", "babyvoeding", "kattenvoer", "hondenvoer", "kattenbakvulling"] },
];
