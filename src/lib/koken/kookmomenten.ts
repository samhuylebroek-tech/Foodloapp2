/**
 * Kookmomenten (P3): "Gekookt" voor een geplande maaltijd, met porties en een eigen notitie bij
 * het recept. Alleen voor jezelf (de notitie is vrije tekst: nooit naar AI, nooit gedeeld).
 *
 * Op je account in tabel `kookmomenten` (voorstel 0015, niet uitgevoerd). Zolang die tabel niet
 * bestaat, bewaart Foodlo het op dit toestel (zelfde vorm), zodat Vandaag en het recept het toch
 * weten. Deze module is puur (plus localStorage); de databankkant staat in `kookmomenten-db.ts`.
 */
export const NOTITIE_MAX = 500;
const MAX_LOKAAL = 200;

export type Kookmoment = {
  id: string;
  recipe_id: string | null;
  meal_plan_id: string | null;
  /** ISO-tijdstip van koken. */
  gekookt_op: string;
  porties: number | null;
  notitie: string | null;
};

export type NieuwKookmoment = {
  recipeId: string | null;
  planId: string | null;
  porties?: number | null;
  notitie?: string | null;
};

/** Notitie opkuisen: spaties weg, hooguit 500 tekens, leeg = null. */
export function schoonNotitie(tekst: string | null | undefined): string | null {
  const t = (tekst ?? "").replace(/\s+\n/g, "\n").trim().slice(0, NOTITIE_MAX);
  return t ? t : null;
}

export function schoonPorties(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.max(1, Math.min(50, Math.round(n)));
}

/** Rij voor de databank of het toestel. */
export function maakKookmoment(m: NieuwKookmoment, nu = new Date(), id?: string): Kookmoment {
  return {
    id: id ?? `${nu.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    recipe_id: m.recipeId,
    meal_plan_id: m.planId,
    gekookt_op: nu.toISOString(),
    porties: schoonPorties(m.porties ?? null),
    notitie: schoonNotitie(m.notitie),
  };
}

/** Welke geplande maaltijden zijn gekookt? */
export function gekooktePlannen(momenten: readonly Kookmoment[]): Set<string> {
  return new Set(momenten.map((m) => m.meal_plan_id).filter((x): x is string => !!x));
}

/** Notities bij een recept, nieuwste eerst. */
export function notitiesVoor(momenten: readonly Kookmoment[], receptId: string, max = 5) {
  return momenten
    .filter((m) => m.recipe_id === receptId && m.notitie)
    .sort((a, b) => b.gekookt_op.localeCompare(a.gekookt_op))
    .slice(0, max);
}

/** Laatst gekookt (ISO) of null. */
export function laatstGekookt(momenten: readonly Kookmoment[], receptId: string): string | null {
  let laatst: string | null = null;
  for (const m of momenten)
    if (m.recipe_id === receptId && (!laatst || m.gekookt_op > laatst)) laatst = m.gekookt_op;
  return laatst;
}

// ---------------------------------------------------------------- toestel (terugval)

const sleutel = (userId: string) => `foodlo:kookmomenten:${userId}`;
export const KOOKMOMENTEN_GEWIJZIGD = "foodlo:kookmomenten";

export function leesLokaal(userId: string): Kookmoment[] {
  try {
    const ruw = window.localStorage.getItem(sleutel(userId));
    const l = ruw ? (JSON.parse(ruw) as unknown) : [];
    return Array.isArray(l)
      ? (l as Kookmoment[]).filter((m) => m && typeof m.gekookt_op === "string")
      : [];
  } catch {
    return [];
  }
}

export function schrijfLokaal(userId: string, l: readonly Kookmoment[]) {
  try {
    window.localStorage.setItem(
      sleutel(userId),
      JSON.stringify(
        [...l].sort((a, b) => b.gekookt_op.localeCompare(a.gekookt_op)).slice(0, MAX_LOKAAL),
      ),
    );
  } catch {
    // Opslag geblokkeerd (privévenster): dan geldt het tot je de pagina sluit.
  }
  try {
    window.dispatchEvent(new Event(KOOKMOMENTEN_GEWIJZIGD));
  } catch {
    // Geen browser (tests).
  }
}

/**
 * Eén moment per geplande maaltijd: opnieuw "Gekookt" voor dezelfde maaltijd vervangt het vorige.
 * Geeft de nieuwe lijst en wat er vervangen werd (voor ongedaan maken).
 */
export function voegToe(
  lijst: readonly Kookmoment[],
  m: Kookmoment,
): { lijst: Kookmoment[]; vervangen: Kookmoment | null } {
  const vervangen = m.meal_plan_id
    ? (lijst.find((x) => x.meal_plan_id === m.meal_plan_id) ?? null)
    : null;
  return { lijst: [...lijst.filter((x) => x !== vervangen), m], vervangen };
}
