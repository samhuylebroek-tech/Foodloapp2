/**
 * Restjes (usecase 18): na het koken één tik "Er blijft over", daarna stelt Foodlo de restjes
 * voor op Vandaag en in Week, en toont ze in Keuken.
 *
 * Voorlopig alleen op dit toestel (zoals "Niet nu"). Bewust niet in de voorraadtabel: daar zou
 * "Restje spaghetti bolognese" als "spaghetti in huis" tellen voor de lijst en de voorstellen.
 * Naar het account (en gedeeld met het huishouden) kan pas met een eigen kolom of tabel na een
 * goedgekeurde migratie (zie FOODLOAPP-INTELLIGENCE-ARCHITECTUUR §8).
 * Geen gezondheidsgegevens: alleen de naam van het gerecht, porties en de kookdatum.
 */
const DAG = 86400000;
/** Na zoveel dagen stelt Foodlo een restje niet meer voor (algemene richtlijn: 2 à 3 dagen in de koelkast). */
export const RESTJE_VOORSTEL_DAGEN = 3;
/** Na zoveel dagen ruimt Foodlo een restje zelf op uit de lijst op dit toestel. */
const OPRUIMEN_NA = 7;

export type Restje = {
  id: string;
  titel: string;
  receptId: string | null;
  porties: number;
  /** Tijdstip van koken (ms). */
  gekookt: number;
};

const sleutel = (userId: string) => `foodlo:restjes:${userId}`;

function lees(userId: string): Restje[] {
  try {
    const ruw = window.localStorage.getItem(sleutel(userId));
    const l = ruw ? (JSON.parse(ruw) as unknown) : [];
    return Array.isArray(l)
      ? (l as Restje[]).filter(
          (r) => r && typeof r.titel === "string" && typeof r.gekookt === "number",
        )
      : [];
  } catch {
    return [];
  }
}

function schrijf(userId: string, l: Restje[]) {
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(l));
  } catch {
    // Opslag geblokkeerd (privévenster): het restje geldt dan alleen tot je de pagina sluit.
  }
  try {
    window.dispatchEvent(new Event("foodlo:restjes"));
  } catch {
    // Geen browser (tests).
  }
}

/** Alle restjes, nieuwste eerst; wat ouder is dan een week, wordt opgeruimd. */
export function restjes(userId: string | null | undefined, nu = Date.now()): Restje[] {
  if (!userId) return [];
  const l = lees(userId);
  const geldig = l.filter((r) => nu - r.gekookt < OPRUIMEN_NA * DAG);
  if (geldig.length !== l.length) schrijf(userId, geldig);
  return [...geldig].sort((a, b) => b.gekookt - a.gekookt);
}

/** Restjes die Foodlo nog mag voorstellen (hooguit 3 dagen oud). */
export function voorTeStellenRestjes(userId: string | null | undefined, nu = Date.now()) {
  return restjes(userId, nu).filter((r) => dagenOud(r, nu) <= RESTJE_VOORSTEL_DAGEN);
}

export function bewaarRestje(
  userId: string,
  r: { titel: string; receptId: string | null; porties: number },
  nu = Date.now(),
): Restje {
  const nieuw: Restje = {
    id: `${nu}-${Math.random().toString(36).slice(2, 8)}`,
    titel: r.titel.slice(0, 120),
    receptId: r.receptId,
    porties: Math.max(1, Math.min(12, Math.round(r.porties))),
    gekookt: nu,
  };
  // Eén restje per gerecht per dag: opnieuw tikken past de porties aan.
  const rest = lees(userId).filter(
    (x) => !(x.receptId === nieuw.receptId && x.titel === nieuw.titel && dagenOud(x, nu) === 0),
  );
  schrijf(userId, [...rest, nieuw]);
  return nieuw;
}

export function verwijderRestje(userId: string, id: string): Restje | null {
  const l = lees(userId);
  const weg = l.find((r) => r.id === id) ?? null;
  schrijf(
    userId,
    l.filter((r) => r.id !== id),
  );
  return weg;
}

/** Ongedaan maken: een verwijderd restje terugzetten zoals het was. */
export function zetRestjeTerug(userId: string, r: Restje) {
  schrijf(userId, [...lees(userId).filter((x) => x.id !== r.id), r]);
}

/** Hele kalenderdagen sinds het koken (0 = vandaag, 1 = gisteren). */
export function dagenOud(r: Pick<Restje, "gekookt">, nu = Date.now()): number {
  const dag = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((dag(nu) - dag(r.gekookt)) / DAG);
}

export function gekooktTekst(r: Pick<Restje, "gekookt">, nu = Date.now()): string {
  const d = dagenOud(r, nu);
  if (d <= 0) return "vandaag gekookt";
  if (d === 1) return "gisteren gekookt";
  return `${d} dagen geleden gekookt`;
}
