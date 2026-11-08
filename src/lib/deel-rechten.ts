/** Wat een gedeelde persoon mag zien of aanpassen (tabel `shares`). */
export type Rechten = {
  recipes_view: boolean;
  recipes_edit: boolean;
  planner_view: boolean;
  planner_edit: boolean;
  shopping_view: boolean;
  shopping_edit: boolean;
};

export const GEEN_RECHTEN: Rechten = {
  recipes_view: false,
  recipes_edit: false,
  planner_view: false,
  planner_edit: false,
  shopping_view: false,
  shopping_edit: false,
};

/**
 * Herleidt willekeurige invoer tot geldige rechten.
 * Alleen een echte `true` geeft een recht (BUG-015: `Boolean("false")` was `true`).
 * Onbekende sleutels worden genegeerd; bewerken impliceert bekijken.
 */
export function schoonRechten(input: unknown): Rechten {
  const bron = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const uit = { ...GEEN_RECHTEN };
  for (const sleutel of Object.keys(GEEN_RECHTEN) as (keyof Rechten)[]) {
    uit[sleutel] = bron[sleutel] === true;
  }
  if (uit.recipes_edit) uit.recipes_view = true;
  if (uit.planner_edit) uit.planner_view = true;
  if (uit.shopping_edit) uit.shopping_view = true;
  return uit;
}
