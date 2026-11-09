/** WP6 — gedeelde helpers en types van het weekmenu (uit routes/planner.tsx). */
import { type Recipe } from "@/lib/types";

export type PlanRow = {
  id: string;
  plan_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_title: string | null;
  soort?: string | null;
  personen?: number | null;
  user_id: string;
  group_id: string | null;
  recipes: Recipe | null;
};

/** Hoeveel x het originele recept elk gepland gerecht moet geschaald worden (personen ÷ basisporties). */
export function schaalPerRecept(
  plan: {
    recipe_id: string | null;
    personen?: number | null;
    recipes: { servings?: number } | null;
  }[],
) {
  const factoren = new Map<string, number>();
  for (const rij of plan) {
    if (!rij.recipe_id) continue;
    const basis = rij.recipes?.servings ?? 0;
    const gewenst = rij.personen ?? basis;
    factoren.set(rij.recipe_id, basis > 0 && gewenst > 0 ? gewenst / basis : 1);
  }
  return factoren;
}

/** Hoeveelheid afronden op 2 decimalen; null blijft null. */
export function schaalHoeveelheid(hoeveelheid: number | null, factor: number) {
  if (hoeveelheid === null || hoeveelheid === undefined) return null;
  return Math.round(hoeveelheid * factor * 100) / 100;
}

export function maandagVan(d: Date) {
  const kopie = new Date(d);
  const dag = (kopie.getDay() + 6) % 7;
  kopie.setDate(kopie.getDate() - dag);
  kopie.setHours(12, 0, 0, 0);
  return kopie;
}

export function datumTekst(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function labelVoor(datum: string) {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
}

export function kortLabel(datum: string) {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-BE", { weekday: "short", day: "numeric" });
}

export type NieuwExtra = { soort?: string; maakRecept?: boolean };

export type Basis = {
  title: string;
  description: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  category: string;
  difficulty: string;
  tags: string[];
  instructions: string[];
  ingredienten: { name: string; quantity: number | null; unit: string }[];
  image_url?: string | null;
  source_url?: string | null;
};

export const DAG_NAMEN = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];
