/**
 * Kookassistent — korte kookvragen zonder AI. Een vaste lijst met de vragen die het vaakst
 * terugkomen, in gewone taal en met Belgische maten. Geen gezondheidsadvies: vragen over allergie,
 * dieet of ziekte krijgen een vaste, voorzichtige zin.
 */
import { normaliseerTekst } from "@/lib/zoeken";

type Antwoord = { woorden: string[][]; antwoord: string };

/** Elke groep woorden moet voorkomen (EN tussen de groepen, OF binnen een groep). */
const ANTWOORDEN: Antwoord[] = [
  {
    woorden: [
      ["ei", "eieren", "eitje"],
      ["koken", "kook", "hard", "zacht", "lang"],
    ],
    antwoord:
      "Leg de eieren in kokend water. Zacht: 6 minuten. Wasmoe: 8 minuten. Hard: 10 minuten. Daarna even onder koud water.",
  },
  {
    woorden: [
      ["pasta", "spaghetti", "penne", "macaroni"],
      ["hoeveel", "persoon", "per"],
    ],
    antwoord: "Reken 100 g droge pasta per persoon als hoofdgerecht, 60 à 70 g voor kinderen.",
  },
  {
    woorden: [["rijst"], ["hoeveel", "persoon", "per"]],
    antwoord: "Reken 75 à 80 g droge rijst per persoon.",
  },
  {
    woorden: [["rijst"], ["koken", "kook", "water", "lang"]],
    antwoord:
      "Spoel de rijst, neem 1,5 keer zoveel water als rijst, breng aan de kook en laat 12 à 15 minuten zacht garen met het deksel op. Daarna 5 minuten laten rusten.",
  },
  {
    woorden: [
      ["aardappel", "aardappelen", "patatten"],
      ["koken", "kook", "lang", "gaar"],
    ],
    antwoord:
      "Kook stukken aardappel 15 à 20 minuten in water met wat zout. Gaar als een mes er zonder weerstand in gaat.",
  },
  {
    woorden: [["hetelucht", "heteluchtoven", "ventilatie", "boven en onder", "onder en boven"]],
    antwoord:
      "Bij hetelucht zet je de oven ongeveer 20 °C lager dan bij boven- en onderwarmte. 200 °C boven/onder is dus ongeveer 180 °C hetelucht.",
  },
  {
    woorden: [["oven"], ["voorverwarmen", "voorverwarm", "opwarmen", "warm"]],
    antwoord:
      "Verwarm de oven 10 à 15 minuten voor. Zo begint je gerecht meteen op de juiste temperatuur.",
  },
  {
    woorden: [
      ["zout", "zouter", "gezouten"],
      ["te", "veel", "teveel"],
    ],
    antwoord:
      "Te zout? Voeg meer van de rest toe (water, room, groenten of aardappel), of een scheutje citroensap of een snuifje suiker om het te verzachten.",
  },
  {
    woorden: [
      ["pikant", "heet", "scherp", "pittig"],
      ["te", "veel", "teveel"],
    ],
    antwoord:
      "Te pikant? Roer er yoghurt, kokosmelk of room door, of serveer met rijst of brood. Een kneepje limoen helpt ook.",
  },
  {
    woorden: [
      ["saus", "soep", "jus"],
      ["dun", "binden", "dikker", "lopend"],
    ],
    antwoord:
      "Saus te dun? Roer 1 el maïzena door 2 el koud water en roer dat in de kokende saus. Laat 1 minuut doorkoken.",
  },
  {
    woorden: [
      ["kip", "kipfilet", "gevogelte"],
      ["gaar", "temperatuur", "kern", "roze"],
    ],
    antwoord:
      "Kip is gaar bij 74 °C in de kern. Zonder thermometer: het vlees is wit en het sap loopt helder.",
  },
  {
    woorden: [
      ["vlees", "steak", "biefstuk", "gebraad"],
      ["rusten", "rust"],
    ],
    antwoord:
      "Laat vlees na het bakken 5 minuten rusten onder aluminiumfolie. Zo blijft het sappig.",
  },
  {
    woorden: [
      ["restje", "restjes", "overschot", "bewaren"],
      ["koelkast", "lang", "hoelang", "bewaren"],
    ],
    antwoord:
      "Laat restjes snel afkoelen en zet ze afgedekt in de koelkast. Eet ze binnen 2 à 3 dagen op, of vries ze in.",
  },
  {
    woorden: [["invriezen", "diepvries", "vriezen", "ontdooien"]],
    antwoord:
      "Vries in porties in en schrijf de datum erop. Ontdooi in de koelkast, niet op het aanrecht. Wat ontdooid is, vries je niet opnieuw in.",
  },
  {
    woorden: [
      ["ui", "uien", "ajuin"],
      ["tranen", "huilen", "snijden"],
    ],
    antwoord:
      "Gebruik een scherp mes en zet de ui eerst 10 minuten in de koelkast. Dan heb je minder last van tranen.",
  },
  {
    woorden: [["eetlepel", "el", "theelepel", "tl", "ml", "lepel"]],
    antwoord:
      "1 eetlepel (el) is ongeveer 15 ml, 1 theelepel (tl) ongeveer 5 ml. 1 kopje is ongeveer 250 ml.",
  },
  {
    woorden: [
      ["look", "knoflook"],
      ["teen", "teentje", "hoeveel", "gedroogd", "poeder"],
    ],
    antwoord: "1 teentje look is ongeveer ½ theelepel geperste look of ⅛ theelepel lookpoeder.",
  },
  {
    woorden: [["kruiden"], ["gedroogd", "gedroogde", "vers", "verse"]],
    antwoord:
      "Gedroogde kruiden zijn sterker: neem ongeveer een derde van de hoeveelheid verse kruiden.",
  },
];

const GEZONDHEID = [
  "allerg",
  "intoleran",
  "zwanger",
  "diabet",
  "suikerziekte",
  "ziek",
  "medicijn",
  "dokter",
  "baby",
  "veilig voor",
];

export const GEZONDHEID_ANTWOORD =
  "Over allergieën, gezondheid en wat jij mag eten geeft Foodlo geen persoonlijk advies. Kijk naar de waarschuwing bij het recept, lees altijd het etiket en vraag het bij twijfel aan je arts.";

export const GEEN_ANTWOORD =
  'Daar heeft Foodlo nog geen vast antwoord op. Probeer het korter, bijvoorbeeld "hoe lang eieren koken" of "saus te dun".';

/** Vaste kookhulp. `null` = geen vast antwoord. */
export function regelAntwoord(vraag: string): string | null {
  const n = ` ${normaliseerTekst(vraag)} `;
  if (!n.trim()) return null;
  if (GEZONDHEID.some((g) => n.includes(g))) return GEZONDHEID_ANTWOORD;
  const heeft = (w: string) =>
    n.includes(` ${normaliseerTekst(w)} `) || (w.length > 4 && n.includes(normaliseerTekst(w)));
  const treffer = ANTWOORDEN.find((a) => a.woorden.every((groep) => groep.some(heeft)));
  return treffer?.antwoord ?? null;
}

/** Voorbeeldvragen voor de knopjes in het paneel. */
export const VOORBEELDVRAGEN = [
  "Hoe lang eieren koken?",
  "Mijn saus is te dun",
  "Hetelucht of boven en onder?",
];
