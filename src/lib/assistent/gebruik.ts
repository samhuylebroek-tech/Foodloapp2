/**
 * Kookassistent — hoeveel slimme vragen (AI of testmodus) heb je vandaag nog?
 * Vaste tips zonder AI tellen niet mee: die zijn gratis en onbeperkt. Op het toestel, per gebruiker
 * en per dag; de server heeft daarnaast zijn eigen rem (`kostrem.ts`). Nooit tokens of kosten tonen.
 */
import { lokaleDatum } from "@/lib/tijd";

export const DAGLIMIET = 20;

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

/** Telt één slimme vraag; geeft wat er vandaag nog overblijft. */
export function registreerVraag(userId: string, nu = new Date()): number {
  const dag = lokaleDatum(nu);
  const nieuw = telOp(leesGebruik(userId), dag);
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(nieuw));
  } catch {
    /* privévenster: niet bewaren */
  }
  return resterend(nieuw, dag);
}

export function nogVandaag(userId: string | null | undefined, nu = new Date()): number {
  return resterend(leesGebruik(userId), lokaleDatum(nu));
}
