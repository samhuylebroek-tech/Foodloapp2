/**
 * Fase 8 — "AI uit" echt afdwingen, ook op de server.
 *
 * Twee bronnen, intrekken wint:
 * 1. de keuze op dit toestel: de browser stuurt bij elke serverfunctie de kop `x-foodlo-ai: uit`
 *    mee (globale middleware in src/start.ts). Een gebruiker kan die kop alleen gebruiken om
 *    zichzelf te beperken, dus vertrouwen is hier geen risico;
 * 2. de keuze op het account (tabel `toestemmingen`, voorstel 0025), gelezen met de service-sleutel
 *    en gefilterd op de gebruiker uit het gecontroleerde token.
 * Ontbreekt de tabel (productie vóór 0025), dan telt alleen het toestel.
 */
export const AI_KOP = "x-foodlo-ai";
export const AI_UIT_MELDING =
  "Je hebt slimme hulp (AI) uitgezet in Instellingen › Privacy & toestemmingen. Zet ze daar weer aan om dit te gebruiken.";

/** Zuivere regel (getest). */
export function aiUitgezet(kop: string | null | undefined, rij: { aan?: unknown } | null): boolean {
  if ((kop ?? "").trim().toLowerCase() === "uit") return true;
  return rij?.aan === false;
}
