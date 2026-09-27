import { supabase } from "@/integrations/supabase/client";
import { canoniekeNaam, canoniekeTitel } from "@/lib/product-herkenning";

export type ShoppingList = { id: string; name: string; created_at: string; group_id?: string | null };

export type NieuwItem = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  recipe_id?: string | null;
  note?: string | null;
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

/**
 * Enkelvoud/meervoud, schrijfvarianten én synoniemen samenbrengen via de
 * centrale productherkenning: "Uien" = "ui" = "ajuin", "look" = "knoflook".
 * Varianten met betekenis ("rode ui", "amandelmelk") blijven apart.
 */
function naamSleutel(name: string): string {
  return canoniekeNaam(name);
}

/** g/kg en ml/l naar één basiseenheid, zodat hoeveelheden optelbaar zijn. */
function basisEenheid(unit: string | null | undefined): string {
  const u = (unit ?? "").trim().toLowerCase();
  if (u === "kg") return "g";
  if (u === "l") return "ml";
  return u;
}

function naarBasis(quantity: number | null | undefined, unit: string | null | undefined): number | null {
  if (quantity === null || quantity === undefined) return null;
  const u = (unit ?? "").trim().toLowerCase();
  if (u === "kg" || u === "l") return quantity * 1000;
  return quantity;
}

function sleutel(name: string, unit: string | null | undefined) {
  return `${naamSleutel(name)}|${basisEenheid(unit)}`;
}

function telOp(a: number | null, b: number | null | undefined): number | null {
  if (a === null && (b === null || b === undefined)) return null;
  return (a ?? 0) + (b ?? 0);
}

export type Dubbel = { index: number; name: string; bestaand: string };

/**
 * Welke van deze nieuwe items staan al (nog te kopen) op de lijst?
 * Vergelijkt op productniveau (ongeacht eenheid): "1 bussel look" herkent
 * "2 teentjes look" als hetzelfde product. Geeft per nieuw item de bestaande
 * lijstregel terug, zodat de gebruiker zelf kiest: nog eens toevoegen of niet.
 */
export async function vindDubbels(listId: string, items: NieuwItem[]): Promise<Dubbel[]> {
  const { data: bestaand } = await supabase
    .from("shopping_items")
    .select("name, quantity, unit")
    .eq("list_id", listId)
    .eq("checked", false);
  const perProduct = new Map<string, string>();
  for (const rij of bestaand ?? []) {
    const product = naamSleutel(rij.name as string);
    if (!product) continue;
    const q = rij.quantity as number | null;
    const label = `${rij.name}${q !== null ? ` (${q} ${(rij.unit as string) ?? ""})` : ""}`;
    const al = perProduct.get(product);
    perProduct.set(product, al ? `${al}, ${label}` : label);
  }
  const dubbels: Dubbel[] = [];
  items.forEach((item, index) => {
    const hit = perProduct.get(naamSleutel(item.name.trim()));
    if (hit) dubbels.push({ index, name: item.name.trim(), bestaand: hit });
  });
  return dubbels;
}

export type ReviewVerdeling = {
  /** Items die al (als zelfde product) op de lijst staan. */
  alOpLijst: { item: NieuwItem; bestaand: string }[];
  /** Items die nog niet op de lijst staan. */
  nieuw: NieuwItem[];
};

/**
 * Verdeelt nieuwe items in "al op je lijst" en "nieuw", zodat de review-sheet
 * in één rustig overzicht kan tonen wat er gaat gebeuren.
 */
export async function verdeelVoorReview(listId: string, items: NieuwItem[]): Promise<ReviewVerdeling> {
  const dubbels = await vindDubbels(listId, items);
  const dubbelIndex = new Map(dubbels.map((d) => [d.index, d.bestaand]));
  const alOpLijst: ReviewVerdeling["alOpLijst"] = [];
  const nieuw: NieuwItem[] = [];
  items.forEach((item, index) => {
    const bestaand = dubbelIndex.get(index);
    if (bestaand) alOpLijst.push({ item, bestaand });
    else nieuw.push(item);
  });
  return { alOpLijst, nieuw };
}

/**
 * Zet items op een lijstje als nieuwe regels, zonder stil samen te voegen
 * met wat er al staat. Dubbels binnen dezelfde toevoeging worden wel
 * samengeteld.
 */
export async function voegToeAlsNieuw(
  userId: string,
  listId: string,
  items: NieuwItem[],
): Promise<void> {
  if (!items.length) return;
  const nieuwe = new Map<string, { name: string; quantity: number | null; unit: string; recipe_id: string | null; note: string | null }>();
  for (const item of items) {
    const naam = item.name.trim();
    if (!naam) continue;
    const k = sleutel(naam, item.unit ?? "");
    const al = nieuwe.get(k);
    if (al) {
      al.quantity = telOp(al.quantity, naarBasis(item.quantity ?? null, item.unit));
      continue;
    }
    nieuwe.set(k, {
      name: naam,
      quantity: naarBasis(item.quantity ?? null, item.unit),
      unit: basisEenheid(item.unit),
      recipe_id: item.recipe_id ?? null,
      note: item.note?.trim() ? item.note.trim().slice(0, 100) : null,
    });
  }
  const { error } = await supabase.from("shopping_items").insert(
    [...nieuwe.values()].map((r) => ({
      user_id: userId,
      list_id: listId,
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      recipe_id: r.recipe_id,
      note: r.note,
    })),
  );
  if (error) throw error;
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

  const bestaande = new Map<string, { id: string; quantity: number | null; unit: string }>();
  for (const rij of bestaand ?? []) {
    bestaande.set(sleutel(rij.name as string, rij.unit as string), {
      id: rij.id as string,
      quantity: naarBasis(rij.quantity as number | null, rij.unit as string),
      unit: basisEenheid(rij.unit as string),
    });
  }

  const nieuwe = new Map<string, { name: string; quantity: number | null; unit: string; recipe_id: string | null; note: string | null }>();
  const aangeraakt = new Set<string>();

  for (const item of items) {
    const naam = item.name.trim();
    if (!naam) continue;
    const unit = basisEenheid(item.unit);
    const aantal = naarBasis(item.quantity ?? null, item.unit);
    const k = sleutel(naam, item.unit ?? "");
    aangeraakt.add(k);

    const raak = bestaande.get(k);
    if (raak) {
      raak.quantity = telOp(raak.quantity, aantal);
      continue;
    }
    const alGepland = nieuwe.get(k);
    if (alGepland) {
      alGepland.quantity = telOp(alGepland.quantity, aantal);
      continue;
    }
    nieuwe.set(k, {
      name: naam,
      quantity: aantal,
      unit,
      recipe_id: item.recipe_id ?? null,
      note: item.note?.trim() ? item.note.trim().slice(0, 100) : null,
    });
  }

  const teInvoegen = [...nieuwe.values()].map((r) => ({
    user_id: userId,
    list_id: listId,
    name: r.name,
    quantity: r.quantity,
    unit: r.unit,
    recipe_id: r.recipe_id,
    note: r.note,
  }));
  if (teInvoegen.length) {
    const { error } = await supabase.from("shopping_items").insert(teInvoegen);
    if (error) throw error;
  }

  const updates = [...bestaande.entries()]
    .filter(([k]) => aangeraakt.has(k))
    .map(([, rij]) =>
      supabase
        .from("shopping_items")
        .update({ quantity: rij.quantity, unit: rij.unit, checked: false })
        .eq("id", rij.id),
    );
  await Promise.all(updates);
}
