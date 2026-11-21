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

// ---------------------------------------------------------------- "Niet voor mij" (P3)

/**
 * "Niet voor mij": dit recept niet meer voorstellen, tot je het zelf terugzet. Ook alleen op dit
 * toestel tot voorstel 0006 (signaal `niet_voor_mij`). Je eigen recept blijft gewoon bestaan.
 */
const nietVoorMijSleutel = (userId: string) => `foodlo:niet-voor-mij:${userId}`;

function leesNietVoorMij(userId: string): string[] {
  try {
    const ruw = window.localStorage.getItem(nietVoorMijSleutel(userId));
    const l = ruw ? (JSON.parse(ruw) as unknown) : [];
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function schrijfNietVoorMij(userId: string, l: string[]) {
  try {
    window.localStorage.setItem(nietVoorMijSleutel(userId), JSON.stringify([...new Set(l)]));
  } catch {
    // Opslag geblokkeerd: dan geldt het tot je de pagina sluit.
  }
}

export function nietVoorMijLijst(userId: string | null | undefined): string[] {
  return userId ? leesNietVoorMij(userId) : [];
}

export function zetNietVoorMij(userId: string, receptId: string) {
  schrijfNietVoorMij(userId, [...leesNietVoorMij(userId), receptId]);
}

export function herstelNietVoorMij(userId: string, receptId: string) {
  schrijfNietVoorMij(
    userId,
    leesNietVoorMij(userId).filter((id) => id !== receptId),
  );
}

/** Alles wat Foodlo nu niet mag voorstellen: "Niet nu" (7 dagen) en "Niet voor mij". */
export function nietTonenLijst(userId: string | null | undefined, nu = Date.now()): string[] {
  return [...new Set([...nietNuLijst(userId, nu), ...nietVoorMijLijst(userId)])];
}
