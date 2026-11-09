import { useSyncExternalStore } from "react";

/** WP6 — tabletbreedte (768–1023 px), gelijk aan Tailwinds `md` tot `lg`. */
const VRAAG = "(min-width: 768px) and (max-width: 1023.98px)";

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
