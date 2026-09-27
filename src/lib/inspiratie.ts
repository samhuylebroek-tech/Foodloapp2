import { supabase } from "@/integrations/supabase/client";
import { normaliseerTekst, zoekScore } from "@/lib/zoeken";
import { zorgVoorReceptFoto } from "@/lib/photos";
import { bepaalDieet } from "@/lib/dieet";

/**
 * Inspiratiebibliotheek: de centrale recepten die Foodlo al kent.
 * Alles werkt op bestaande gestructureerde data — geen AI-calls, geen credits.
 */

export type InspiratieRecept = {
  id: string;
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
};

export type InspiratieIngredient = {
  name: string;
  quantity: number | null;
  unit: string;
  position: number;
};

export type InspiratieFilters = {
  zoek: string;
  categorie: string; // "" = alles
  maxTijd: number | null; // minuten, null = alles
  eetstijl: Eetstijl | "";
};

export type Eetstijl = "vlees" | "vis" | "vegetarisch" | "vegan" | "licht" | "comfort";
export const EETSTIJLEN: { waarde: Eetstijl; label: string }[] = [
  { waarde: "vlees", label: "Met vlees" },
  { waarde: "vis", label: "Met vis" },
  { waarde: "vegetarisch", label: "Vegetarisch" },
  { waarde: "vegan", label: "Vegan" },
  { waarde: "licht", label: "Licht & fris" },
  { waarde: "comfort", label: "Stevige kost" },
];
const LICHT_WOORDEN = ["salade", "sla", "bowl", "wrap", "soep", "gezond", "licht", "fris", "groenten", "kwark", "fruit", "poke"];
const COMFORT_WOORDEN = ["stoof", "stoofvlees", "gratin", "ovenschotel", "lasagne", "puree", "stamppot", "vol-au-vent", "moussaka", "chili", "frieten", "balletjes", "curry", "hachee", "comfort"];

export const LEGE_FILTERS: InspiratieFilters = {
  zoek: "",
  categorie: "",
  maxTijd: null,
  eetstijl: "",
};

const VEGA_WOORDEN = ["vlees", "kip", "vis", "gehakt", "rund", "varken", "zalm", "tonijn", "garnaal", "bacon", "spek", "worst", "ham", "kalkoen", "lam", "scampi"];
const VEGAN_WOORDEN = [...VEGA_WOORDEN, "kaas", "melk", "ei", "eieren", "boter", "room", "yoghurt", "honing", "mozzarella", "parmezaan", "feta"];

/** Compacte kaartdata voor de lijst (snel, ook bij veel recepten). */
export async function haalInspiratieLijst(): Promise<InspiratieRecept[]> {
  const { data, error } = await supabase
    .from("inspiration_recipes")
    .select("id, title, description, image_url, servings, prep_minutes, cook_minutes, difficulty, category, tags, instructions")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as InspiratieRecept[];
}

export async function haalInspiratieRecept(id: string): Promise<InspiratieRecept | null> {
  const { data, error } = await supabase
    .from("inspiration_recipes")
    .select("id, title, description, image_url, servings, prep_minutes, cook_minutes, difficulty, category, tags, instructions")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as InspiratieRecept) ?? null;
}

export async function haalInspiratieIngredienten(id: string): Promise<InspiratieIngredient[]> {
  const { data, error } = await supabase
    .from("inspiration_ingredients")
    .select("name, quantity, unit, position")
    .eq("inspiration_id", id)
    .order("position");
  if (error) throw error;
  return (data ?? []) as unknown as InspiratieIngredient[];
}

/** Filtert en zoekt lokaal over de compacte lijst — geen server-, laat staan AI-kosten. */
export function filterInspiratie(recepten: InspiratieRecept[], filters: InspiratieFilters): InspiratieRecept[] {
  const woorden = normaliseerTekst(filters.zoek).split(" ").filter(Boolean);
  return recepten.filter((r) => {
    if (filters.categorie && normaliseerTekst(r.category) !== normaliseerTekst(filters.categorie)) return false;
    if (filters.maxTijd !== null && r.prep_minutes + r.cook_minutes > filters.maxTijd) return false;
    if (filters.eetstijl) {
      const tekst = normaliseerTekst(`${r.title} ${r.description} ${r.tags.join(" ")} ${r.category}`);
      const dieet = bepaalDieet(r.title, r.tags);
      const e = filters.eetstijl;
      if (e === "vlees" && dieet !== "vlees") return false;
      if (e === "vis" && dieet !== "vis") return false;
      if (e === "vegetarisch" && (dieet !== "vegetarisch" || VEGA_WOORDEN.some((w) => tekst.includes(w)))) return false;
      if (e === "vegan" && (dieet !== "vegetarisch" || VEGAN_WOORDEN.some((w) => new RegExp(`\\b${w}\\b`).test(tekst)))) return false;
      if (e === "licht" && !LICHT_WOORDEN.some((w) => tekst.includes(w))) return false;
      if (e === "comfort" && !COMFORT_WOORDEN.some((w) => tekst.includes(w))) return false;
    }
    if (woorden.length) {
      const score = zoekScore(
        { titel: r.title, beschrijving: r.description, labels: r.tags, soort: r.category },
        woorden,
      );
      if (score === 0) return false;
    }
    return true;
  });
}

/** Beschikbare categorieën uit echte data (voor de filterchips). */
export function inspiratieCategorieen(recepten: InspiratieRecept[]): string[] {
  const set = new Map<string, string>();
  for (const r of recepten) {
    const c = r.category.trim();
    if (c) set.set(normaliseerTekst(c), c);
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b, "nl"));
}

/** Deterministische "Verras mij": elke dag een andere, binnen de actieve filters. */
export function verrasMij(recepten: InspiratieRecept[]): InspiratieRecept | null {
  if (!recepten.length) return null;
  const dagNummer = Math.floor(Date.now() / 86400000);
  return recepten[dagNummer % recepten.length] ?? null;
}

export type ToevoegResultaat =
  | { soort: "toegevoegd"; recipeId: string }
  | { soort: "bestaatAl"; recipeId: string };

export type GecontroleerdInspiratieRecept = {
  title: string;
  category: string;
  difficulty: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: InspiratieIngredient[];
  instructions: string[];
};

/**
 * Zet een inspiratie-recept in de eigen recepten van de gebruiker.
 * Kopieert de bestaande gestructureerde data — geen heranalyse, geen AI.
 * Staat het recept er al (zelfde titel), dan wordt niets gedupliceerd.
 */
export async function voegToeAanMijnRecepten(
  userId: string,
  inspiratieId: string,
  aangepast?: GecontroleerdInspiratieRecept,
): Promise<ToevoegResultaat> {
  const recept = await haalInspiratieRecept(inspiratieId);
  if (!recept) throw new Error("Recept niet gevonden");

  // Dubbeldetectie: zelfde (genormaliseerde) titel bij deze gebruiker?
  const { data: eigen } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("user_id", userId)
    .is("deleted_at", null);
  const titel = aangepast?.title.trim() || recept.title;
  const gezocht = normaliseerTekst(titel);
  const bestaand = (eigen ?? []).find((r) => normaliseerTekst(r.title as string) === gezocht);
  if (bestaand) return { soort: "bestaatAl", recipeId: bestaand.id as string };

  const { data: nieuw, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      inspiration_id: inspiratieId,
      title: titel,
      description: recept.description,
      image_url: recept.image_url,
      servings: aangepast?.servings ?? recept.servings,
      prep_minutes: aangepast?.prep_minutes ?? recept.prep_minutes,
      cook_minutes: aangepast?.cook_minutes ?? recept.cook_minutes,
      difficulty: aangepast?.difficulty ?? recept.difficulty,
      category: aangepast?.category ?? recept.category,
      tags: recept.tags,
      instructions: aangepast?.instructions ?? recept.instructions,
    })
    .select("id")
    .single();
  if (error) throw error;

  const ingredienten = aangepast?.ingredients ?? await haalInspiratieIngredienten(inspiratieId);
  if (ingredienten.length) {
    await supabase.from("recipe_ingredients").insert(
      ingredienten.map((i) => ({
        recipe_id: nieuw.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        position: i.position,
      })),
    );
  }
  if (!recept.image_url) {
    await zorgVoorReceptFoto(nieuw.id, titel, userId).catch(() => null);
  }
  return { soort: "toegevoegd", recipeId: nieuw.id as string };
}
