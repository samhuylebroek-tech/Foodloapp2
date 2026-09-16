// Eén rondleiding-systeem: de overlay leeft in AppShell, dit bestand bewaart alleen de status.
export const RONDLEIDING_SLEUTEL = "rondleiding_gezien";
const ACTIEF_SLEUTEL = "rondleiding_actief";
const EVENT = "rondleiding-wijziging";

export function rondleidingActief(): boolean {
  try {
    return window.localStorage.getItem(ACTIEF_SLEUTEL) === "ja";
  } catch {
    return false;
  }
}

export function startRondleiding() {
  try {
    window.localStorage.setItem(ACTIEF_SLEUTEL, "ja");
  } catch {
    /* niets */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function stopRondleiding() {
  try {
    window.localStorage.removeItem(ACTIEF_SLEUTEL);
    window.localStorage.setItem(RONDLEIDING_SLEUTEL, "ja");
  } catch {
    /* niets */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function opRondleidingWijziging(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
