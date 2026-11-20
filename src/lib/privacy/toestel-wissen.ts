/**
 * Fase 8 — Na het verwijderen van het account: ook alles van Foodlo op dit toestel weg
 * (localStorage, sessionStorage, IndexedDB, offline-cache van de service worker). Anders blijven
 * bv. allergieën die "alleen op dit toestel" stonden, de offline kopie van je lijst en de
 * AI-cache achter op een gedeeld toestel.
 *
 * Deze oorsprong (het webadres van de app) is alleen van Foodlo: alles wat hier bewaard staat, is
 * van Foodlo of van de aanmelding. Daarom wissen we alles, ook oudere sleutels zonder voorvoegsel
 * ("majeba-gelezen-berichten", "melding-keuze-gemaakt" …): een lijst bijhouden zou vroeg of laat
 * iets missen.
 */

type Opslag = {
  length: number;
  key: (i: number) => string | null;
  removeItem: (k: string) => void;
};

export function wisOpslag(opslag: Opslag | undefined): number {
  if (!opslag) return 0;
  const alle: string[] = [];
  for (let i = 0; i < opslag.length; i++) {
    const k = opslag.key(i);
    if (k) alle.push(k);
  }
  for (const k of alle) opslag.removeItem(k);
  return alle.length;
}

export type ToestelVerslag = { sleutels: number; databanken: number; caches: number };

/** Wist alles van Foodlo op dit toestel. Faalt nooit (elke stap apart, stil). */
export async function wisToestelGegevens(): Promise<ToestelVerslag> {
  const v: ToestelVerslag = { sleutels: 0, databanken: 0, caches: 0 };
  if (typeof window === "undefined") return v;
  try {
    v.sleutels += wisOpslag(window.localStorage);
  } catch {
    /* geblokkeerd: niets te doen */
  }
  try {
    v.sleutels += wisOpslag(window.sessionStorage);
  } catch {
    /* idem */
  }
  try {
    const idb = window.indexedDB as IDBFactory & {
      databases?: () => Promise<{ name?: string }[]>;
    };
    const lijst = (await idb?.databases?.()) ?? [];
    for (const d of lijst) {
      if (!d.name) continue;
      idb.deleteDatabase(d.name);
      v.databanken++;
    }
  } catch {
    /* oudere browser zonder databases() */
  }
  try {
    if ("caches" in window) {
      for (const naam of await window.caches.keys()) {
        await window.caches.delete(naam);
        v.caches++;
      }
    }
  } catch {
    /* geen Cache Storage */
  }
  return v;
}
