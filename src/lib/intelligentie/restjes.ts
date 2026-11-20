/**
 * Restjes (usecase 18): na het koken één tik "Er blijft over", daarna stelt Foodlo de restjes
 * voor op Vandaag en in Week, en toont ze in Keuken.
 *
 * Dit bestand is de lijst op het toestel (snel, werkt offline). Fase 3: als de tabel `restjes`
 * bestaat (voorstel 0019), houdt `restjes-db.ts` deze lijst gelijk met het account en het gezin;
 * anders blijft alles op het toestel zoals voordien. Bewust niet in de voorraadtabel: daar zou
 * "Restje spaghetti bolognese" als "spaghetti in huis" tellen voor de lijst en de voorstellen.
 * Geen gezondheidsgegevens: alleen de naam van het gerecht, porties en de kookdatum.
 */
import type { Dieet } from "@/lib/kennismaking";
import { magVoorstellen } from "@/lib/veiligheid";

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
  /** Ingepland om op te eten (YYYY-MM-DD): dan niet opnieuw voorstellen. */
  gepland?: string;
  /** Staat (ook) op het account (fase 3, tabel `restjes`). */
  bron?: "account";
  /** Lokaal gewijzigd, nog niet op het account bewaard (bv. offline). */
  vuil?: boolean;
  /** Wie het bewaarde (account), bv. een gezinslid. */
  door?: string;
  /** Het gezin waarin het op het account staat (vast na bewaren). */
  groep?: string | null;
};

export type Afloop = "opgegeten" | "weggegooid";
/** Een afgesloten restje, voor het kleine verspillingsoverzicht per maand. */
export type AfgeslotenRestje = {
  id: string;
  titel: string;
  porties: number;
  status: Afloop;
  /** Tijdstip van afsluiten (ms). */
  op: number;
};

const sleutel = (userId: string) => `foodlo:restjes:${userId}`;
const afloopSleutel = (userId: string) => `foodlo:restjes-afloop:${userId}`;
const wegSleutel = (userId: string) => `foodlo:restjes-weg:${userId}`;
/** Zo lang onthoudt het toestel afgesloten restjes (voor het overzicht per maand). */
const AFLOOP_BEWAREN = 400;

/** Een nieuwe id: een uuid (past in de tabel), anders tijd + toeval. */
export function nieuweRestjeId(nu = Date.now()): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // Geen crypto: val terug.
  }
  return `${nu}-${Math.random().toString(36).slice(2, 8)}`;
}

function leesJson<T>(s: string): T[] {
  try {
    const ruw = window.localStorage.getItem(s);
    const l = ruw ? (JSON.parse(ruw) as unknown) : [];
    return Array.isArray(l) ? (l as T[]) : [];
  } catch {
    return [];
  }
}
function schrijfJson(s: string, l: unknown[]) {
  try {
    window.localStorage.setItem(s, JSON.stringify(l));
  } catch {
    // Opslag geblokkeerd.
  }
}

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
  return restjes(userId, nu).filter((r) => !r.gepland && dagenOud(r, nu) <= RESTJE_VOORSTEL_DAGEN);
}

export function bewaarRestje(
  userId: string,
  r: { titel: string; receptId: string | null; porties: number },
  nu = Date.now(),
): Restje {
  const titel = r.titel.slice(0, 120);
  // Eén restje per gerecht per dag: opnieuw tikken past de porties aan (zelfde id, zodat het
  // account dezelfde rij bijwerkt in plaats van een tweede te maken).
  const alle = lees(userId);
  const vorige = alle.find(
    (x) => x.receptId === r.receptId && x.titel === titel && dagenOud(x, nu) === 0,
  );
  const nieuw: Restje = {
    id: vorige?.id ?? nieuweRestjeId(nu),
    titel,
    receptId: r.receptId,
    porties: Math.max(1, Math.min(12, Math.round(r.porties))),
    gekookt: nu,
  };
  schrijf(userId, [...alle.filter((x) => x !== vorige), nieuw]);
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

/** Ingepland om op te eten (of `null`: weer vrij, bv. bij ongedaan maken). */
export function planRestje(userId: string, id: string, datum: string | null) {
  schrijf(
    userId,
    lees(userId).map((r) => {
      if (r.id !== id) return r;
      const { gepland: _weg, ...rest } = r;
      return datum ? { ...rest, gepland: datum } : rest;
    }),
  );
}

/** Ongedaan maken: een verwijderd restje terugzetten zoals het was. */
export function zetRestjeTerug(userId: string, r: Restje) {
  vergeetWeg(userId, r.id);
  schrijf(userId, [...lees(userId).filter((x) => x.id !== r.id), r]);
}

/** De hele lijst vervangen (na het ophalen van het account). */
export function vervangRestjes(userId: string, l: readonly Restje[]) {
  schrijf(userId, [...l]);
}

/** Alle restjes zonder opruimen of sorteren (voor de synchronisatie). */
export function ruweRestjes(userId: string): Restje[] {
  return lees(userId);
}

/**
 * Opgegeten of weggegooid: uit de lijst, en onthouden voor het overzicht per maand.
 * Geeft het restje terug (voor ongedaan maken met `heropenRestje`).
 */
export function sluitRestje(
  userId: string,
  id: string,
  status: Afloop,
  nu = Date.now(),
): Restje | null {
  const weg = verwijderRestje(userId, id);
  if (!weg) return null;
  const log = leesJson<AfgeslotenRestje>(afloopSleutel(userId)).filter(
    (a) => a.id !== id && nu - a.op < AFLOOP_BEWAREN * DAG,
  );
  schrijfJson(afloopSleutel(userId), [
    ...log,
    { id, titel: weg.titel, porties: weg.porties, status, op: nu },
  ]);
  return weg;
}

/** Ongedaan maken van opgegeten/weggegooid. */
export function heropenRestje(userId: string, r: Restje) {
  schrijfJson(
    afloopSleutel(userId),
    leesJson<AfgeslotenRestje>(afloopSleutel(userId)).filter((a) => a.id !== r.id),
  );
  zetRestjeTerug(userId, r);
}

/** Afgesloten restjes op dit toestel. */
export function afgeslotenRestjes(userId: string | null | undefined): AfgeslotenRestje[] {
  if (!userId) return [];
  return leesJson<AfgeslotenRestje>(afloopSleutel(userId)).filter(
    (a) =>
      a &&
      typeof a.op === "number" &&
      (a.status === "opgegeten" || a.status === "weggegooid") &&
      typeof a.porties === "number",
  );
}

/**
 * Verwijderd op dit toestel (ongedaan maken van "bewaren"): het account mag het niet terugzetten
 * tot het daar ook weg is. Geldt hooguit een week.
 */
export function merkWeg(userId: string, id: string, nu = Date.now()) {
  const l = leesJson<{ id: string; op: number }>(wegSleutel(userId)).filter(
    (x) => x.id !== id && nu - x.op < OPRUIMEN_NA * DAG,
  );
  schrijfJson(wegSleutel(userId), [...l, { id, op: nu }]);
}
export function wegGemerkt(userId: string): Set<string> {
  return new Set(leesJson<{ id: string }>(wegSleutel(userId)).map((x) => x.id));
}
export function vergeetWeg(userId: string, id: string) {
  const l = leesJson<{ id: string }>(wegSleutel(userId));
  if (l.some((x) => x.id === id))
    schrijfJson(
      wegSleutel(userId),
      l.filter((x) => x.id !== id),
    );
}

export type Verspilling = {
  maand: string;
  opgegeten: number;
  weggegooid: number;
  /** Aandeel weggegooide porties (0–100), of null als er niets gemarkeerd is. */
  procentWeg: number | null;
};

/**
 * Klein overzicht per maand (YYYY-MM): porties opgegeten en weggegooid. Een richtwaarde: het
 * telt alleen wat je zelf markeerde.
 */
export function verspillingVanMaand(
  lijst: readonly Pick<AfgeslotenRestje, "porties" | "status" | "op">[],
  maand: string,
): Verspilling {
  let opgegeten = 0;
  let weggegooid = 0;
  for (const a of lijst) {
    const d = new Date(a.op);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (m !== maand) continue;
    if (a.status === "opgegeten") opgegeten += a.porties;
    else weggegooid += a.porties;
  }
  const totaal = opgegeten + weggegooid;
  return {
    maand,
    opgegeten,
    weggegooid,
    procentWeg: totaal ? Math.round((weggegooid / totaal) * 100) : null,
  };
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

/**
 * Mag Foodlo dit restje voorstellen? Dezelfde regel als voor recepten: met allergieën of een
 * beperkend dieet alleen als de ingrediënten van het recept bekend en veilig zijn.
 */
export function restjeVeilig(
  r: Pick<Restje, "titel">,
  ingredienten: readonly string[] | undefined,
  wie: { allergieen?: readonly string[] | undefined; dieet?: Dieet | null | undefined },
): boolean {
  const streng =
    (wie.allergieen?.length ?? 0) > 0 ||
    wie.dieet === "vegetarisch" ||
    wie.dieet === "veganistisch" ||
    wie.dieet === "pescotarisch";
  if (!streng) return true;
  return magVoorstellen({ title: r.titel, ingredienten: [...(ingredienten ?? [])] }, wie);
}

/**
 * Richtwaarde voor de bewaardatum (P3): "meestal 2 à 3 dagen in de koelkast". Geen
 * veiligheidsbelofte: Foodlo kent je koelkast en het gerecht niet; kijk, ruik en proef.
 */
export function bewaarRichtwaarde(gekookt: number, nu = gekookt): { tot: string; tekst: string } {
  const d = new Date(gekookt);
  d.setDate(d.getDate() + RESTJE_VOORSTEL_DAGEN);
  const dagen = dagenOud({ gekookt }, nu);
  const tot = d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
  return {
    tot,
    tekst:
      dagen > RESTJE_VOORSTEL_DAGEN
        ? "Langer dan 3 dagen geleden gekookt. Twijfel je, eet het dan niet meer."
        : `Meestal 2 à 3 dagen in de koelkast: richtwaarde tot ${tot}. Twijfel je, eet het dan niet meer.`,
  };
}

export type BijnaOp = Restje & { dagenOud: number; laatsteDag: boolean };

/**
 * "Gebruik eerst" op Vandaag: restjes die al 2 of 3 dagen oud zijn (richtwaarde bijna bereikt),
 * de oudste eerst. Ingeplande restjes niet: die staan al op het menu.
 */
export function bijnaOpRestjes(lijst: readonly Restje[], nu = Date.now()): BijnaOp[] {
  return lijst
    .filter((r) => !r.gepland)
    .map((r) => ({ ...r, dagenOud: dagenOud(r, nu) }))
    .filter((r) => r.dagenOud >= RESTJE_VOORSTEL_DAGEN - 1 && r.dagenOud <= RESTJE_VOORSTEL_DAGEN)
    .map((r) => ({ ...r, laatsteDag: r.dagenOud >= RESTJE_VOORSTEL_DAGEN }))
    .sort((a, b) => a.gekookt - b.gekookt);
}

/** Restjes die op een bepaalde dag nog goed zijn (voor een "Restjesdag" in Week). */
export function restjesOpDag(lijst: readonly Restje[], datum: string): Restje[] {
  const t = Date.parse(`${datum}T12:00:00`);
  return lijst
    .filter((r) => !r.gepland)
    .filter((r) => {
      const oud = dagenOud(r, t);
      return oud >= 0 && oud <= RESTJE_VOORSTEL_DAGEN;
    })
    .sort((a, b) => a.gekookt - b.gekookt);
}
