/**
 * Kringloop tegen de databank. Elke schrijfactie:
 * - rekent vlak vóór het schrijven opnieuw (zodat twee gezinsleden die tegelijk
 *   aanvullen geen dubbels maken), en
 * - geeft terug wat nodig is om het ongedaan te maken.
 * Geen schemawijzigingen: meal_plan, recipes, recipe_ingredients, pantry_items, shopping_items.
 */
import { supabase } from "@/integrations/supabase/client";
import { zorgVoorLijst } from "@/lib/boodschappen";
import { bewaarGekocht } from "@/lib/boodschappen-geheugen";
import {
  berekenAanvulling,
  lijstWijzigingen,
  verbruik,
  voorraadNaKoop,
  type Aanvulling,
  type Gekocht,
  type VoorraadRij,
} from "@/lib/kringloop";
import { lokaleDatum } from "@/lib/tijd";

export const KOMENDE_DAGEN = 7;

export type Herstel = () => Promise<void>;

function totDatum(vandaag: string) {
  const d = new Date(`${vandaag}T12:00:00`);
  d.setDate(d.getDate() + KOMENDE_DAGEN - 1);
  return lokaleDatum(d);
}

/** Alles ophalen en uitrekenen wat er voor de komende dagen nog nodig is. */
/** Eerste lijst van de gebruiker, zonder er een aan te maken (alleen lezen). */
async function vindLijst(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function laadAanvulling(
  userId: string,
  vandaag = lokaleDatum(),
): Promise<{ listId: string | null; aanvulling: Aanvulling }> {
  // Alleen lezen: bekijken mag niets aanmaken. De lijst komt er pas bij het aanvullen.
  const listId = await vindLijst(userId);
  const [plan, voorraad, lijst] = await Promise.all([
    supabase
      .from("meal_plan")
      .select("plan_date, recipe_id, personen, custom_title, soort")
      .eq("user_id", userId)
      .is("group_id", null)
      .gte("plan_date", vandaag)
      .lte("plan_date", totDatum(vandaag)),
    supabase.from("pantry_items").select("id, naam, hoeveelheid, eenheid").eq("user_id", userId),
    listId
      ? supabase
          .from("shopping_items")
          .select("id, name, checked, quantity, unit, recipe_id")
          .eq("list_id", listId)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  if (plan.error) throw plan.error;
  const ids = [
    ...new Set((plan.data ?? []).map((p) => p.recipe_id).filter((x): x is string => !!x)),
  ];
  const [recepten, ingredienten] = ids.length
    ? await Promise.all([
        supabase.from("recipes").select("id, title, servings").in("id", ids),
        supabase
          .from("recipe_ingredients")
          .select("recipe_id, name, quantity, unit")
          .in("recipe_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  return {
    listId,
    aanvulling: berekenAanvulling({
      plan: plan.data ?? [],
      recepten: recepten.data ?? [],
      ingredienten: ingredienten.data ?? [],
      voorraad: voorraad.data ?? [],
      lijst: lijst.data ?? [],
      vanaf: vandaag,
    }),
  };
}

/**
 * Zet de gekozen regels op de lijst. Rekent eerst opnieuw (iemand anders kan
 * intussen iets toegevoegd hebben) en telt bij open regels op in plaats van
 * een tweede regel te maken.
 */
export async function vulAan(
  userId: string,
  gekozen: Set<string> | "alles",
): Promise<{ aantal: number; herstel: Herstel }> {
  const { aanvulling } = await laadAanvulling(userId);
  const listId = await zorgVoorLijst(userId);
  const kandidaten = [...aanvulling.kopen, ...aanvulling.inHuis].filter((r) =>
    gekozen === "alles" ? aanvulling.kopen.includes(r) : gekozen.has(r.sleutel),
  );
  if (!kandidaten.length) return { aantal: 0, herstel: async () => undefined };
  const { data: open } = await supabase
    .from("shopping_items")
    .select("id, name, checked, quantity, unit")
    .eq("list_id", listId)
    .eq("checked", false);
  const w = lijstWijzigingen(
    kandidaten.map((r) =>
      r.quantity == null && r.nodig != null ? { ...r, quantity: r.nodig } : r,
    ),
    (open ?? []) as {
      id: string;
      name: string;
      checked: boolean;
      quantity: number | null;
      unit: string;
    }[],
  );
  for (const b of w.bijtellen) {
    await supabase.from("shopping_items").update({ quantity: b.quantity }).eq("id", b.id);
  }
  let nieuweIds: string[] = [];
  if (w.nieuw.length) {
    const { data, error } = await supabase
      .from("shopping_items")
      .insert(
        w.nieuw.map((r) => ({
          user_id: userId,
          list_id: listId,
          name: r.naam,
          quantity: r.quantity ?? r.nodig,
          unit: r.unit,
          recipe_id: r.recipe_id,
          note: null,
        })),
      )
      .select("id");
    if (error) throw error;
    nieuweIds = (data ?? []).map((r) => r.id as string);
  }
  return {
    aantal: kandidaten.length,
    herstel: async () => {
      if (nieuweIds.length) await supabase.from("shopping_items").delete().in("id", nieuweIds);
      for (const b of w.bijtellen)
        await supabase.from("shopping_items").update({ quantity: b.oud }).eq("id", b.id);
    },
  };
}

/** Lijstregels voor gerechten die niet meer gepland zijn, weghalen (met herstel). */
export async function haalVanLijst(ids: string[]): Promise<Herstel> {
  const { data } = await supabase
    .from("shopping_items")
    .select("user_id, list_id, name, quantity, unit, recipe_id, note, checked")
    .in("id", ids);
  await supabase.from("shopping_items").delete().in("id", ids);
  return async () => {
    if (data?.length) await supabase.from("shopping_items").insert(data);
  };
}

/**
 * Klaar met winkelen: afgevinkte items naar de voorraad (optellen), lijst opruimen.
 * Geen vraag vooraf; één "Ongedaan maken" zet alles terug.
 */
export async function klaarMetWinkelen(opts: {
  userId: string;
  lijst: { id: string; name: string; group_id?: string | null };
  gekocht: (Gekocht & { id: string; recipe_id?: string | null; note?: string | null })[];
}): Promise<{ inVoorraad: number; herstel: Herstel }> {
  const { userId, lijst, gekocht } = opts;
  const { data: bestaand, error } = await supabase
    .from("pantry_items")
    .select("id, naam, hoeveelheid, eenheid")
    .eq("user_id", userId);
  if (error) throw error;
  const plan = voorraadNaKoop(gekocht, (bestaand ?? []) as VoorraadRij[]);
  const oud = new Map(
    (bestaand ?? []).map((v) => [v.id as string, v.hoeveelheid as number | null]),
  );
  for (const b of plan.bijwerken)
    await supabase.from("pantry_items").update({ hoeveelheid: b.hoeveelheid }).eq("id", b.id);
  let nieuweIds: string[] = [];
  if (plan.nieuw.length) {
    const { data, error: fout } = await supabase
      .from("pantry_items")
      .insert(plan.nieuw.map((n) => ({ ...n, user_id: userId })))
      .select("id");
    if (fout) throw fout;
    nieuweIds = (data ?? []).map((r) => r.id as string);
  }
  await bewaarGekocht(
    userId,
    lijst,
    gekocht.map((g) => ({
      name: g.name,
      quantity: g.quantity,
      unit: g.unit ?? "",
      recipe_id: g.recipe_id ?? null,
    })),
  ).catch(() => undefined);
  await supabase
    .from("shopping_items")
    .delete()
    .in(
      "id",
      gekocht.map((g) => g.id),
    );
  return {
    inVoorraad: plan.bijwerken.length + plan.nieuw.length,
    herstel: async () => {
      if (nieuweIds.length) await supabase.from("pantry_items").delete().in("id", nieuweIds);
      for (const b of plan.bijwerken)
        await supabase
          .from("pantry_items")
          .update({ hoeveelheid: oud.get(b.id) ?? null })
          .eq("id", b.id);
      await supabase.from("shopping_items").insert(
        gekocht.map((g) => ({
          user_id: userId,
          list_id: lijst.id,
          name: g.name,
          quantity: g.quantity,
          unit: g.unit ?? "",
          recipe_id: g.recipe_id ?? null,
          note: g.note ?? null,
          checked: true,
        })),
      );
    },
  };
}

/**
 * Na het koken: gebruikte hoeveelheden uit de voorraad halen. Geen vraag;
 * de melding zegt wat er gebeurde en "Ongedaan maken" zet het terug.
 */
export async function verwerkKoken(opts: {
  userId: string;
  ingredienten: { name: string; quantity: number | null; unit: string | null }[];
  factor: number;
}): Promise<{ samenvatting: string[]; herstel: Herstel } | null> {
  const { data: voorraad } = await supabase
    .from("pantry_items")
    .select("id, naam, hoeveelheid, eenheid")
    .eq("user_id", opts.userId);
  const v = verbruik(opts.ingredienten, (voorraad ?? []) as VoorraadRij[], opts.factor);
  if (!v.bijwerken.length && !v.op.length) return null;
  for (const b of v.bijwerken)
    await supabase.from("pantry_items").update({ hoeveelheid: b.hoeveelheid }).eq("id", b.id);
  if (v.op.length)
    await supabase
      .from("pantry_items")
      .delete()
      .in(
        "id",
        v.op.map((o) => o.id),
      );
  return {
    samenvatting: [
      ...v.op.map((o) => `${o.naam} op`),
      ...v.bijwerken.map((b) => `${b.naam} minder`),
    ],
    herstel: async () => {
      for (const b of v.bijwerken)
        await supabase.from("pantry_items").update({ hoeveelheid: b.oud }).eq("id", b.id);
      if (v.op.length)
        await supabase.from("pantry_items").insert(
          v.op.map((o) => ({
            user_id: opts.userId,
            naam: o.naam,
            hoeveelheid: o.hoeveelheid,
            eenheid: o.eenheid ?? "",
          })),
        );
    },
  };
}
