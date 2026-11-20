/**
 * Fase 7 — Dezelfde slimme vraag niet twee keer betalen.
 *
 * Op het toestel, per gebruiker: sleutel = hash van (soort, vraag, recept) na opschonen, geldig
 * 24 uur, hooguit 50 antwoorden. Alleen antwoorden van de slimme hulp of de testmodus, nooit de
 * vaste regels (die zijn al gratis). De vraag zelf wordt niet bewaard, alleen de hash.
 * Veilig: het antwoord wordt bij het tonen opnieuw door de veiligheidsfilter gehaald
 * (toetsVervangers), dus een allergie die je intussen toevoegde, telt meteen.
 *
 * De server heeft daarnaast zijn eigen cache (`metCredits`, cacheSleutel).
 */
import { normaliseerTekst } from "@/lib/zoeken";

export const CACHE_GELDIG_MS = 24 * 60 * 60 * 1000;
export const CACHE_MAX = 50;

/** FNV-1a (32 bit) als hex: kort, stabiel, geen cryptografie nodig (geen geheim). */
export function hashVan(tekst: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function cacheSleutel(soort: string, vraag: string, recept = ""): string {
  return hashVan(`${soort}|${normaliseerTekst(vraag)}|${normaliseerTekst(recept)}`);
}

type Rij<T> = { k: string; t: number; v: T };

/** Puur: geldige rij voor deze sleutel, of null. */
export function zoek<T>(rijen: readonly Rij<T>[], k: string, nu: number): T | null {
  const r = rijen.find((x) => x.k === k);
  return r && nu - r.t < CACHE_GELDIG_MS ? r.v : null;
}

/** Puur: rij erbij (vervangt dezelfde sleutel), verlopen eruit, hooguit CACHE_MAX. */
export function zet<T>(rijen: readonly Rij<T>[], k: string, v: T, nu: number): Rij<T>[] {
  return [...rijen.filter((x) => x.k !== k && nu - x.t < CACHE_GELDIG_MS), { k, t: nu, v }].slice(
    -CACHE_MAX,
  );
}

const opslag = (userId: string) => `foodlo:ai-cache:${userId}`;

function lees<T>(userId: string): Rij<T>[] {
  try {
    const ruw = JSON.parse(window.localStorage.getItem(opslag(userId)) ?? "[]") as unknown;
    return Array.isArray(ruw)
      ? (ruw.filter((r) => r && typeof r.k === "string" && typeof r.t === "number") as Rij<T>[])
      : [];
  } catch {
    return [];
  }
}

export function uitCache<T>(userId: string, k: string, nu = Date.now()): T | null {
  return zoek(lees<T>(userId), k, nu);
}

export function inCache<T>(userId: string, k: string, v: T, nu = Date.now()) {
  try {
    window.localStorage.setItem(opslag(userId), JSON.stringify(zet(lees<T>(userId), k, v, nu)));
  } catch {
    /* privévenster: geen cache */
  }
}

/** Alles weg (bv. bij afmelden of op vraag). */
export function wisCache(userId: string) {
  try {
    window.localStorage.removeItem(opslag(userId));
  } catch {
    /* niets */
  }
}
