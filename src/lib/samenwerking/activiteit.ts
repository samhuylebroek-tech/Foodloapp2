/**
 * P5 — "Wie veranderde wat" per week (gezin), en wie er nu meekijkt (aanwezigheid).
 * Puur en getest in activiteit.test.ts. Opslag: `gezin_activiteit` (voorstel 0017); alleen
 * actieve leden van het gezin lezen die (databankregels) en de app toont ze alleen in het
 * gezinsweekmenu.
 */
import { wieTekst } from "@/lib/samenwerking/conflict";

export type ActiviteitSoort = "menu" | "lijst" | "toewijzing" | "winkelen" | "conflict";

export type Activiteit = {
  id: string;
  group_id: string;
  actor_id: string;
  soort: ActiviteitSoort;
  tekst: string;
  /** De dag waarover het gaat (maaltijd) of waarop het gebeurde (lijst), YYYY-MM-DD. */
  datum: string;
  ref_id: string | null;
  created_at: string;
};

/** Wat in deze week (maandag t/m zondag) gebeurde, nieuwste eerst. */
export function activiteitVanWeek(
  lijst: readonly Activiteit[],
  van: string,
  tot: string,
): Activiteit[] {
  return lijst
    .filter((a) => a.datum >= van && a.datum <= tot)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/** Wie veranderde dit (maaltijd of item) het laatst? Voor de conflictmelding. */
export function laatsteWijziger(
  lijst: readonly Pick<Activiteit, "actor_id" | "ref_id" | "created_at">[],
  refId: string,
  zelf?: string | null,
): string | null {
  const r = lijst
    .filter((a) => a.ref_id === refId && a.actor_id !== zelf)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return r?.actor_id ?? null;
}

/** Per persoon tellen ("Marie 3 · Jan 2") voor de samenvatting boven de lijst. */
export function telPerPersoon(
  lijst: readonly Activiteit[],
  namen: Readonly<Record<string, string>>,
): string {
  const tel = new Map<string, number>();
  for (const a of lijst) tel.set(a.actor_id, (tel.get(a.actor_id) ?? 0) + 1);
  return [...tel.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${wieTekst(namen[id])} ${n}`)
    .join(" · ");
}

// ------------------------------------------------------------------ aanwezigheid

export type Aanwezige = { user_id: string; naam: string; bezig: boolean };

/**
 * "Jan is de lijst aan het bewerken" / "Jan en Lotte kijken ook naar het weekmenu" / null.
 * Jezelf (ook op een tweede toestel) telt niet.
 */
export function aanwezigTekst(
  wie: readonly Aanwezige[],
  zelf: string | null | undefined,
  plek: "de lijst" | "het weekmenu",
): string | null {
  const anderen = new Map<string, Aanwezige>();
  for (const a of wie) {
    if (!a.user_id || a.user_id === zelf) continue;
    const vorig = anderen.get(a.user_id);
    anderen.set(a.user_id, { ...a, bezig: a.bezig || !!vorig?.bezig });
  }
  const l = [...anderen.values()];
  if (!l.length) return null;
  const namen = (x: Aanwezige[]) => {
    const n = x.map((a) => wieTekst(a.naam));
    return n.length === 1 ? n[0]! : `${n.slice(0, -1).join(", ")} en ${n[n.length - 1]}`;
  };
  const bezig = l.filter((a) => a.bezig);
  if (bezig.length)
    return `${namen(bezig)} ${bezig.length === 1 ? "is" : "zijn"} ${plek} aan het bewerken`;
  return `${namen(l)} ${l.length === 1 ? "kijkt" : "kijken"} ook naar ${plek}`;
}
