/**
 * Planprofiel (P1): wat Foodlo over je keuken weet om je week samen te stellen.
 *
 * - Keukenapparatuur: zonder keuze "oven + kookplaat" (zichtbaar als aanname).
 * - Kookervaring: beginner / gemiddeld / ervaren (beginners krijgen geen moeilijke recepten
 *   voorgesteld; dat kan je versoepelen).
 * - Voorraadniveau: geen / basisvoorraad (gekozen producten) / volledig. Onbekende voorraad is
 *   nooit "in huis".
 * - Weekbudget: stuurt de voorstellen (schatting).
 *
 * Opslag: op het account in `planprofiel` (voorstel 0013). Bestaat die tabel nog niet
 * (productie vóór de migratie), dan op dit toestel. Geen gezondheidsgegevens; niets hiervan
 * gaat naar een AI.
 */
import { leesBedrag } from "@/lib/budget";
import type { Ervaring } from "@/lib/kennismaking";
import { apparaatNaam, isApparaat, STANDAARD_APPARATUUR, type Apparaat } from "./apparatuur";

export type Kookervaring = "beginner" | "gemiddeld" | "ervaren";
export type Voorraadniveau = "geen" | "basis" | "volledig";

export type PlanProfiel = {
  /** null = nog niet gekozen: dan geldt STANDAARD_APPARATUUR (en dat staat op het scherm). */
  apparatuur: Apparaat[] | null;
  kookervaring: Kookervaring | null;
  voorraadniveau: Voorraadniveau | null;
  /** Bij "basis": de producten die je altijd in huis hebt (zelf gekozen). */
  basisvoorraad: string[];
  weekbudget: number | null;
};

export const LEEG_PROFIEL: PlanProfiel = {
  apparatuur: null,
  kookervaring: null,
  voorraadniveau: null,
  basisvoorraad: [],
  weekbudget: null,
};

/** Voorstellen voor de basisvoorraad; je kiest zelf, niets staat standaard aan. */
export const BASIS_SUGGESTIES = [
  "zout",
  "peper",
  "olie",
  "bloem",
  "suiker",
  "olijfolie",
  "boter",
  "rijst",
  "pasta",
  "eieren",
  "uien",
  "look",
  "melk",
  "passata",
  "bouillon",
  "mosterd",
  "azijn",
];

const MAX_BASIS = 40;

/** De apparatuur waarmee gerekend wordt (met de aanname als je niets koos). */
export function apparatuurVan(p: Pick<PlanProfiel, "apparatuur">): Apparaat[] {
  return p.apparatuur ? [...p.apparatuur] : [...STANDAARD_APPARATUUR];
}

/** Uit de kennismaking (nieuw/soms/graag) als het profiel nog niets zegt. */
export function ervaringVan(
  p: Pick<PlanProfiel, "kookervaring">,
  kennis?: Ervaring | undefined,
): Kookervaring | null {
  if (p.kookervaring) return p.kookervaring;
  if (kennis === "nieuw") return "beginner";
  if (kennis === "soms") return "gemiddeld";
  if (kennis === "graag") return "ervaren";
  return null;
}

/**
 * Wat telt als "in huis"? Volledig: je bijgehouden voorraad. Basis: alleen je gekozen
 * basisproducten. Geen (of onbekend): niets.
 */
export function inHuisVolgensNiveau(
  niveau: Voorraadniveau | null,
  bijgehouden: readonly string[],
  basis: readonly string[],
): string[] {
  if (niveau === "volledig") return [...bijgehouden];
  if (niveau === "basis") return [...basis];
  return [];
}

function schoonProduct(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const t = x.trim().toLowerCase().slice(0, 40);
  return t.length >= 2 ? t : null;
}

/** Ruwe gegevens (toestel of databank) → een geldig profiel. Onbekende waarden vallen weg. */
export function leesProfiel(ruw: unknown): PlanProfiel {
  if (!ruw || typeof ruw !== "object") return { ...LEEG_PROFIEL };
  const r = ruw as Record<string, unknown>;
  const app = Array.isArray(r["apparatuur"])
    ? [...new Set((r["apparatuur"] as unknown[]).filter(isApparaat))]
    : null;
  const ervaring = ["beginner", "gemiddeld", "ervaren"].includes(r["kookervaring"] as string)
    ? (r["kookervaring"] as Kookervaring)
    : null;
  const niveau = ["geen", "basis", "volledig"].includes(r["voorraadniveau"] as string)
    ? (r["voorraadniveau"] as Voorraadniveau)
    : null;
  const basis = Array.isArray(r["basisvoorraad"])
    ? [
        ...new Set(
          (r["basisvoorraad"] as unknown[]).map(schoonProduct).filter((x): x is string => !!x),
        ),
      ].slice(0, MAX_BASIS)
    : [];
  const b = r["weekbudget"];
  const budget =
    typeof b === "number" ? leesBedrag(String(b)) : typeof b === "string" ? leesBedrag(b) : null;
  return {
    apparatuur: app,
    kookervaring: ervaring,
    voorraadniveau: niveau,
    basisvoorraad: basis,
    weekbudget: budget,
  };
}

/** Voor de databank (voorstel 0013): alleen de kolommen, nooit iets anders. */
export function naarRij(p: PlanProfiel) {
  return {
    apparatuur: p.apparatuur,
    kookervaring: p.kookervaring,
    voorraadniveau: p.voorraadniveau,
    basisvoorraad: p.basisvoorraad,
    weekbudget: p.weekbudget,
  };
}

// ---------------------------------------------------------------- toestel (terugval)

const sleutel = (userId: string) => `foodlo:planprofiel:${userId}`;
export const PROFIEL_GEWIJZIGD = "foodlo:planprofiel-gewijzigd";

export function leesToestelProfiel(userId: string | null | undefined): PlanProfiel {
  if (!userId) return { ...LEEG_PROFIEL };
  try {
    return leesProfiel(JSON.parse(window.localStorage.getItem(sleutel(userId)) ?? "null"));
  } catch {
    return { ...LEEG_PROFIEL };
  }
}

export function bewaarToestelProfiel(userId: string, p: PlanProfiel) {
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(naarRij(p)));
  } catch {
    /* privévenster: alleen voor nu */
  }
  try {
    window.dispatchEvent(new Event(PROFIEL_GEWIJZIGD));
  } catch {
    /* geen browser (tests) */
  }
}

/** Bij afmelden: niets van een vorige gebruiker laten staan. */
export function wisToestelProfielen() {
  try {
    const weg: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("foodlo:planprofiel:")) weg.push(k);
    }
    for (const k of weg) window.localStorage.removeItem(k);
  } catch {
    /* niets */
  }
}

/** Korte samenvatting voor een rij in Instellingen: "Oven, kookplaat (aangenomen)". */
export function apparatuurSamenvatting(a: readonly Apparaat[], aangenomen: boolean): string {
  const namen = a.map((x) => apparaatNaam(x).toLowerCase()).join(", ");
  const tekst = namen ? namen.charAt(0).toUpperCase() + namen.slice(1) : "Geen toestellen";
  return aangenomen ? `${tekst} (aangenomen)` : tekst;
}
