import { toast } from "sonner";
import type { Ingredient, Recipe } from "@/lib/types";

const DEMO_KEY = "foodlo-demo";

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export function startDemo() {
  try {
    window.localStorage.setItem(DEMO_KEY, "1");
  } catch {
    /* negeren */
  }
}

export function stopDemo() {
  try {
    window.localStorage.removeItem(DEMO_KEY);
  } catch {
    /* negeren */
  }
}

/** Vriendelijke melding bij acties die in de demo niet bewaard worden. */
export function demoBericht() {
  toast.info("Maak een gratis account om dit te bewaren.", {
    description: "In het voorbeeld wordt niets opgeslagen.",
  });
}

const nu = new Date().toISOString();

function recept(deel: Partial<Recipe> & Pick<Recipe, "id" | "title" | "category">): Recipe {
  return {
    user_id: "demo",
    description: "",
    image_url: null,
    servings: 4,
    prep_minutes: 15,
    cook_minutes: 30,
    difficulty: "makkelijk",
    tags: [],
    instructions: [],
    source_url: null,
    is_concept: false,
    created_at: nu,
    updated_at: nu,
    ...deel,
  };
}

export const DEMO_RECEPTEN: Recipe[] = [
  recept({
    id: "demo-1",
    title: "Spaghetti bolognaise",
    category: "hoofdgerecht",
    description: "Een klassieker die altijd werkt, met rijke tomatensaus.",
    prep_minutes: 15,
    cook_minutes: 45,
    tags: ["pasta", "gezinsvriendelijk"],
    instructions: [
      "Snipper de ui en het bosje selder, rasp de wortel.",
      "Bak het gehakt rul in olijfolie en voeg de groenten toe.",
      "Voeg de tomatenblokjes en tomatenpuree toe en laat 30 minuten sudderen.",
      "Kook de spaghetti volgens de verpakking en serveer met de saus.",
    ],
  }),
  recept({
    id: "demo-2",
    title: "Tomatensoep met balletjes",
    category: "soep",
    description: "Zelfgemaakte soep zoals bij oma.",
    prep_minutes: 20,
    cook_minutes: 35,
    difficulty: "gemiddeld",
    instructions: [
      "Bak de gehaktballetjes goudbruin.",
      "Stoof de ui aan en voeg de tomaten en het water toe.",
      "Laat 25 minuten koken, mix glad en voeg de balletjes terug toe.",
    ],
  }),
  recept({
    id: "demo-3",
    title: "Lasagne",
    category: "hoofdgerecht",
    description: "Laagjes pasta, gehaktsaus en bechamel uit de oven.",
    prep_minutes: 30,
    cook_minutes: 40,
    difficulty: "gemiddeld",
    servings: 6,
    instructions: [
      "Maak een gehaktsaus met ui, wortel en tomaten.",
      "Maak een bechamelsaus met boter, bloem en melk.",
      "Bouw de lasagne op in laagjes en werk af met kaas.",
      "Bak 40 minuten op 180 graden.",
    ],
  }),
  recept({
    id: "demo-4",
    title: "Stamppot met worst",
    category: "hoofdgerecht",
    description: "Boerenkoolstamppot, lekker bij koud weer.",
    prep_minutes: 15,
    cook_minutes: 25,
    instructions: [
      "Kook de aardappelen gaar.",
      "Voeg de boerenkool toe en stamp fijn met een schep melk.",
      "Verwarm de worst en serveer erbij.",
    ],
  }),
  recept({
    id: "demo-5",
    title: "Ovenpannenkoek met appel",
    category: "ontbijt",
    description: "Een luchtige pannenkoek uit de oven.",
    prep_minutes: 10,
    cook_minutes: 25,
    servings: 2,
    instructions: [
      "Meng bloem, melk en eieren tot een glad beslag.",
      "Schik appelschijfjes in een ovenschaal en giet het beslag erover.",
      "Bak 25 minuten op 200 graden.",
    ],
  }),
  recept({
    id: "demo-6",
    title: "Tiramisu",
    category: "nagerecht",
    description: "Italiaans dessert met koffie en mascarpone.",
    prep_minutes: 25,
    cook_minutes: 0,
    difficulty: "gemiddeld",
    instructions: [
      "Klop de eidooiers met suiker luchtig en meng de mascarpone erdoor.",
      "Doop de lange vingers kort in de koffie.",
      "Bouw laagjes op en bestrooi met cacao.",
      "Laat minstens 4 uur opstijven in de koelkast.",
    ],
  }),
];

function ing(recipeId: string, naam: string, hoeveelheid: number | null, eenheid: string, positie: number): Ingredient {
  return { id: `${recipeId}-i${positie}`, recipe_id: recipeId, name: naam, quantity: hoeveelheid, unit: eenheid, position: positie };
}

export const DEMO_INGREDIENTEN: Record<string, Ingredient[]> = {
  "demo-1": [
    ing("demo-1", "spaghetti", 500, "g", 0),
    ing("demo-1", "gehakt (half om half)", 500, "g", 1),
    ing("demo-1", "ui", 1, "stuk(s)", 2),
    ing("demo-1", "wortel", 1, "stuk(s)", 3),
    ing("demo-1", "selder", 1, "bos", 4),
    ing("demo-1", "tomatenblokjes", 1, "blik", 5),
    ing("demo-1", "tomatenpuree", 2, "el", 6),
    ing("demo-1", "olijfolie", 2, "el", 7),
  ],
  "demo-2": [
    ing("demo-2", "gehakt", 300, "g", 0),
    ing("demo-2", "ui", 1, "stuk(s)", 1),
    ing("demo-2", "tomaten", 6, "stuk(s)", 2),
    ing("demo-2", "water", 1, "l", 3),
  ],
  "demo-3": [
    ing("demo-3", "lasagnebladen", 12, "stuk(s)", 0),
    ing("demo-3", "gehakt", 500, "g", 1),
    ing("demo-3", "melk", 75, "cl", 2),
    ing("demo-3", "boter", 50, "g", 3),
    ing("demo-3", "bloem", 50, "g", 4),
    ing("demo-3", "geraspte kaas", 150, "g", 5),
  ],
  "demo-4": [
    ing("demo-4", "aardappelen", 1, "kg", 0),
    ing("demo-4", "boerenkool", 500, "g", 1),
    ing("demo-4", "rookworst", 1, "stuk(s)", 2),
    ing("demo-4", "melk", 10, "cl", 3),
  ],
  "demo-5": [
    ing("demo-5", "bloem", 125, "g", 0),
    ing("demo-5", "melk", 25, "cl", 1),
    ing("demo-5", "eieren", 2, "stuk(s)", 2),
    ing("demo-5", "appel", 2, "stuk(s)", 3),
  ],
  "demo-6": [
    ing("demo-6", "mascarpone", 500, "g", 0),
    ing("demo-6", "eieren", 4, "stuk(s)", 1),
    ing("demo-6", "suiker", 100, "g", 2),
    ing("demo-6", "lange vingers", 1, "pak", 3),
    ing("demo-6", "sterke koffie", 20, "cl", 4),
    ing("demo-6", "cacaopoeder", 2, "el", 5),
  ],
};

export const DEMO_FAVORIETEN = ["demo-1", "demo-6"];

export type DemoPlanItem = {
  id: string;
  custom_title: string | null;
  meal_type: string;
  recipe_id: string | null;
  group_id: string | null;
  recipes: Recipe | null;
};

function dagVanDezeWeek(offset: number): string {
  const vandaag = new Date();
  const maandag = new Date(vandaag);
  maandag.setDate(vandaag.getDate() - ((vandaag.getDay() + 6) % 7) + offset);
  return `${maandag.getFullYear()}-${String(maandag.getMonth() + 1).padStart(2, "0")}-${String(maandag.getDate()).padStart(2, "0")}`;
}

export function demoPlan(): (DemoPlanItem & { plan_date: string })[] {
  const r = (id: string) => DEMO_RECEPTEN.find((x) => x.id === id) ?? null;
  return [
    { id: "demo-p1", plan_date: dagVanDezeWeek(0), meal_type: "avondeten", recipe_id: "demo-1", custom_title: null, group_id: null, recipes: r("demo-1") },
    { id: "demo-p2", plan_date: dagVanDezeWeek(1), meal_type: "avondeten", recipe_id: "demo-2", custom_title: null, group_id: null, recipes: r("demo-2") },
    { id: "demo-p3", plan_date: dagVanDezeWeek(2), meal_type: "avondeten", recipe_id: null, custom_title: "Restjes", group_id: null, recipes: null },
    { id: "demo-p4", plan_date: dagVanDezeWeek(3), meal_type: "avondeten", recipe_id: "demo-4", custom_title: null, group_id: null, recipes: r("demo-4") },
  ];
}

export const DEMO_LIJST = { id: "demo-lijst", name: "Mijn boodschappen", created_at: nu, group_id: null };

export type DemoItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  checked: boolean;
  recipe_id: string | null;
  list_id: string;
  created_at: string;
};

export const DEMO_ITEMS: DemoItem[] = [
  { id: "demo-b1", name: "spaghetti", quantity: 500, unit: "g", checked: false, recipe_id: "demo-1", list_id: "demo-lijst", created_at: nu },
  { id: "demo-b2", name: "gehakt (half om half)", quantity: 500, unit: "g", checked: false, recipe_id: "demo-1", list_id: "demo-lijst", created_at: nu },
  { id: "demo-b3", name: "tomatenblokjes", quantity: 1, unit: "blik", checked: false, recipe_id: "demo-1", list_id: "demo-lijst", created_at: nu },
  { id: "demo-b4", name: "melk", quantity: 1, unit: "l", checked: false, recipe_id: null, list_id: "demo-lijst", created_at: nu },
  { id: "demo-b5", name: "eieren", quantity: 6, unit: "stuk(s)", checked: false, recipe_id: null, list_id: "demo-lijst", created_at: nu },
  { id: "demo-b6", name: "appels", quantity: 4, unit: "stuk(s)", checked: false, recipe_id: null, list_id: "demo-lijst", created_at: nu },
  { id: "demo-b7", name: "wasmiddel", quantity: 1, unit: "fles", checked: false, recipe_id: null, list_id: "demo-lijst", created_at: nu },
  { id: "demo-b8", name: "brood", quantity: 1, unit: "stuk(s)", checked: true, recipe_id: null, list_id: "demo-lijst", created_at: nu },
];
