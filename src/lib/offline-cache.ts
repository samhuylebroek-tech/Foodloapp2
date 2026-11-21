/**
 * P6 — Offline: de laatst bekende Week, Lijst en Vandaag blijven zichtbaar, ook na herladen
 * zonder internet. We bewaren alleen die gegevens (geen recepten-zoekresultaten, geen
 * voorkeuren of allergieën) op dit toestel, met een maximale leeftijd, en wissen ze bij afmelden.
 *
 * Geen extra pakket: `dehydrate`/`hydrate` zitten in @tanstack/react-query zelf.
 */
import { dehydrate, hydrate, type QueryClient, type QueryKey } from "@tanstack/react-query";

export const OFFLINE_CACHE_SLEUTEL = "foodlo:offline-cache";
/** Ouder dan een week tonen we niet meer als "laatst bekend". */
export const MAX_LEEFTIJD_MS = 7 * 86_400_000;

/** Alleen deze gegevens: lijsten en items, het weekmenu en het dagmenu van Vandaag. */
const BEWAARD = new Set([
  "shopping-lists",
  "shopping",
  "meal-plan",
  "planner-gezin",
  "home-dagmenu",
  "home-week",
]);

export function moetBewaren(key: QueryKey): boolean {
  return typeof key[0] === "string" && BEWAARD.has(key[0]);
}

type Bewaard = { v: 1; op: number; staat: unknown };

/** Pure keuze: is wat er bewaard staat nog bruikbaar? */
export function bruikbaar(ruw: string | null, nu = Date.now()): Bewaard | null {
  if (!ruw) return null;
  try {
    const b = JSON.parse(ruw) as Bewaard;
    if (b?.v !== 1 || typeof b.op !== "number" || !b.staat) return null;
    if (nu - b.op > MAX_LEEFTIJD_MS || b.op > nu + 60_000) return null;
    return b;
  } catch {
    return null;
  }
}

/**
 * Bij het starten zonder internet: de laatst bekende gegevens terugzetten. Online laden we
 * gewoon vers (geen flits van oude gegevens waarop je per ongeluk zou tikken).
 */
export function herstelOfflineCache(qc: QueryClient) {
  if (typeof window === "undefined" || navigator.onLine) return;
  let ruw: string | null = null;
  try {
    ruw = window.localStorage.getItem(OFFLINE_CACHE_SLEUTEL);
  } catch {
    return;
  }
  const b = bruikbaar(ruw);
  if (!b) {
    wisOfflineCache();
    return;
  }
  try {
    hydrate(qc, b.staat);
  } catch {
    wisOfflineCache();
  }
}

/** Telkens iets uit de lijst van hierboven geladen of veranderd is: (gebundeld) bewaren. */
export function bewaarOfflineCache(qc: QueryClient): () => void {
  if (typeof window === "undefined") return () => undefined;
  let klok: ReturnType<typeof setTimeout> | null = null;
  const schrijf = () => {
    klok = null;
    try {
      const staat = dehydrate(qc, {
        shouldDehydrateQuery: (q) => q.state.status === "success" && moetBewaren(q.queryKey),
      });
      if (!staat.queries.length) return;
      const b: Bewaard = { v: 1, op: Date.now(), staat };
      window.localStorage.setItem(OFFLINE_CACHE_SLEUTEL, JSON.stringify(b));
    } catch {
      // Vol of geblokkeerd: dan werkt alleen het geheugen van dit tabblad.
    }
  };
  const stop = qc.getQueryCache().subscribe((e) => {
    if (e.type !== "updated" || !moetBewaren(e.query.queryKey)) return;
    if (!klok) klok = setTimeout(schrijf, 500);
  });
  return () => {
    stop();
    if (klok) clearTimeout(klok);
  };
}

export function wisOfflineCache() {
  try {
    window.localStorage.removeItem(OFFLINE_CACHE_SLEUTEL);
  } catch {
    // niets aan te doen
  }
}
