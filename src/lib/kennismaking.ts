/**
 * Persoonlijke kennismaking (Smart Onboarding). Kort, alles optioneel.
 *
 * Privacy: dieet en allergieën zijn (mogelijk) gezondheidsgegevens (AVG art. 9). Zolang
 * voorstel 0004 (BUG-119) niet uitgevoerd is, zijn weekmenuvoorkeuren op het account leesbaar
 * voor gezinsleden. Daarom blijven ervaring, dieet, allergieën, gezin en planwijze **alleen op
 * dit toestel**. Alleen de kooktijd gaat naar je weekmenu-instelling (`maxMinuten`), en het
 * dieet alleen als je dat zelf aanvinkt.
 */
import type { WeekmenuInstelling } from "@/lib/voorkeuren";

export type Ervaring = "nieuw" | "soms" | "graag";
export type Dieet = "alles" | "weinig-vlees" | "pescotarisch" | "vegetarisch" | "veganistisch";
export type Planwijze = "week" | "dag" | "voorstel";
export type Gezinsgrootte = "1" | "2" | "3-4" | "5+";

export type Kennismaking = {
  ervaring?: Ervaring;
  dieet?: Dieet;
  allergieen: string[];
  gezin?: Gezinsgrootte;
  kooktijd?: 0 | 20 | 30 | 45;
  planwijze?: Planwijze;
  dieetInWeekmenu?: boolean;
  bijgewerkt?: string;
};

export const LEEG: Kennismaking = { allergieen: [] };

const sleutel = (userId: string) => `foodlo:kennismaking:${userId}`;

export function leesKennismaking(userId: string | null | undefined): Kennismaking {
  if (!userId) return LEEG;
  try {
    const ruw = window.localStorage.getItem(sleutel(userId));
    if (!ruw) return LEEG;
    const k = JSON.parse(ruw) as Partial<Kennismaking>;
    return { ...LEEG, ...k, allergieen: Array.isArray(k.allergieen) ? k.allergieen : [] };
  } catch {
    return LEEG;
  }
}

export function bewaarKennismaking(userId: string, k: Kennismaking) {
  try {
    window.localStorage.setItem(
      sleutel(userId),
      JSON.stringify({ ...k, bijgewerkt: new Date().toISOString() }),
    );
  } catch {
    /* privévenster: niets bewaren */
  }
}

export function wisKennismaking(userId: string) {
  try {
    window.localStorage.removeItem(sleutel(userId));
  } catch {
    /* niets */
  }
}

/** Wat gaat er naar de weekmenu-instelling (account)? Alleen kooktijd, dieet enkel met toestemming. */
export function naarWeekmenu(k: Kennismaking): Partial<WeekmenuInstelling> {
  const uit: Partial<WeekmenuInstelling> = {};
  if (k.kooktijd !== undefined) uit.maxMinuten = k.kooktijd;
  if (k.dieetInWeekmenu && k.dieet) {
    const per: Record<Dieet, Pick<WeekmenuInstelling, "vlees" | "vis" | "vega">> = {
      alles: { vlees: 3, vis: 1, vega: 2 },
      "weinig-vlees": { vlees: 1, vis: 1, vega: 4 },
      pescotarisch: { vlees: 0, vis: 2, vega: 4 },
      vegetarisch: { vlees: 0, vis: 0, vega: 6 },
      veganistisch: { vlees: 0, vis: 0, vega: 6 },
    };
    Object.assign(uit, per[k.dieet]);
  }
  return uit;
}

/** Ervaren gebruikers krijgen een kortere rondleiding. */
export function korteRondleiding(k: Kennismaking): boolean {
  return k.ervaring === "graag";
}

/**
 * Bij afmelden of verwijderen: alle kennismakingen van dit toestel wissen. Dieet en allergieën
 * zijn gezondheidsgegevens; op een gedeeld toestel mogen ze niet blijven staan.
 */
export function wisAlleKennismakingen() {
  try {
    const weg: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("foodlo:kennismaking:")) weg.push(k);
    }
    for (const k of weg) window.localStorage.removeItem(k);
  } catch {
    /* niets */
  }
}
