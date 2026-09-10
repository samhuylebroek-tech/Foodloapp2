import { supabase } from "@/integrations/supabase/client";

export type ShoppingList = { id: string; name: string; created_at: string };

export type NieuwItem = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  recipe_id?: string | null;
};

/** Geeft het eerste lijstje van de gebruiker terug, of maakt er één aan. */
export async function zorgVoorLijst(userId: string): Promise<string> {
  const { data } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id;

  const { data: nieuw, error } = await supabase
    .from("shopping_lists")
    .insert({ user_id: userId, name: "Boodschappen" })
    .select("id")
    .single();
  if (error) throw error;
  return nieuw.id;
}

export async function maakLijst(userId: string, naam: string): Promise<string> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ user_id: userId, name: naam })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function sleutel(name: string, unit: string | null | undefined) {
  return `${name.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;
}

function telOp(a: number | null, b: number | null | undefined): number | null {
  if (a === null && (b === null || b === undefined)) return null;
  return (a ?? 0) + (b ?? 0);
}

/**
 * Zet items op een lijstje en telt dezelfde ingrediënten bij elkaar op,
 * zodat elk product maar één keer op de lijst staat.
 */
export async function voegToeAanLijst(
  userId: string,
  listId: string,
  items: NieuwItem[],
): Promise<void> {
  if (!items.length) return;

  const { data: bestaand } = await supabase
    .from("shopping_items")
    .select("id, name, quantity, unit")
    .eq("list_id", listId);

  const bestaande = new Map<string, { id: string; quantity: number | null }>();
  for (const rij of bestaand ?? []) {
    bestaande.set(sleutel(rij.name as string, rij.unit as string), {
      id: rij.id as string,
      quantity: rij.quantity as number | null,
    });
  }

  const nieuwe = new Map<string, { name: string; quantity: number | null; unit: string; recipe_id: string | null }>();

  for (const item of items) {
    const naam = item.name.trim();
    if (!naam) continue;
    const unit = (item.unit ?? "").trim();
    const k = sleutel(naam, unit);

    const raak = bestaande.get(k);
    if (raak) {
      raak.quantity = telOp(raak.quantity, item.quantity ?? null);
      continue;
    }
    const alGepland = nieuwe.get(k);
    if (alGepland) {
      alGepland.quantity = telOp(alGepland.quantity, item.quantity ?? null);
      continue;
    }
    nieuwe.set(k, {
      name: naam,
      quantity: item.quantity ?? null,
      unit,
      recipe_id: item.recipe_id ?? null,
    });
  }

  const teInvoegen = [...nieuwe.values()].map((r) => ({
    user_id: userId,
    list_id: listId,
    name: r.name,
    quantity: r.quantity,
    unit: r.unit,
    recipe_id: r.recipe_id,
  }));
  if (teInvoegen.length) {
    const { error } = await supabase.from("shopping_items").insert(teInvoegen);
    if (error) throw error;
  }

  const updates = [...bestaande.entries()]
    .filter(([k]) => items.some((i) => sleutel(i.name, i.unit ?? "") === k))
    .map(([, rij]) =>
      supabase
        .from("shopping_items")
        .update({ quantity: rij.quantity, checked: false })
        .eq("id", rij.id),
    );
  await Promise.all(updates);
}
