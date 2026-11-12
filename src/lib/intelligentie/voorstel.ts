/**
 * Foodloapp Intelligence — Meal Intelligence (I-1): een score met redenen in gewone taal.
 * FOODLOAPP-INTELLIGENCE-ARCHITECTUUR §2.4. Puur, deterministisch, geen AI, geen netwerk.
 *
 * Harde regels (nooit overschreden):
 * - een gekozen allergeen in de ingrediënten → nooit voorgesteld;
 * - "liever niet" uit je weekmenu-instelling → nooit voorgesteld;
 * - dieet uit de kennismaking (vegetarisch, pescotarisch …) → geen vlees of vis;
 * - "Niet nu" → niet voorgesteld zolang dat geldt.
 * Zachte regels zijn punten; elk punt met een reden. Een voorstel zonder reden tonen we niet.
 *
 * Allergieën en dieet komen van het toestel en blijven daar: deze functie draait in de app.
 */
import { magVoorstellen } from "@/lib/veiligheid";
import type { Dieet } from "@/lib/kennismaking";
import { opsomming } from "@/lib/vandaag";
import { isBasis, zitInVoorraad } from "@/lib/voorraad-match";
import { soortVan, vermijdWoorden, type Soortkeuze } from "@/lib/weekmenu-voorstel";
import type { Recipe } from "@/lib/types";
import { normaliseerTekst } from "@/lib/zoeken";
import type { Context } from "./context";
import { dagenTekst, type OudInHuis } from "./gebruik-eerst";
import { seizoensProductenIn } from "./seizoen-producten";
import { dagenTussen, type Geschiedenis } from "./geschiedenis";

export type Kandidaat = {
  id: string;
  title: string;
  minuten: number;
  category: string | null;
  tags: string[];
  ingredienten: string[];
};

export type Voorkeur = {
  /** Uit de weekmenu-instelling (per dag of algemeen); 0 = maakt niet uit. */
  maxMinuten: number;
  soort: Soortkeuze;
  vermijd: string;
  dieet?: Dieet | undefined;
};

export type RedenSoort =
  | "voorraad"
  | "tijd"
  | "gewoonte"
  | "weer"
  | "seizoen"
  | "feest"
  | "sterren"
  | "lang-niet"
  | "favoriet"
  | "soort";

export type Reden = { soort: RedenSoort; tekst: string; gewicht: number };

export type Aanbeveling = {
  id: string;
  title: string;
  score: number;
  /** Hooguit 2, sterkste eerst. */
  redenen: Reden[];
  aanwezig: string[];
  ontbreekt: string[];
};

export type Invoer = {
  kandidaten: Kandidaat[];
  context: Context;
  voorraad: string[];
  geschiedenis: Geschiedenis;
  sterren?: Record<string, number>;
  favorieten?: string[];
  voorkeur: Voorkeur;
  /** Gekozen allergenen (ids uit lib/allergenen), alleen van het toestel. */
  allergieen?: string[];
  /** Recept-ids met een geldige "Niet nu". */
  nietNu?: string[];
  /** Verse producten die al even in huis zijn (gebruik-eerst.ts). */
  oudInHuis?: OudInHuis[];
  max?: number;
};

const MAALTIJD_SOORTEN = ["hoofdgerecht", "soep", "salade", "ontbijt", "bijgerecht"];
const WEEKDAG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const WARM = [
  "soep",
  "stoof",
  "stoverij",
  "stamppot",
  "stoemp",
  "ovenschotel",
  "curry",
  "chili",
  "gratin",
  "lasagne",
];
const FRIS = ["salade", "koud", "gazpacho", "poke", "carpaccio", "tartaar", "wrap"];
const OVEN = ["oven", "stoof", "stoverij", "ovenschotel", "gratin", "lasagne"];

function soortVanKandidaat(k: Kandidaat) {
  const r = { title: k.title, description: "", tags: k.tags } as unknown as Recipe;
  return soortVan(r, k.ingredienten);
}
function tekstVan(k: Kandidaat) {
  return normaliseerTekst([k.title, k.category ?? "", ...k.tags, ...k.ingredienten].join(" "));
}
function titelTekst(k: Kandidaat) {
  return normaliseerTekst([k.title, k.category ?? "", ...k.tags].join(" "));
}
function heeftWoord(tekst: string, woorden: string[]) {
  return woorden.find((w) => new RegExp(`(^|[^a-z])${normaliseerTekst(w)}`).test(tekst)) ?? null;
}

/** Mag dit recept volgens de harde regels voorgesteld worden? */
export function toegelaten(
  k: Kandidaat,
  invoer: Pick<Invoer, "voorkeur" | "allergieen" | "nietNu">,
) {
  if (k.category && !MAALTIJD_SOORTEN.includes(k.category)) return false;
  if (invoer.nietNu?.includes(k.id)) return false;
  // Allergie (ook: geen ingrediënten = niet te controleren) en dieet: één regel voor heel Foodlo.
  if (!magVoorstellen(k, { allergieen: invoer.allergieen, dieet: invoer.voorkeur.dieet }))
    return false;
  const tekst = tekstVan(k);
  if (vermijdWoorden(invoer.voorkeur.vermijd).some((w) => tekst.includes(normaliseerTekst(w))))
    return false;
  return true;
}

/**
 * Score en redenen voor één gerecht, zonder de harde regels opnieuw te toetsen.
 * Voor een keuze die al gemaakt is (bv. het weekvoorstel): roep eerst `toegelaten` aan.
 * `kandidaten` in de invoer wordt hier niet gebruikt.
 */
export function beoordeel(k: Kandidaat, i: Invoer): Aanbeveling {
  const redenen: Reden[] = [];
  let score = 0;
  const plus = (soort: RedenSoort, punten: number, tekst: string | null) => {
    score += punten;
    if (tekst && punten > 0) redenen.push({ soort, tekst, gewicht: punten });
  };
  const tekst = titelTekst(k);
  const { context: c, geschiedenis: g } = i;

  // Voorraad: wat je al in huis hebt.
  const telt = k.ingredienten.map((n) => n.trim()).filter((n) => n && !isBasis(n));
  const aanwezig = telt.filter((n) => zitInVoorraad(n, i.voorraad));
  const ontbreekt = telt.filter((n) => !aanwezig.includes(n));
  // Minder verspilling: wat al even in huis is, eerst opmaken (en dat als reden tonen).
  const oud = (i.oudInHuis ?? []).find((o) => aanwezig.some((n) => zitInVoorraad(n, [o.naam])));
  if (aanwezig.length) {
    const punten = (8 * aanwezig.length) / telt.length + Math.min(aanwezig.length, 3);
    plus(
      "voorraad",
      punten + (oud ? 6 : 0),
      oud
        ? `Gebruikt je ${oud.naam.toLowerCase()} (${dagenTekst(oud.dagen)})`
        : `Gebruikt je ${opsomming(
            aanwezig.map((n) => n.toLowerCase()),
            2,
          )}`,
    );
  }
  score -= Math.min(ontbreekt.length * 1.5, 9);

  // Tijd: eigen instelling gaat voor, anders je eigen gewoonte op deze weekdag.
  const gewoonte = g.minutenPerWeekdag[c.weekdag];
  const grens = i.voorkeur.maxMinuten > 0 ? i.voorkeur.maxMinuten : (gewoonte ?? 0);
  if (k.minuten > 0 && grens > 0) {
    if (k.minuten > grens) score -= 8;
    else if (!i.voorkeur.maxMinuten && gewoonte !== undefined && gewoonte <= 35)
      plus("gewoonte", 5, `Op ${WEEKDAG[c.weekdag]} kook je meestal snel (${k.minuten} min)`);
    else
      plus("tijd", k.minuten <= 30 ? 4 : 2, k.minuten <= 30 ? `Klaar in ${k.minuten} min` : null);
  } else if (k.minuten > 0 && k.minuten <= 30 && c.uur >= 17) {
    plus("tijd", 3, `Klaar in ${k.minuten} min`);
  }

  // Weer (alleen als het er is; I-3).
  if (c.weer) {
    if (c.weer.temp <= 8 && heeftWoord(tekst, WARM))
      plus("weer", 4, `Warm eten voor een koude dag (${Math.round(c.weer.temp)} °C)`);
    if (c.weer.temp >= 25) {
      if (heeftWoord(tekst, FRIS))
        plus("weer", 4, `Fris voor een warme dag (${Math.round(c.weer.temp)} °C)`);
      else if (heeftWoord(tekst, OVEN)) score -= 4;
    }
  }

  // Seizoen en feestdag.
  // Eerst concreet (usecase 16): seizoensproducten van eigen bodem; anders het seizoensthema.
  const vanBijOns = seizoensProductenIn(
    [k.title, ...k.ingredienten],
    Number(c.datum.slice(5, 7)) - 1,
  );
  if (vanBijOns.length) {
    const namen = opsomming(vanBijOns, 2);
    plus(
      "seizoen",
      4,
      `${namen.charAt(0).toUpperCase()}${namen.slice(1)} ${vanBijOns.length > 1 ? "zijn" : "is"} nu in het seizoen`,
    );
    // Zoals de thema's in Ontdek: ook samengestelde woorden ("linzensoep", "kippenstoofpot").
  } else if (c.seizoen.woorden.some((w) => tekst.includes(normaliseerTekst(w))))
    plus("seizoen", 3, `Past bij het seizoen: ${c.seizoen.titel.toLowerCase()}`);
  if (c.feest && heeftWoord(tekst, c.feest.woorden))
    plus(
      "feest",
      5,
      c.feest.over === 0
        ? `Vandaag is het ${c.feest.naam}`
        : `Over ${c.feest.over} ${c.feest.over === 1 ? "dag" : "dagen"} is het ${c.feest.naam}`,
    );

  // Soort van vandaag (weekmenu-instelling per dag).
  if (i.voorkeur.soort) {
    const soort = soortVanKandidaat(k);
    if (soort === i.voorkeur.soort)
      plus(
        "soort",
        3,
        `Je koos ${soort === "vega" ? "vegetarisch" : soort} voor ${WEEKDAG[c.weekdag]}`,
      );
    else score -= 6;
  }

  // Variatie, sterren en favorieten.
  const laatst = g.laatst[k.id];
  const geleden = laatst ? dagenTussen(laatst, c.datum) : null;
  if (geleden !== null && geleden < 14) score -= 10 - Math.min(9, geleden / 2);
  if (g.komend.has(k.id)) score -= 6;
  const st = i.sterren?.[k.id] ?? 0;
  if (st >= 4) {
    if (geleden === null || geleden > 45)
      plus(
        "lang-niet",
        5,
        laatst ? `Lang niet gemaakt, je gaf het ${st} sterren` : `Je gaf dit ${st} sterren`,
      );
    else plus("sterren", 3, `Je gaf dit ${st} sterren`);
  } else if (st > 0 && st <= 2) score -= 6;
  if (i.favorieten?.includes(k.id)) plus("favoriet", 2.5, "Een van je favorieten");
  if (k.category === "hoofdgerecht") score += 1;

  redenen.sort((a, b) => b.gewicht - a.gewicht);
  return { id: k.id, title: k.title, score, redenen: redenen.slice(0, 2), aanwezig, ontbreekt };
}

/** De beste voorstellen, elk met 1 à 2 redenen. Zonder reden geen voorstel. */
export function beveelAan(i: Invoer): Aanbeveling[] {
  return i.kandidaten
    .filter((k) => toegelaten(k, i))
    .map((k) => beoordeel(k, i))
    .filter((a) => a.redenen.length > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, i.max ?? 3);
}
