import { useSyncExternalStore } from "react";

/** WP6 — tablet en kleine laptop (768–1279 px): week|dag i.p.v. het 7-koloms raster (dat pas vanaf 1280 px leesbaar is). */
const VRAAG = "(min-width: 768px) and (max-width: 1279.98px)";

function abonneer(melding: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(VRAAG);
  mql.addEventListener("change", melding);
  return () => mql.removeEventListener("change", melding);
}

/** true op tabletbreedte. Op de server en bij het eerste renderen: false (telefoonweergave). */
export function useTablet() {
  return useSyncExternalStore(
    abonneer,
    () =>
      typeof window !== "undefined" && window.matchMedia ? window.matchMedia(VRAAG).matches : false,
    () => false,
  );
}
