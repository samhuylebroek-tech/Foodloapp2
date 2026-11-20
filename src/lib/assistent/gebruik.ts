/**
 * Kookassistent — hoeveel slimme vragen (AI of testmodus) heb je vandaag nog?
 * Vaste tips zonder AI tellen niet mee: die zijn gratis en onbeperkt. Op het toestel, per gebruiker
 * en per dag; de server heeft daarnaast zijn eigen rem (`kostrem.ts`). Nooit tokens of kosten tonen.
 */
import { AI_LIMIETEN } from "@/lib/betalen/rechten";
import { bewaarRegel, type AiSoort } from "@/lib/ai/gebruik-log";
import { db } from "@/lib/module-beschikbaar";
import { lokaleDatum } from "@/lib/tijd";

/** Uit de centrale rechtenlijst (fase 6): gelijk voor gratis en Premium. */
export const DAGLIMIET = AI_LIMIETEN.gratis.assistentPerDag;

export type Gebruik = { dag: string; aantal: number };

export function resterend(stand: Gebruik | null, dag: string, limiet = DAGLIMIET): number {
  if (!stand || stand.dag !== dag) return limiet;
  return Math.max(0, limiet - stand.aantal);
}

export function telOp(stand: Gebruik | null, dag: string): Gebruik {
  if (!stand || stand.dag !== dag) return { dag, aantal: 1 };
  return { dag, aantal: stand.aantal + 1 };
}

const sleutel = (userId: string) => `foodlo:assistent:gebruik:${userId}`;

export function leesGebruik(userId: string | null | undefined): Gebruik | null {
  if (!userId) return null;
  try {
    const ruw = JSON.parse(
      window.localStorage.getItem(sleutel(userId)) ?? "null",
    ) as Partial<Gebruik> | null;
    if (!ruw || typeof ruw.dag !== "string" || typeof ruw.aantal !== "number") return null;
    return { dag: ruw.dag, aantal: ruw.aantal };
  } catch {
    return null;
  }
}

/**
 * Telt één slimme vraag; geeft wat er vandaag nog overblijft. Fase 7: ook in het gebruikslog
 * (dag + soort, geen inhoud) en, als voorstel 0024 er is, als dagtotaal op je account.
 */
export function registreerVraag(
  userId: string,
  soort: AiSoort = "kookhulp.vraag",
  nu = new Date(),
): number {
  const dag = lokaleDatum(nu);
  const nieuw = telOp(leesGebruik(userId), dag);
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(nieuw));
  } catch {
    /* privévenster: niet bewaren */
  }
  bewaarRegel(userId, { dag, soort });
  telOpAccount(soort, false);
  return resterend(nieuw, dag);
}

/** Een antwoord uit de cache: telt niet mee voor de limiet, wel zichtbaar als "uit de cache". */
export function registreerCache(userId: string, soort: AiSoort, nu = new Date()) {
  bewaarRegel(userId, { dag: lokaleDatum(nu), soort, cache: true });
  telOpAccount(soort, true);
}

/** Voorstel 0024: +1 op je dagtotaal (en het anonieme totaal). Bestaat de functie niet: niets. */
function telOpAccount(soort: AiSoort, cache: boolean) {
  try {
    void db.rpc("ai_gebruik_tel", { p_soort: soort, p_cache: cache }).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    /* meten mag nooit iets breken */
  }
}

export function nogVandaag(userId: string | null | undefined, nu = new Date()): number {
  return resterend(leesGebruik(userId), lokaleDatum(nu));
}
