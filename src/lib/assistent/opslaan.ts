/**
 * Kookassistent — een aangepast voorstel bewaren. Nooit stil: dit gebeurt alleen na een tik op
 * "Bewaar als kopie" of "Pas dit recept aan", en beide kunnen ongedaan gemaakt worden.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Ingredient, Recipe } from "@/lib/types";
import { rijWijzigingen, type AanpasVoorstel } from "./aanpassen";

/** Nieuw recept met het voorstel; het origineel blijft ongewijzigd. Geeft het nieuwe id. */
export async function bewaarAlsKopie(
  userId: string,
  recept: Recipe,
  voorstel: AanpasVoorstel,
): Promise<string> {
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      title: voorstel.titelKopie,
      description: recept.description,
      image_url: recept.image_url,
      servings: voorstel.personen,
      prep_minutes: recept.prep_minutes,
      cook_minutes: recept.cook_minutes,
      difficulty: recept.difficulty,
      category: recept.category,
      tags: voorstel.tags,
      instructions: recept.instructions,
      source_url: recept.source_url,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Kopie niet gemaakt");
  if (voorstel.ingredienten.length) {
    const { error: fout } = await supabase.from("recipe_ingredients").insert(
      voorstel.ingredienten.map((i, position) => ({
        recipe_id: data.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        position,
      })),
    );
    if (fout) throw fout;
  }
  return data.id as string;
}

export type Herstelpunt = {
  receptId: string;
  servings: number;
  tags: string[];
  rijen: Ingredient[];
};

/**
 * Past het eigen recept aan. Rijen worden op hun id bijgewerkt of verwijderd (de koppeling met de
 * stappen blijft zo bewaard). Geeft een herstelpunt voor "Ongedaan maken".
 */
export async function pasOrigineelAan(
  recept: Recipe,
  rijen: readonly Ingredient[],
  voorstel: AanpasVoorstel,
): Promise<Herstelpunt> {
  const herstel: Herstelpunt = {
    receptId: recept.id,
    servings: recept.servings,
    tags: [...recept.tags],
    rijen: rijen.map((r) => ({ ...r })),
  };
  const { bijwerken, verwijderen } = rijWijzigingen(rijen, voorstel);
  for (const r of bijwerken) {
    const { error } = await supabase
      .from("recipe_ingredients")
      .update({ name: r.name, quantity: r.quantity, unit: r.unit })
      .eq("id", r.id);
    if (error) throw error;
  }
  if (verwijderen.length) {
    const { error } = await supabase.from("recipe_ingredients").delete().in("id", verwijderen);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("recipes")
    .update({ servings: voorstel.personen, tags: voorstel.tags })
    .eq("id", recept.id);
  if (error) throw error;
  return herstel;
}

/** Zet alles terug zoals het was (ook verwijderde rijen, met hun oude id). */
export async function herstel(h: Herstelpunt): Promise<void> {
  const { data: nu } = await supabase
    .from("recipe_ingredients")
    .select("id")
    .eq("recipe_id", h.receptId);
  const bestaand = new Set((nu ?? []).map((r) => r.id as string));
  for (const r of h.rijen) {
    if (bestaand.has(r.id)) {
      const { error } = await supabase
        .from("recipe_ingredients")
        .update({ name: r.name, quantity: r.quantity, unit: r.unit, position: r.position })
        .eq("id", r.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("recipe_ingredients").insert({
        id: r.id,
        recipe_id: h.receptId,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        position: r.position,
      });
      if (error) throw error;
    }
  }
  const { error } = await supabase
    .from("recipes")
    .update({ servings: h.servings, tags: h.tags })
    .eq("id", h.receptId);
  if (error) throw error;
}
