/**
 * Weer als zacht signaal voor de voorstellen (MODULE_DESIGNS §8, beslissing #15/#16 nog open).
 *
 * - `WeerAdapter`: één vorm voor elke bron. Er is nog GEEN echte bron aangesloten: de licentie
 *   (Open-Meteo commercieel) en een serverproxy per gemeente zonder GPS zijn nog niet beslist.
 *   `haalWeer()` in `weer.ts` (rechtstreeks Open-Meteo vanuit de browser) wordt daarom bewust niet
 *   gebruikt.
 * - `TestWeerAdapter`: vaste demodata, zonder netwerk en zonder locatie. In de app staat er altijd
 *   "testgegevens" bij.
 * - Zonder bron of met de schakelaar uit: geen signaal, en de voorstellen werken zoals voorheen.
 */
import type { Weer } from "@/lib/intelligentie/context";

export type WeerMeting = Weer & {
  /** Waar het weer over gaat, voor de gebruiker ("Gent"). */
  plaats: string;
  /** Testgegevens? Dan zegt de app dat er altijd bij. */
  test: boolean;
};

export interface WeerAdapter {
  readonly naam: string;
  readonly modus: "test" | "echt";
  haal(nu: Date): Promise<WeerMeting | null>;
}

export type TestWeerSoort = "warm" | "koud" | "nat" | "zacht";
export const TEST_WEER_SLEUTEL = "foodlo:testweer";

/** Vaste demodata per maand: een gewone Belgische dag (verzonnen, geen meting). */
const PER_MAAND: { temp: number; regen: boolean }[] = [
  { temp: 3, regen: false }, // jan
  { temp: 5, regen: true },
  { temp: 9, regen: false },
  { temp: 13, regen: true },
  { temp: 18, regen: false },
  { temp: 24, regen: false }, // jun
  { temp: 27, regen: false },
  { temp: 25, regen: false },
  { temp: 18, regen: true },
  { temp: 13, regen: true },
  { temp: 7, regen: true }, // nov
  { temp: 4, regen: false },
];

const VAST: Record<TestWeerSoort, { temp: number; regen: boolean }> = {
  warm: { temp: 28, regen: false },
  koud: { temp: 2, regen: false },
  nat: { temp: 11, regen: true },
  zacht: { temp: 16, regen: false },
};

/** Puur: het testweer voor een datum, of de vaste soort als die gekozen is (tests, demo). */
export function testWeerVoor(nu: Date, soort?: TestWeerSoort | null): WeerMeting {
  const basis = soort ? VAST[soort] : PER_MAAND[nu.getMonth()]!;
  return { ...basis, plaats: "Gent", test: true };
}

export class TestWeerAdapter implements WeerAdapter {
  readonly naam = "Testweer";
  readonly modus = "test" as const;
  constructor(private readonly soort: () => TestWeerSoort | null = leesTestWeerSoort) {}
  async haal(nu: Date) {
    return testWeerVoor(nu, this.soort());
  }
}

export function leesTestWeerSoort(): TestWeerSoort | null {
  try {
    const w = window.localStorage.getItem(TEST_WEER_SLEUTEL);
    return w === "warm" || w === "koud" || w === "nat" || w === "zacht" ? w : null;
  } catch {
    return null;
  }
}

export type WeerSignaal = {
  soort: "warm" | "koud" | "nat";
  titel: string;
  uitleg: string;
};

/**
 * Alleen een signaal als het weer iets zegt over wat je wil eten. Een gewone, zachte dag geeft
 * niets: dan blijft Vandaag rustig.
 */
export function weerSignaal(w: Pick<WeerMeting, "temp" | "regen"> | null): WeerSignaal | null {
  if (!w) return null;
  if (w.temp >= 22)
    return {
      soort: "warm",
      titel: "Warm vandaag: iets fris?",
      uitleg: "Salades en koude gerechten krijgen voorrang.",
    };
  if (w.temp <= 8)
    return {
      soort: "koud",
      titel: w.regen ? "Koud en nat: iets warms?" : "Koud vandaag: iets warms?",
      uitleg: "Soep, stoofpot en ovenschotels krijgen voorrang.",
    };
  if (w.regen)
    return {
      soort: "nat",
      titel: "Regenweer: iets dat lekker geurt?",
      uitleg: "Comfortgerechten krijgen voorrang.",
    };
  return null;
}

/**
 * Welke bron? Alleen in de demo (nep-databank) is er een testbron. In productie nog geen bron
 * tot de beslissing over de weerdienst: dan `null` en geen signaal.
 */
export function kiesWeerAdapter(projectId: string): WeerAdapter | null {
  if (["demo", "e2e-nep"].includes(projectId)) return new TestWeerAdapter();
  return null;
}

// ---------- Aan/uit (per toestel, standaard aan) ----------
const sleutel = (userId: string) => `foodlo:weer:${userId}`;
export const WEER_GEWIJZIGD = "foodlo:weer-gewijzigd";

export function weerAan(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(sleutel(userId)) !== "uit";
  } catch {
    return true;
  }
}

export function zetWeer(userId: string, aan: boolean) {
  try {
    if (aan) window.localStorage.removeItem(sleutel(userId));
    else window.localStorage.setItem(sleutel(userId), "uit");
  } catch {
    // opslag geblokkeerd: keuze geldt tot herladen
  }
  window.dispatchEvent(new Event(WEER_GEWIJZIGD));
}
