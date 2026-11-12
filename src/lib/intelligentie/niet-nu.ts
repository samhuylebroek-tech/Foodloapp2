/**
 * "Niet nu" (Feedback Engine, I-1): een voorstel 7 dagen niet meer tonen.
 * Voorlopig alleen op dit toestel; met voorstel 0006 komt het op je account (alleen voor jou).
 * Geen gezondheidsgegevens: alleen recept-id en datum.
 */
export const NIET_NU_DAGEN = 7;
const DAG = 86400000;
const sleutel = (userId: string) => `foodlo:niet-nu:${userId}`;

type Lijst = Record<string, number>; // recept-id -> tijdstip "niet nu"

function lees(userId: string): Lijst {
  try {
    const ruw = window.localStorage.getItem(sleutel(userId));
    const l = ruw ? (JSON.parse(ruw) as unknown) : {};
    return l && typeof l === "object" && !Array.isArray(l) ? (l as Lijst) : {};
  } catch {
    return {};
  }
}

function schrijf(userId: string, l: Lijst) {
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(l));
  } catch {
    // Opslag geblokkeerd (privévenster): dan geldt "niet nu" alleen tot je de pagina sluit.
  }
}

/** Geldige "Niet nu"-recepten; verlopen regels worden meteen opgeruimd. */
export function nietNuLijst(userId: string | null | undefined, nu = Date.now()): string[] {
  if (!userId) return [];
  const l = lees(userId);
  const geldig: Lijst = {};
  for (const [id, t] of Object.entries(l))
    if (typeof t === "number" && nu - t < NIET_NU_DAGEN * DAG) geldig[id] = t;
  if (Object.keys(geldig).length !== Object.keys(l).length) schrijf(userId, geldig);
  return Object.keys(geldig);
}

export function zetNietNu(userId: string, receptId: string, nu = Date.now()) {
  schrijf(userId, { ...lees(userId), [receptId]: nu });
}

export function herstelNietNu(userId: string, receptId: string) {
  const l = lees(userId);
  delete l[receptId];
  schrijf(userId, l);
}
