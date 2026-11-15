/**
 * Wie eet mee bij een geplande maaltijd?
 *
 * - Bewaard per maaltijd in `maaltijd_eters` (voorstel 0010). Bestaat die tabel nog niet
 *   (productie vóór de migratie), dan op dit toestel.
 * - Niets bewaard = de standaard van het huishouden: iedereen eet mee.
 * - Alleen lid-id's; nooit allergieën of dieet. Niets hiervan gaat naar een AI.
 */
import type { HuishoudenLid, LidVoeding } from "@/lib/gezin-veiligheid";
import type { Dieet } from "@/lib/kennismaking";
import { LEGE_VOEDING } from "@/lib/persoonlijke-voeding";
import { zelfdeProduct } from "@/lib/product-herkenning";

/** De mee-eters van één maaltijd: wat bewaard is, of anders het hele huishouden. */
export function etersVoorMaaltijd<T extends Pick<HuishoudenLid, "id">>(
  leden: readonly T[],
  bewaard: readonly string[] | null | undefined,
): T[] {
  if (!bewaard?.length) return [...leden];
  const gekozen = leden.filter((l) => bewaard.includes(l.id));
  // Alle bewaarde leden verwijderd uit het gezin: terug naar de standaard.
  return gekozen.length ? gekozen : [...leden];
}

/** Iemand erbij of eraf; nooit niemand (dan blijft de laatste staan). */
export function wisselEter(huidig: readonly string[], id: string): string[] {
  if (!huidig.includes(id)) return [...huidig, id];
  const zonder = huidig.filter((x) => x !== id);
  return zonder.length ? zonder : [...huidig];
}

/** Iedereen behalve dit lid (voor "Gust eet niet mee"). */
export function zonderEter(huidig: readonly string[], id: string): string[] {
  return wisselEter(huidig.includes(id) ? huidig : [...huidig, id], id);
}

// ---------- Terugval op het toestel ----------

const MAX_TOESTEL = 200;

function sleutel(userId: string) {
  return `foodlo:maaltijd-eters:${userId}`;
}

export function leesToestelEters(userId: string | null | undefined): Record<string, string[]> {
  if (!userId) return {};
  try {
    const ruw = JSON.parse(window.localStorage.getItem(sleutel(userId)) ?? "{}") as unknown;
    if (!ruw || typeof ruw !== "object" || Array.isArray(ruw)) return {};
    const uit: Record<string, string[]> = {};
    for (const [plan, ids] of Object.entries(ruw as Record<string, unknown>)) {
      if (Array.isArray(ids)) uit[plan] = ids.filter((x): x is string => typeof x === "string");
    }
    return uit;
  } catch {
    return {};
  }
}

/** `ids` null of leeg = terug naar de standaard (iedereen). */
export function bewaarToestelEters(
  userId: string | null | undefined,
  planId: string,
  ids: readonly string[] | null,
) {
  if (!userId) return;
  const alles = leesToestelEters(userId);
  delete alles[planId];
  if (ids?.length) alles[planId] = [...ids];
  const sleutels = Object.keys(alles);
  for (const oud of sleutels.slice(0, Math.max(0, sleutels.length - MAX_TOESTEL)))
    delete alles[oud];
  try {
    window.localStorage.setItem(sleutel(userId), JSON.stringify(alles));
  } catch {
    /* privévenster: dan alleen voor nu */
  }
}

/**
 * Boodschappenlijst: voor welke geplande maaltijden is dit product? Hoort het bij een recept
 * (`recipe_id`), dan de maaltijden met dat recept; anders elke maaltijd waarvan een ingrediënt
 * hetzelfde product is.
 */
export function plannenVoorProduct(
  product: string,
  recipeId: string | null | undefined,
  plannen: readonly { id: string; recipe_id: string | null; ingredienten: readonly string[] }[],
): string[] {
  if (recipeId) {
    const eigen = plannen.filter((p) => p.recipe_id === recipeId).map((p) => p.id);
    if (eigen.length) return eigen;
  }
  return plannen
    .filter((p) => p.ingredienten.some((i) => zelfdeProduct(i, product)))
    .map((p) => p.id);
}

/**
 * Jouw eigen regels (kennismaking + account) gelden voor jouw lid in het huishouden, als er voor
 * dat lid geen aparte lid-voeding is. Jij mag je eigen reden altijd zien.
 */
export function metEigenRegels(
  voeding: ReadonlyMap<string, LidVoeding>,
  ik: Pick<HuishoudenLid, "id"> | null | undefined,
  kijkerId: string | null | undefined,
  eigen: { allergieen: readonly string[]; dieet?: Dieet | null | undefined } | null,
): ReadonlyMap<string, LidVoeding> {
  if (!ik || !kijkerId || !eigen || voeding.get(ik.id)) return voeding;
  if (!eigen.allergieen.length && !eigen.dieet) return voeding;
  const m = new Map(voeding);
  m.set(ik.id, {
    ...LEGE_VOEDING,
    allergieen: [...eigen.allergieen],
    dieet: eigen.dieet ?? null,
    lid_id: ik.id,
    delen_met_gezin: false,
    toestemming_door: kijkerId,
    toestemming_soort: "zelf",
    toestemming_op: "",
  });
  return m;
}
