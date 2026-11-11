/**
 * Eerste stappen: zes oefeningen in de echte app (geen nepinteractie). Een oefening is "gedaan"
 * als de handeling echt in je gegevens te zien is. Alleen "kookstand gestart" en "verborgen"
 * worden op het toestel onthouden (er is geen tabel voor; zie ONBOARDING-HELPCENTER-ONTWERP §6).
 */
export type OefeningId = "recept" | "plannen" | "lijst" | "afvinken" | "voorraad" | "koken";

export type Oefening = {
  id: OefeningId;
  titel: string;
  uitleg: string;
  route: string;
  knop: string;
  hulp: string;
};

export const OEFENINGEN: Oefening[] = [
  {
    id: "recept",
    titel: "Een recept bewaren",
    uitleg: "Voeg een eigen recept toe, of neem een idee over uit Ontdek.",
    route: "/inspiratie",
    knop: "Naar Ontdek",
    hulp: "idee-bewaren",
  },
  {
    id: "plannen",
    titel: "Een maaltijd plannen",
    uitleg: "Zet een gerecht op een dag in je weekmenu.",
    route: "/planner",
    knop: "Naar het weekmenu",
    hulp: "week-plannen",
  },
  {
    id: "lijst",
    titel: "Een boodschappenlijst maken",
    uitleg: "Zet iets op je lijst, zelf of met Slim aanvullen.",
    route: "/boodschappen",
    knop: "Naar je lijst",
    hulp: "lijst-gebruiken",
  },
  {
    id: "afvinken",
    titel: "Een product afvinken",
    uitleg: "Tik op een product op je lijst als je het gekocht hebt.",
    route: "/boodschappen",
    knop: "Naar je lijst",
    hulp: "lijst-gebruiken",
  },
  {
    id: "voorraad",
    titel: "Iets in je voorraad zetten",
    uitleg: "Typ wat je al in huis hebt, zodat Foodlo het niet dubbel laat kopen.",
    route: "/voorraad",
    knop: "Naar je voorraad",
    hulp: "voorraad",
  },
  {
    id: "koken",
    titel: "De kookstand starten",
    uitleg: "Open een recept, tik op Start koken en ga één stap verder.",
    route: "/gerechten",
    knop: "Kies een recept",
    hulp: "kookstand",
  },
];

export type Tellingen = {
  recepten: number;
  plannen: number;
  lijst: number;
  afgevinkt: number;
  voorraad: number;
};

export function gedaan(t: Tellingen, kookstandGestart: boolean): Record<OefeningId, boolean> {
  return {
    recept: t.recepten > 0,
    plannen: t.plannen > 0,
    lijst: t.lijst > 0,
    afvinken: t.afgevinkt > 0,
    voorraad: t.voorraad > 0,
    koken: kookstandGestart,
  };
}

const KOKEN = "foodlo:kookstand-gestart";
const VERBORGEN = "foodlo:eerste-stappen-verborgen";
const NIEUW = "foodlo:onboarding-nieuw";

function lees(k: string) {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}
function zet(k: string, v: string | null) {
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* niets */
  }
}

export const kookstandGestart = () => lees(KOKEN) === "ja";
export const markeerKookstand = () => zet(KOKEN, "ja");
export const eersteStappenVerborgen = () => lees(VERBORGEN) === "ja";
export const verbergEersteStappen = (ja: boolean) => zet(VERBORGEN, ja ? "ja" : null);
/** Alleen wie de nieuwe kennismaking doorliep, krijgt de kaart op Vandaag (bestaande gebruikers niet). */
export const isNieuweGebruiker = () => lees(NIEUW) === "ja";
export const markeerNieuweGebruiker = () => zet(NIEUW, "ja");
