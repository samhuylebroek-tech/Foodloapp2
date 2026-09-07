export type Recipe = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string | null;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  difficulty: string;
  category: string;
  tags: string[];
  instructions: string[];
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Ingredient = {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string;
  position: number;
};

export const CATEGORIES = [
  "voorgerecht",
  "hoofdgerecht",
  "nagerecht",
  "soep",
  "salade",
  "ontbijt",
  "bijgerecht",
  "drank",
  "snack",
] as const;

export const DIFFICULTIES = ["makkelijk", "gemiddeld", "moeilijk"] as const;

export const MEAL_TYPES = ["ontbijt", "middageten", "avondeten"] as const;

export const UNITS = ["", "g", "kg", "ml", "l", "el", "tl", "stuk(s)", "teen(tjes)", "snuf"];
