/**
 * Voorstellen (Vanavond, "Laat Foodlo kiezen") houden rekening met wie meeeet.
 *
 * - Een gerecht dat niet veilig is voor een mee-eter, stelt Foodlo niet voor.
 * - Kies je het toch zelf, dan staat er "Niet geschikt voor Lotte". De reden (welke allergie,
 *   welk dieet) staat er alleen bij als het lid die deelt, of als jij het lid bent of beheert
 *   (`magRedenZien` in gezin-veiligheid.ts).
 * - Leden waarvan je de gegevens niet mag lezen, krijgen het oordeel van de server (alleen
 *   waar/onwaar, voorstel 0010).
 *
 * Alles op het toestel; niets hiervan gaat naar een AI.
 */
import {
  oordeelVoorEters,
  type EterOordeel,
  type HuishoudenLid,
  type LidVoeding,
} from "@/lib/gezin-veiligheid";
import type { Gerecht } from "@/lib/veiligheid";

export type EtersContext = {
  eters: readonly HuishoudenLid[];
  voeding: ReadonlyMap<string, LidVoeding>;
  kijkerId: string | null | undefined;
  /** Serveroordeel per recept-id, per lid-id (alleen voor leden zonder leesbare gegevens). */
  server?: Readonly<Record<string, ReadonlyMap<string, boolean>>>;
};

/** Oordeel per mee-eter voor één gerecht. */
export function oordelenVoor(g: Gerecht & { id: string }, ctx: EtersContext): EterOordeel[] {
  if (!ctx.eters.length) return [];
  return oordeelVoorEters(g, ctx.eters, ctx.voeding, ctx.kijkerId, ctx.server?.[g.id]);
}

/** true als het gerecht voor minstens één mee-eter niet veilig is. */
export function nietGeschikt(g: Gerecht & { id: string }, ctx: EtersContext): boolean {
  return oordelenVoor(g, ctx).some((o) => o.veilig === false);
}

/** Namen opsommen: "Lotte", "Lotte en Gust", "Lotte, Gust en Jan". */
export function namenLijst(namen: readonly string[]): string {
  if (namen.length <= 1) return namen[0] ?? "";
  return `${namen.slice(0, -1).join(", ")} en ${namen[namen.length - 1]}`;
}

/**
 * "Niet geschikt voor Lotte" of, als de reden gedeeld is, "Niet geschikt voor Gust (past niet
 * bij vegetarisch)". Null als het voor iedereen past.
 */
export function etiketVoorEters(oordelen: readonly EterOordeel[]): string | null {
  const niet = oordelen.filter((o) => o.veilig === false);
  if (!niet.length) return null;
  const basis = `Niet geschikt voor ${namenLijst(niet.map((o) => o.naam))}`;
  const redenen = niet.filter((o) => o.reden).map((o) => `${o.naam}: ${o.reden}`);
  return redenen.length ? `${basis} (${redenen.join("; ")})` : basis;
}

/**
 * Filtert voorstellen: eerst wat voor iedereen past. Past niets, dan blijven de gerechten wel
 * staan (met etiket), zodat er nooit een leeg scherm is zonder uitleg.
 */
export function veiligVoorEters<T extends { id: string }>(
  lijst: readonly T[],
  gerecht: (x: T) => Gerecht,
  ctx: EtersContext,
): { veilig: T[]; weggelaten: number } {
  if (!ctx.eters.length) return { veilig: [...lijst], weggelaten: 0 };
  const veilig = lijst.filter((x) => !nietGeschikt({ ...gerecht(x), id: x.id }, ctx));
  return { veilig, weggelaten: lijst.length - veilig.length };
}

/** "Voorgesteld voor Marie, Jan, Lotte en Gust." */
export function voorWieTekst(eters: readonly Pick<HuishoudenLid, "naam">[]): string | null {
  if (!eters.length) return null;
  return `Rekening gehouden met ${namenLijst(eters.map((e) => e.naam))}`;
}
