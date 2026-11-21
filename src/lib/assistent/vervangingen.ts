/**
 * Kookassistent — vaste vervangingstabel (de terugval zonder AI, werkt altijd).
 *
 * Regels:
 * - Een vervanger wordt pas getoond als hij voor **iedereen die meeëet** veilig is: geen gekozen
 *   allergeen (ook niet via de woordherkenning van `allergenen.ts`), geen dieetfout
 *   (`pastBijDieet` uit `veiligheid.ts`) en geen "liever niet"-term.
 * - Wat afvalt, staat erbij met de reden. De reden noemt alleen de allergie of het dieet als de
 *   kijker die mag zien (`magRedenZien`); anders "niet geschikt voor Lotte".
 * - Elke vervanger declareert zelf ook zijn allergenen en of hij dierlijk is. Telt de herkenning
 *   meer, dan geldt de strengste kant.
 *
 * Draait volledig op het toestel; allergieën en dieet gaan nooit naar een AI.
 */
import { allergenenIn, ALLERGENEN, type AllergeenId } from "@/lib/allergenen";
import type { Dieet } from "@/lib/kennismaking";
import { pastBijDieet } from "@/lib/veiligheid";
import { normaliseerTekst } from "@/lib/zoeken";

/** Wat zit er dierlijk in? `null` = plantaardig. */
export type Dierlijk = "vlees" | "vis" | "zuivel-ei" | "honing" | null;

export type Vervanger = {
  naam: string;
  /** Korte uitleg in gewone taal: waarom dit werkt. */
  reden: string;
  /** Hoeveel neem je? */
  verhouding: string;
  allergenen: AllergeenId[];
  dierlijk: Dierlijk;
};

type Regel = {
  /** Hoe het ingrediënt in een recept kan heten (genormaliseerd, zonder accenten). */
  woorden: string[];
  /** Woorden die erop lijken maar iets anders zijn ("kokosmelk" is geen melk). */
  niet?: string[];
  /** Toonnaam van het ingrediënt. */
  naam: string;
  vervangers: Vervanger[];
};

const v = (
  naam: string,
  reden: string,
  verhouding: string,
  allergenen: AllergeenId[] = [],
  dierlijk: Dierlijk = null,
): Vervanger => ({ naam, reden, verhouding, allergenen, dierlijk });

export const VERVANGTABEL: Regel[] = [
  {
    naam: "boter",
    woorden: ["boter", "roomboter", "bakboter"],
    niet: ["pindakaas", "boterham", "boterbonen"],
    vervangers: [
      v("Olijfolie", "Goed om in te bakken en voor groenten", "¾ van de hoeveelheid"),
      v("Zonnebloemolie", "Neutraal van smaak, ook voor gebak", "¾ van de hoeveelheid"),
      v("Margarine", "Werkt zoals boter in deeg (lees het etiket)", "evenveel"),
      v("Ghee", "Geklaarde boter: bijna geen lactose meer", "evenveel", ["melk"], "zuivel-ei"),
    ],
  },
  {
    naam: "melk",
    woorden: ["melk", "volle melk", "halfvolle melk", "magere melk"],
    niet: [
      "kokosmelk",
      "havermelk",
      "sojamelk",
      "amandelmelk",
      "rijstmelk",
      "karnemelk",
      "melkchocolade",
    ],
    vervangers: [
      v("Havermelk", "Romig en mild, goed in saus en pap", "evenveel", ["gluten"]),
      v("Sojamelk", "Veel eiwit, kookt goed", "evenveel", ["soja"]),
      v("Rijstmelk", "Licht en zoetig", "evenveel"),
      v("Amandelmelk", "Nootachtig, lekker in gebak", "evenveel", ["noten"]),
    ],
  },
  {
    naam: "room",
    woorden: ["room", "kookroom", "slagroom", "volle room", "verse room"],
    niet: ["kokosroom", "zure room", "ijsroom"],
    vervangers: [
      v("Kokosroom", "Romig en plantaardig, met een lichte kokossmaak", "evenveel"),
      v(
        "Griekse yoghurt",
        "Lichter; pas op het einde erbij, niet laten koken",
        "evenveel",
        ["melk"],
        "zuivel-ei",
      ),
      v("Gekookte aardappel, gemixt", "Maakt soep romig zonder zuivel", "1 aardappel per 100 ml"),
    ],
  },
  {
    naam: "ei",
    woorden: ["ei", "eieren", "eitje", "eitjes"],
    vervangers: [
      v(
        "Lijnzaad met water",
        "Bindt in deeg en koekjes",
        "1 el gemalen lijnzaad + 3 el water per ei",
      ),
      v("Appelmoes", "Houdt cake smeuïg", "60 g per ei"),
      v("Rijpe banaan", "Bindt en maakt zoet", "½ geprakte banaan per ei"),
    ],
  },
  {
    naam: "kaas",
    woorden: [
      "kaas",
      "geraspte kaas",
      "gemalen kaas",
      "parmezaan",
      "gruyere",
      "emmentaler",
      "cheddar",
    ],
    niet: ["pindakaas", "smeerkaas"],
    vervangers: [
      v("Edelgistvlokken", "Hartige, kaasachtige smaak", "2 el per 50 g kaas"),
      v("Paneermeel met olijfolie", "Een krokant korstje op de ovenschotel", "evenveel", [
        "gluten",
      ]),
      v("Geitenkaas", "Andere kaas, sterkere smaak", "evenveel", ["melk"], "zuivel-ei"),
    ],
  },
  {
    naam: "yoghurt",
    woorden: ["yoghurt", "griekse yoghurt", "volle yoghurt", "platte kaas", "kwark"],
    niet: ["sojayoghurt", "kokosyoghurt"],
    vervangers: [
      v("Kokosyoghurt", "Plantaardig en romig", "evenveel"),
      v("Sojayoghurt", "Plantaardig, neutraal van smaak", "evenveel", ["soja"]),
    ],
  },
  {
    naam: "bloem",
    woorden: ["bloem", "tarwebloem", "patisseriebloem", "zelfrijzende bloem"],
    niet: ["bloemkool", "maisbloem", "rijstbloem", "zonnebloem", "boekweitbloem"],
    vervangers: [
      v("Maïzena", "Om saus of soep te binden", "de helft van de hoeveelheid"),
      v("Rijstbloem", "Glutenvrij, voor pannenkoeken en paneren", "evenveel"),
      v("Boekweitbloem", "Glutenvrij, stevige smaak (galettes)", "evenveel"),
      v("Speltbloem", "Lijkt het meest op tarwebloem", "evenveel", ["gluten"]),
    ],
  },
  {
    naam: "paneermeel",
    woorden: ["paneermeel", "broodkruim"],
    vervangers: [
      v("Gemalen amandelen", "Krokant en glutenvrij", "evenveel", ["noten"]),
      v("Maïsmeel (polenta)", "Krokant korstje, glutenvrij", "evenveel"),
      v("Havervlokken, fijngemalen", "Krokant en stevig", "evenveel", ["gluten"]),
    ],
  },
  {
    naam: "pasta",
    woorden: ["pasta", "spaghetti", "penne", "tagliatelle", "macaroni", "fusilli", "linguine"],
    vervangers: [
      v("Rijstnoedels", "Glutenvrij, kort koken", "evenveel"),
      v("Courgettelinten", "Licht en snel, rauw of kort gebakken", "1 courgette per persoon"),
      v("Volkorenpasta", "Meer vezels", "evenveel", ["gluten"]),
    ],
  },
  {
    naam: "sojasaus",
    woorden: ["sojasaus", "ketjap", "ketjap manis"],
    vervangers: [
      v("Kokos-aminos", "Zoutig en zoet, zonder soja", "evenveel"),
      v("Tamari", "Sojasaus zonder tarwe", "evenveel", ["soja"]),
    ],
  },
  {
    naam: "gehakt",
    woorden: ["gehakt", "rundergehakt", "varkensgehakt", "gemengd gehakt", "kippengehakt"],
    vervangers: [
      v("Linzen", "Stevig en vol eiwit, ideaal in saus", "150 g gekookte linzen per 100 g gehakt"),
      v("Fijngehakte champignons", "Hartig en smeuïg", "evenveel"),
      v("Vegetarisch gehakt", "Lijkt het meest op gehakt (lees het etiket)", "evenveel", ["soja"]),
    ],
  },
  {
    naam: "kip",
    woorden: ["kip", "kipfilet", "kippenfilet", "kippenbouten", "kippendijen", "kippenreepjes"],
    niet: ["kippenbouillon"],
    vervangers: [
      v("Kikkererwten", "Stevig, goed in curry en wok", "100 g per persoon"),
      v("Bloemkoolroosjes", "Neemt kruiden goed op", "150 g per persoon"),
      v("Tofu", "Eiwitrijk; eerst goed laten uitlekken", "100 g per persoon", ["soja"]),
      v("Kalkoenfilet", "Ander mager vlees", "evenveel", [], "vlees"),
    ],
  },
  {
    naam: "rundvlees",
    woorden: [
      "rundvlees",
      "stoofvlees",
      "rundsstoofvlees",
      "biefstuk",
      "varkensvlees",
      "lamsvlees",
    ],
    vervangers: [
      v("Grote champignons of oesterzwammen", "Hartig en vlezig", "evenveel"),
      v("Seitan", "Stevige vleesvervanger", "evenveel", ["gluten"]),
      v("Kikkererwten", "Stevig, goed in stoofpotten", "100 g per persoon"),
    ],
  },
  {
    naam: "hesp",
    woorden: ["hesp", "ham", "gekookte hesp", "beenham", "rauwe ham", "prosciutto", "serranoham"],
    niet: ["hamburger"],
    vervangers: [
      v(
        "Gegrilde aubergineplakjes",
        "Zacht en hartig, om iets in te rollen",
        "1 plak per snee hesp",
      ),
      v("Gegrilde courgetteplakjes", "Licht en mild", "1 plak per snee hesp"),
      v("Vegetarische hesp", "Lijkt op hesp (lees het etiket)", "evenveel", ["soja"]),
    ],
  },
  {
    naam: "spekjes",
    woorden: ["spek", "spekjes", "lardons", "lardon", "bacon", "pancetta"],
    vervangers: [
      v(
        "Gerookt paprikapoeder met champignons",
        "De rooksmaak zonder vlees",
        "1 tl paprika per 100 g champignons",
      ),
      v("Gerookte tofu", "Rokerig en eiwitrijk", "evenveel", ["soja"]),
    ],
  },
  {
    naam: "vis",
    woorden: ["vis", "zalm", "zalmfilet", "kabeljauw", "tonijn", "witvis", "pangasius"],
    vervangers: [
      v("Tofu met zeewier (nori)", "Een zachte zeesmaak, plantaardig", "100 g per persoon", [
        "soja",
      ]),
      v("Kikkererwten", "Stevig, in salade of curry", "100 g per persoon"),
      v("Kipfilet", "Mager, snel gaar", "evenveel", [], "vlees"),
    ],
  },
  {
    naam: "vissaus",
    woorden: ["vissaus", "ansjovis"],
    vervangers: [
      v("Sojasaus met een kneepje limoen", "Zoutig en fris", "evenveel", ["soja", "gluten"]),
      v("Zout met een kneepje limoen", "Eenvoudig, zonder soja of vis", "een snuifje"),
    ],
  },
  {
    naam: "honing",
    woorden: ["honing"],
    vervangers: [
      v("Ahornsiroop", "Plantaardig, zoet en zacht", "evenveel"),
      v("Agavesiroop", "Plantaardig, iets zoeter", "¾ van de hoeveelheid"),
    ],
  },
  {
    naam: "suiker",
    woorden: ["suiker", "kristalsuiker", "basterdsuiker", "bruine suiker"],
    niet: ["poedersuiker"],
    vervangers: [
      v("Ahornsiroop", "Vloeibaar zoet; iets minder vocht elders", "¾ van de hoeveelheid"),
      v("Honing", "Zoeter dan suiker", "½ van de hoeveelheid", [], "honing"),
      v("Rijpe banaan", "Natuurlijk zoet in cake en pap", "1 banaan per 50 g"),
    ],
  },
  {
    naam: "pindakaas",
    woorden: ["pindakaas", "pindasaus", "satesaus"],
    vervangers: [
      v("Zonnebloempittenpasta", "Romig en nootachtig, zonder pinda", "evenveel"),
      v("Tahin", "Sesampasta, licht bitter", "evenveel", ["sesam"]),
      v("Amandelpuree", "Romig en zacht", "evenveel", ["noten"]),
    ],
  },
  {
    naam: "noten",
    woorden: [
      "noten",
      "walnoten",
      "hazelnoten",
      "amandelen",
      "cashewnoten",
      "pecannoten",
      "pijnboompitten",
    ],
    vervangers: [
      v("Zonnebloempitten", "Krokant, geroosterd het lekkerst", "evenveel"),
      v("Pompoenpitten", "Krokant en groen", "evenveel"),
      v("Geroosterde kikkererwten", "Krokant topje voor salade", "evenveel"),
    ],
  },
  {
    naam: "mosterd",
    woorden: ["mosterd", "dijonmosterd", "graanmosterd"],
    vervangers: [
      v("Mierikswortel", "Pittig, zoals mosterd", "de helft van de hoeveelheid"),
      v("Kurkuma met een scheutje azijn", "Kleur en een frisse toets", "½ tl per el mosterd"),
    ],
  },
  {
    naam: "witte wijn",
    woorden: ["witte wijn", "rode wijn", "wijn"],
    niet: ["wijnazijn"],
    vervangers: [
      v(
        "Bouillon met een scheutje citroensap",
        "Fris en hartig (bouillon kan selder bevatten)",
        "evenveel",
        ["selder"],
      ),
      v("Water met een scheutje appelazijn", "Zuur en licht, zonder alcohol", "evenveel"),
    ],
  },
  {
    naam: "bier",
    woorden: ["bier", "donker bier", "trappist", "blond bier"],
    vervangers: [
      v("Bouillon met een lepel stroop", "Hartig en zoetig, zonder alcohol", "evenveel", [
        "selder",
      ]),
      v("Alcoholvrij bier", "Zelfde smaak, geen alcohol", "evenveel", ["gluten"]),
    ],
  },
  {
    naam: "vleesbouillon",
    woorden: [
      "kippenbouillon",
      "runderbouillon",
      "vleesbouillon",
      "kippenfond",
      "kalfsfond",
      "visfond",
      "visbouillon",
    ],
    vervangers: [
      v("Groentebouillon", "Zelfde werking, plantaardig (kan selder bevatten)", "evenveel", [
        "selder",
      ]),
      v("Water met sojasaus en een laurierblad", "Hartig, zonder bouillonblokje", "evenveel", [
        "soja",
        "gluten",
      ]),
    ],
  },
  {
    naam: "selder",
    woorden: ["selder", "selderij", "bleekselder", "knolselder"],
    vervangers: [
      v("Venkel", "Fris en knapperig", "evenveel"),
      v("Prei", "Mild, goed in soep", "evenveel"),
    ],
  },
  {
    naam: "citroen",
    woorden: ["citroen", "citroensap"],
    vervangers: [
      v("Limoen", "Even fris, iets bloemiger", "evenveel"),
      v("Witte-wijnazijn", "Zuur zonder fruit", "de helft van de hoeveelheid", ["sulfiet"]),
    ],
  },
  {
    naam: "ui",
    woorden: ["ui", "uien", "ajuin", "ajuinen", "rode ui"],
    vervangers: [
      v("Prei", "Milder, goed gestoofd", "evenveel"),
      v("Sjalot", "Fijner en zachter", "evenveel"),
    ],
  },
];

const tokens = (t: string) => normaliseerTekst(t).split(" ").filter(Boolean);

/** Treft dit woord (of woordgroep) de naam? Heel woord, of meervoud op -s/-en. */
function treft(naam: string, woord: string): boolean {
  const n = normaliseerTekst(naam);
  const w = normaliseerTekst(woord);
  if (w.includes(" ")) return ` ${n} `.includes(` ${w} `);
  return tokens(n).some((t) => t === w || t === `${w}s` || t === `${w}en`);
}

/** Welke regel uit de tabel hoort bij dit ingrediënt? Langste trefwoord wint. */
export function regelVoor(ingredient: string): Regel | null {
  const n = normaliseerTekst(ingredient);
  if (!n) return null;
  let beste: { regel: Regel; lengte: number } | null = null;
  for (const regel of VERVANGTABEL) {
    if (
      regel.niet?.some(
        (x) => tokens(n).includes(normaliseerTekst(x)) || n.includes(normaliseerTekst(x)),
      )
    )
      continue;
    for (const w of regel.woorden) {
      if (treft(n, w) && (!beste || w.length > beste.lengte)) beste = { regel, lengte: w.length };
    }
  }
  return beste?.regel ?? null;
}

/** Eén persoon aan tafel, zoals de assistent die ziet. */
export type Eter = {
  id: string;
  naam: string;
  /** Allergeencodes (allergieën + herkenbare intoleranties). */
  allergieen: readonly string[];
  dieet?: Dieet | null;
  uitsluitingen?: readonly string[];
  /** Ben jij het zelf? Dan zegt Foodlo "jouw allergie". */
  ikZelf?: boolean;
  /** Mag de kijker de reden zien? Zo nee: alleen "niet geschikt voor Lotte". */
  redenZichtbaar: boolean;
};

const ALLERGEEN_NAAM = new Map(ALLERGENEN.map((a) => [a.id, a.naam.toLowerCase()]));
const DIEET_NAAM: Record<string, string> = {
  pescotarisch: "pescotarisch",
  vegetarisch: "vegetarisch",
  veganistisch: "veganistisch",
};

/** Alle allergenen van een vervanger: wat hij zelf zegt plus wat de herkenning vindt. */
export function allergenenVan(naam: string, aangegeven: readonly string[] = []): string[] {
  const alle = ALLERGENEN.map((a) => a.id);
  const herkend = allergenenIn([naam], alle).map((t) => t.id);
  return [...new Set([...aangegeven, ...herkend])];
}

function dierlijkPastBij(dierlijk: Dierlijk, dieet: Dieet | null | undefined): boolean {
  if (!dierlijk) return true;
  if (dieet === "veganistisch") return false;
  if (dieet === "vegetarisch") return dierlijk === "zuivel-ei" || dierlijk === "honing";
  if (dieet === "pescotarisch") return dierlijk !== "vlees";
  return true;
}

export type Afgevallen = { vervanger: Vervanger; redenen: string[] };

/**
 * Waarom past deze vervanger niet voor deze eter? Lege lijst = past.
 * De reden is "privé" (alleen "niet geschikt voor X") als de kijker hem niet mag zien.
 */
export function redenenTegen(
  vervanger: Pick<Vervanger, "naam" | "allergenen" | "dierlijk">,
  eter: Eter,
): string[] {
  const wie = eter.ikZelf ? "jou" : eter.naam;
  const uit: string[] = [];
  const geraakt = allergenenVan(vervanger.naam, vervanger.allergenen).filter((a) =>
    eter.allergieen.includes(a),
  );
  const dieetFout =
    !dierlijkPastBij(vervanger.dierlijk, eter.dieet) ||
    !pastBijDieet({ title: vervanger.naam, ingredienten: [vervanger.naam] }, eter.dieet);
  const tekst = normaliseerTekst(vervanger.naam);
  const liever = (eter.uitsluitingen ?? []).find((t) => {
    const n = normaliseerTekst(t);
    return n.length >= 3 && tekst.includes(n);
  });
  if (!geraakt.length && !dieetFout && !liever) return [];
  if (!eter.redenZichtbaar) return [`niet geschikt voor ${eter.naam}`];
  for (const a of geraakt) {
    const naam = ALLERGEEN_NAAM.get(a as AllergeenId) ?? a;
    uit.push(
      eter.ikZelf ? `bevat mogelijk ${naam} (jouw allergie)` : `bevat mogelijk ${naam} (${wie})`,
    );
  }
  if (dieetFout) {
    const d = DIEET_NAAM[eter.dieet ?? ""] ?? "het dieet";
    uit.push(eter.ikZelf ? `past niet bij jouw dieet (${d})` : `past niet bij ${wie} (${d})`);
  }
  if (liever)
    uit.push(eter.ikZelf ? `je eet liever geen ${liever}` : `${wie} eet liever geen ${liever}`);
  return uit;
}

export type VervangUitkomst = {
  /** Kent de tabel dit ingrediënt? */
  bekend: boolean;
  naam: string;
  geschikt: Vervanger[];
  afgevallen: Afgevallen[];
};

/** Toets een lijst vervangers (uit de tabel of van de AI) aan iedereen die meeëet. */
export function toetsVervangers(lijst: readonly Vervanger[], eters: readonly Eter[]) {
  const geschikt: Vervanger[] = [];
  const afgevallen: Afgevallen[] = [];
  for (const kandidaat of lijst) {
    const redenen = [...new Set(eters.flatMap((e) => redenenTegen(kandidaat, e)))];
    if (redenen.length) afgevallen.push({ vervanger: kandidaat, redenen });
    else geschikt.push(kandidaat);
  }
  return { geschikt, afgevallen };
}

/** De regelterugval: vervangers uit de vaste tabel, veilig voor iedereen aan tafel. */
export function veiligeVervangers(ingredient: string, eters: readonly Eter[]): VervangUitkomst {
  const regel = regelVoor(ingredient);
  if (!regel) return { bekend: false, naam: ingredient.trim(), geschikt: [], afgevallen: [] };
  return { bekend: true, naam: regel.naam, ...toetsVervangers(regel.vervangers, eters) };
}

/** Is dit ingrediënt zelf een probleem voor iemand aan tafel? (om het in de lijst aan te duiden) */
export function ingredientRedenen(ingredient: string, eters: readonly Eter[]): string[] {
  return [
    ...new Set(
      eters.flatMap((e) => redenenTegen({ naam: ingredient, allergenen: [], dierlijk: null }, e)),
    ),
  ];
}
