/**
 * P4 — Proactieve suggesties: welke soorten Foodlo uit zichzelf toont, en welke ene kaart er
 * op Vandaag komt.
 *
 * - Eén instellingenpagina (Instellingen › Suggesties): per soort aan of uit (standaard aan).
 * - Hooguit één proactieve kaart tegelijk op Vandaag, in vaste volgorde van belang.
 * - "Niet meer tonen" verbergt die ene kaart (een sleutel per kaart); een nieuwe situatie
 *   (ander restje, andere week) geeft een nieuwe kaart.
 * - Opslag: op het account (voorstel 0016, `suggestie_instellingen`) of, zolang die tabel niet
 *   bestaat, op dit toestel. Geen gezondheidsgegevens.
 * "Slimme voorstellen" uit (slim.ts) blijft alles uitzetten.
 */
import { budgetOordeel, euro } from "@/lib/budget";

export const SUGGESTIE_SOORTEN = [
  {
    id: "restjes",
    label: "Restjes gebruiken",
    uitleg: "Wat je gekookt hebt en nog op moet, met een voorstel om het op te eten.",
  },
  {
    id: "over-datum",
    label: "Bijna over datum",
    uitleg: "Verse producten die al even in huis zijn (als je je voorraad bijhoudt).",
  },
  {
    id: "budget",
    label: "Budget",
    uitleg: "Een waarschuwing als je weekmenu (bijna) boven je weekbudget gaat.",
  },
  {
    id: "weer",
    label: "Weer",
    uitleg: "Iets fris bij warm weer, iets warms als het koud is.",
  },
  {
    id: "variatie",
    label: "Gevarieerder eten",
    uitleg: "Als er deze week vaak hetzelfde soort gerecht op het menu staat.",
  },
  {
    id: "seizoen",
    label: "Seizoen",
    uitleg: "Een groente of fruit van het seizoen dat in je eigen recepten zit.",
  },
  {
    id: "boodschappen",
    label: "Vergeten boodschappen",
    uitleg: "Wat je weekmenu nog nodig heeft en niet op je lijst staat.",
  },
] as const;

export type SuggestieSoort = (typeof SUGGESTIE_SOORTEN)[number]["id"];

const IDS = SUGGESTIE_SOORTEN.map((s) => s.id) as readonly string[];

/** Volgorde op Vandaag: wat bederft eerst, dan geld, dan de rest. */
export const VOLGORDE: readonly SuggestieSoort[] = [
  "restjes",
  "over-datum",
  "budget",
  "weer",
  "variatie",
  "seizoen",
];

export type SuggestieInstellingen = {
  /** Soorten die uit staan (standaard staat alles aan). */
  uit: SuggestieSoort[];
  /** Sleutels van kaarten die je niet meer wilt zien. */
  verborgen: string[];
};

export const STANDAARD_SUGGESTIES: SuggestieInstellingen = { uit: [], verborgen: [] };
export const MAX_VERBORGEN = 100;

/** Wat uit de databank of het toestel komt, veilig lezen (onbekend = weg). */
export function leesSuggesties(ruw: unknown): SuggestieInstellingen {
  const r = (ruw ?? {}) as { uit?: unknown; verborgen?: unknown };
  const uit = Array.isArray(r.uit)
    ? [
        ...new Set(
          r.uit.filter((x): x is SuggestieSoort => typeof x === "string" && IDS.includes(x)),
        ),
      ]
    : [];
  const verborgen = Array.isArray(r.verborgen)
    ? [
        ...new Set(
          r.verborgen.filter(
            (x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120,
          ),
        ),
      ].slice(-MAX_VERBORGEN)
    : [];
  return { uit, verborgen };
}

export function isAan(i: SuggestieInstellingen, soort: SuggestieSoort): boolean {
  return !i.uit.includes(soort);
}

export function zetSoort(
  i: SuggestieInstellingen,
  soort: SuggestieSoort,
  aan: boolean,
): SuggestieInstellingen {
  const uit = aan ? i.uit.filter((s) => s !== soort) : [...new Set([...i.uit, soort])];
  return { ...i, uit };
}

/** Eén kaart verbergen; de oudste vallen weg boven het maximum. */
export function verberg(i: SuggestieInstellingen, sleutel: string): SuggestieInstellingen {
  const verborgen = [...i.verborgen.filter((s) => s !== sleutel), sleutel.slice(0, 120)].slice(
    -MAX_VERBORGEN,
  );
  return { ...i, verborgen };
}

export type KaartKandidaat = { soort: SuggestieSoort; sleutel: string };

/**
 * De ene kaart voor Vandaag: de eerste (in `VOLGORDE`) die er is, aan staat en niet verborgen is.
 * Kaarten van dezelfde soort volgen hun eigen volgorde in de lijst.
 */
export function kiesKaart<T extends KaartKandidaat>(
  kandidaten: readonly (T | null | undefined)[],
  i: SuggestieInstellingen,
): T | null {
  const echte = kandidaten.filter((k): k is T => !!k);
  for (const soort of VOLGORDE) {
    const k = echte.find(
      (x) => x.soort === soort && isAan(i, soort) && !i.verborgen.includes(x.sleutel),
    );
    if (k) return k;
  }
  return null;
}

// ---------------------------------------------------------------- signalen (pure)

export type MaaltijdSoort = "vlees" | "vis" | "vega";

/**
 * "Gevarieerder eten": drie keer of meer hetzelfde (vlees of vis) deze week, en er komt er nog
 * een. Stelt voor om de laatste daarvan te vervangen (via de assistent, met voorstel).
 */
export function variatieSignaal(
  week: readonly { datum: string; soort: MaaltijdSoort }[],
  vandaag: string,
): { soort: "vlees" | "vis"; aantal: number; datum: string } | null {
  for (const soort of ["vlees", "vis"] as const) {
    const van = week.filter((m) => m.soort === soort);
    const komend = van
      .filter((m) => m.datum >= vandaag)
      .sort((a, b) => a.datum.localeCompare(b.datum));
    if (van.length >= 3 && komend.length)
      return { soort, aantal: van.length, datum: komend.at(-1)!.datum };
  }
  return null;
}

/** Budget-waarschuwing: alleen als er een budget is en de week (bijna) erboven gaat. */
export function budgetSignaal(
  kost: { totaal: number; nietGeschat: number },
  budget: number | null | undefined,
): { status: "bijna" | "over"; tekst: string } | null {
  if (!budget || budget <= 0 || kost.totaal <= 0) return null;
  const o = budgetOordeel(kost.totaal, budget);
  if (o.status === "binnen") return null;
  return o.status === "over"
    ? {
        status: "over",
        tekst: `Je weekmenu kost ongeveer ${euro(kost.totaal)}: ${euro(-o.verschil)} boven je budget van ${euro(budget)}.`,
      }
    : {
        status: "bijna",
        tekst: `Je weekmenu kost ongeveer ${euro(kost.totaal)}, bijna je budget van ${euro(budget)}.`,
      };
}

// ---------------------------------------------------------------- opslag op het toestel

const sleutelVan = (userId: string) => `foodlo:suggesties:${userId}`;

export function leesToestelSuggesties(userId: string | null | undefined): SuggestieInstellingen {
  if (!userId) return STANDAARD_SUGGESTIES;
  try {
    return leesSuggesties(JSON.parse(window.localStorage.getItem(sleutelVan(userId)) ?? "null"));
  } catch {
    return STANDAARD_SUGGESTIES;
  }
}

export function bewaarToestelSuggesties(userId: string, i: SuggestieInstellingen) {
  try {
    window.localStorage.setItem(sleutelVan(userId), JSON.stringify(i));
  } catch {
    // Opslag geblokkeerd (privévenster): de keuze geldt tot je de pagina sluit.
  }
}
