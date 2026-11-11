// Eén rondleiding-systeem: de overlay leeft in AppShell, dit bestand bewaart alleen de status.
export const RONDLEIDING_SLEUTEL = "rondleiding_gezien";
const ACTIEF_SLEUTEL = "rondleiding_actief";
const STAP_SLEUTEL = "rondleiding_stap";
const EVENT = "rondleiding-wijziging";

function lees(k: string): string | null {
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

export function rondleidingActief(): boolean {
  return lees(ACTIEF_SLEUTEL) === "ja";
}

/** Waar was je gebleven? 0 = begin. Blijft bewaard bij "Later", weg bij "Klaar" of "Overslaan". */
export function bewaardeStap(): number {
  const n = Number(lees(STAP_SLEUTEL) ?? "0");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function bewaarStap(i: number) {
  zet(STAP_SLEUTEL, i > 0 ? String(i) : null);
}

export function startRondleiding() {
  zet(ACTIEF_SLEUTEL, "ja");
  window.dispatchEvent(new Event(EVENT));
}

/** Klaar of overslaan: niet meer tonen, voortgang weg. */
export function stopRondleiding() {
  zet(ACTIEF_SLEUTEL, null);
  zet(STAP_SLEUTEL, null);
  zet(RONDLEIDING_SLEUTEL, "ja");
  window.dispatchEvent(new Event(EVENT));
}

/** Later: venster dicht, maar de stap blijft bewaard om later te hervatten. */
export function pauzeerRondleiding(i: number) {
  zet(ACTIEF_SLEUTEL, null);
  bewaarStap(i);
  window.dispatchEvent(new Event(EVENT));
}

export function opRondleidingWijziging(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
