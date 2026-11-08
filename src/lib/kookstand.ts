/**
 * Kookstand-hulpjes (V2): tijden in een stap herkennen voor timers, en de
 * voortgang bewaren zodat je na per ongeluk wegklikken verder kan koken.
 */

export type TimerVoorstel = {
  /** Aantal seconden waarop de timer start (bij een bereik: de ondergrens). */
  seconden: number;
  /** Zoals het in de stap staat, bv. "12 tot 15 minuten". */
  label: string;
};

const EENHEID: Record<string, number> = {
  uur: 3600,
  uren: 3600,
  u: 3600,
  minuten: 60,
  minuut: 60,
  min: 60,
  seconden: 1,
  seconde: 1,
  sec: 1,
};

const PATROON =
  /(\d+(?:[.,]\d+)?|een half|anderhalf|een)\s*(?:(?:tot|à|a|-|–)\s*(\d+(?:[.,]\d+)?)\s*)?(uren|uur|u|minuten|minuut|min|seconden|seconde|sec)\b\.?/gi;

function getal(woord: string): number {
  const w = woord.toLowerCase();
  if (w === "een half") return 0.5;
  if (w === "anderhalf") return 1.5;
  if (w === "een") return 1;
  return Number(w.replace(",", "."));
}

/** Vindt tijdsaanduidingen in een stap ("Laat 2 uur stoven", "12 tot 15 minuten"). */
export function vindTimers(stap: string): TimerVoorstel[] {
  const uit: TimerVoorstel[] = [];
  for (const m of stap.matchAll(PATROON)) {
    const factor = EENHEID[m[3]!.toLowerCase()];
    const waarde = getal(m[1]!);
    if (!factor || !Number.isFinite(waarde) || waarde <= 0) continue;
    const seconden = Math.round(waarde * factor);
    // Onzin vermijden: geen timers onder 10 s of boven 24 u.
    if (seconden < 10 || seconden > 24 * 3600) continue;
    if (uit.some((t) => t.seconden === seconden)) continue;
    uit.push({ seconden, label: m[0].trim().replace(/\.$/, "") });
  }
  return uit;
}

/** "1:05:09", "12:30" of "0:45" — altijd met seconden voor een duidelijke aftelling. */
export function toonTijd(seconden: number): string {
  const s = Math.max(0, Math.ceil(seconden));
  const u = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = u ? String(m).padStart(2, "0") : String(m);
  return `${u ? `${u}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

/** Gewone taal voor op een knop: "2 uur", "1 uur 30 min", "15 min", "45 sec". */
export function duurLabel(seconden: number): string {
  const u = Math.floor(seconden / 3600);
  const m = Math.floor((seconden % 3600) / 60);
  const s = seconden % 60;
  if (u && m) return `${u} uur ${m} min`;
  if (u) return `${u} uur`;
  if (m && s) return `${m} min ${s} sec`;
  if (m) return `${m} min`;
  return `${s} sec`;
}

const SLEUTEL = (receptId: string) => `foodlo:kookstand:${receptId}`;
export const VOORTGANG_GELDIG_MS = 12 * 3600 * 1000;

type Opslag = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function opslag(): Opslag | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function bewaarVoortgang(receptId: string, stap: number, nu = Date.now(), o = opslag()) {
  try {
    o?.setItem(SLEUTEL(receptId), JSON.stringify({ stap, tijd: nu }));
  } catch {
    // opslag vol of geblokkeerd: koken werkt gewoon verder
  }
}

/** Geeft de bewaarde stap terug, of null als er niets (recents) bewaard is. */
export function leesVoortgang(
  receptId: string,
  aantalStappen: number,
  nu = Date.now(),
  o = opslag(),
): number | null {
  try {
    const ruw = o?.getItem(SLEUTEL(receptId));
    if (!ruw) return null;
    const { stap, tijd } = JSON.parse(ruw) as { stap: unknown; tijd: unknown };
    if (typeof stap !== "number" || typeof tijd !== "number") return null;
    if (nu - tijd > VOORTGANG_GELDIG_MS) return null;
    if (!Number.isInteger(stap) || stap < 0 || stap >= aantalStappen) return null;
    return stap;
  } catch {
    return null;
  }
}

export function wisVoortgang(receptId: string, o = opslag()) {
  try {
    o?.removeItem(SLEUTEL(receptId));
  } catch {
    // niets te doen
  }
}
