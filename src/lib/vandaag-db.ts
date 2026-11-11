/**
 * WP3 — alles wat Vandaag moet weten, in één keer gelezen (alleen lezen, nooit schrijven).
 * De beslissing zelf zit in `lib/vandaag.ts` (puur, getest).
 */
import { supabase } from "@/integrations/supabase/client";
import { berekenAanvulling, type PlanMaaltijd } from "@/lib/kringloop";
import { laadAanvulling, type AanvullingRuw } from "@/lib/kringloop-db";
import { lokaleDatum } from "@/lib/tijd";
import type { MaaltijdVandaag, VandaagInvoer } from "@/lib/vandaag";

type PlanRij = {
  id: string;
  plan_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_title: string | null;
  soort: string | null;
  personen: number | null;
  group_id: string | null;
  recipes: {
    id: string;
    title: string;
    servings: number | null;
    prep_minutes: number | null;
    cook_minutes: number | null;
    image_url: string | null;
    category: string | null;
    tags: string[] | null;
    instructions: unknown;
  } | null;
};

function plusDagen(datum: string, n: number) {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + n);
  return lokaleDatum(d);
}

/**
 * Zelfde gerecht persoonlijk én via het gezin gepland? Eén keer tonen (persoonlijk gaat voor).
 */
function ontdubbel(rijen: PlanRij[]) {
  const per = new Map<string, PlanRij>();
  for (const r of rijen) {
    const k = `${r.plan_date}|${r.meal_type}|${r.recipe_id ?? r.custom_title ?? r.id}`;
    const al = per.get(k);
    if (!al || (al.group_id && !r.group_id)) per.set(k, r);
  }
  return [...per.values()];
}

function naarMaaltijd(r: PlanRij): MaaltijdVandaag {
  return {
    id: r.id,
    meal_type: r.meal_type,
    custom_title: r.custom_title,
    recept: r.recipes
      ? {
          id: r.recipes.id,
          title: r.recipes.title,
          servings: r.recipes.servings,
          prep_minutes: r.recipes.prep_minutes,
          cook_minutes: r.recipes.cook_minutes,
          image_url: r.recipes.image_url,
          category: r.recipes.category,
          tags: r.recipes.tags,
          stappen: Array.isArray(r.recipes.instructions) ? r.recipes.instructions.length : 0,
        }
      : null,
  };
}

export type VandaagStand = Omit<VandaagInvoer, "nu" | "voortgang" | "heeftRecepten"> & {
  /** Sleutels (zoals Slim aanvullen) van wat vandaag ontbreekt: voor "Zet op mijn lijst". */
  sleutelsVandaag: string[];
};

export type AanvullingStand = Awaited<ReturnType<typeof laadAanvulling>>;

/**
 * `opties.aanvulling`: haal Slim aanvullen via de gedeelde cache (zelfde stand als de aanvulkaart).
 * Vandaag hergebruikt daarvan de lijst, de voorraad en de ingrediënten, zodat die niet 2–3× worden
 * opgehaald (BUG-118). Lukt aanvullen niet, dan leest Vandaag ze zelf (zoals vroeger).
 */
export async function laadVandaag(
  userId: string,
  vandaag = lokaleDatum(),
  opties: { aanvulling?: () => Promise<AanvullingStand> } = {},
): Promise<VandaagStand> {
  const morgen = plusDagen(vandaag, 1);
  const laatste = plusDagen(vandaag, 6);
  const haalAanvulling = opties.aanvulling ?? (() => laadAanvulling(userId, vandaag));
  const [plan, aanvulling] = await Promise.all([
    supabase
      .from("meal_plan")
      .select(
        "id, plan_date, meal_type, recipe_id, custom_title, soort, personen, group_id, recipes(id, title, servings, prep_minutes, cook_minutes, image_url, category, tags, instructions)",
      )
      .gte("plan_date", vandaag)
      .lte("plan_date", laatste),
    haalAanvulling().catch(() => null),
  ]);
  if (plan.error) throw plan.error;
  const basis: Pick<AanvullingRuw, "voorraad" | "lijst"> = aanvulling
    ? aanvulling.ruw
    : await leesBasis(userId);
  const rijen = ontdubbel((plan.data ?? []) as unknown as PlanRij[]);
  const opDag = (d: string) => rijen.filter((r) => r.plan_date === d);

  // Wat ontbreekt er voor één dag? Zelfde rekenregel als Slim aanvullen. Ingrediënten die
  // aanvullen al las, worden niet opnieuw gevraagd.
  const ids = [...new Set(rijen.map((r) => r.recipe_id).filter((x): x is string => !!x))];
  const gekend = new Set(aanvulling?.ruw.receptIds ?? []);
  const nog = ids.filter((id) => !gekend.has(id));
  const { data: extra } = nog.length
    ? await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name, quantity, unit")
        .in("recipe_id", nog)
    : { data: [] };
  const ingredienten = [
    ...(aanvulling?.ruw.ingredienten ?? []).filter((i) => ids.includes(i.recipe_id)),
    ...(extra ?? []),
  ];
  const voorraad = { data: basis.voorraad };
  const lijst = { data: basis.lijst };
  const voorDag = (d: string) => {
    const dag = opDag(d);
    const a = berekenAanvulling({
      plan: dag.map((r): PlanMaaltijd => ({
        plan_date: r.plan_date,
        recipe_id: r.recipe_id,
        personen: r.personen,
        custom_title: r.custom_title,
        soort: r.soort,
      })),
      recepten: dag.filter((r) => r.recipes).map((r) => r.recipes!),
      ingredienten,
      voorraad: voorraad.data ?? [],
      lijst: lijst.data ?? [],
      vanaf: d,
    });
    return {
      ontbreekt: a.kopen.map((k) => k.naam),
      sleutels: a.kopen.map((k) => k.sleutel),
      opLijst: a.opLijst.map((k) => k.naam),
    };
  };
  const v = voorDag(vandaag);
  const m = voorDag(morgen);

  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(vandaag, i));
  return {
    vandaag: opDag(vandaag).map(naarMaaltijd),
    morgen: opDag(morgen).map(naarMaaltijd),
    ontbreektVandaag: v.ontbreekt,
    sleutelsVandaag: v.sleutels,
    nogKopenVandaag: v.opLijst,
    ontbreektMorgen: m.ontbreekt,
    vrijeDagen: dagen.filter((d) => !opDag(d).length).length,
    aanvullen: aanvulling?.aanvulling.kopen.length ?? 0,
    teKopen: (lijst.data ?? []).filter((i) => !i.checked).length,
  };
}

/** Terugval als Slim aanvullen niet lukte: lijst en voorraad zelf lezen. */
async function leesBasis(userId: string): Promise<Pick<AanvullingRuw, "voorraad" | "lijst">> {
  const { data: lijsten } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1);
  const listId = lijsten?.[0]?.id ?? null;
  const [voorraad, lijst] = await Promise.all([
    supabase.from("pantry_items").select("id, naam, hoeveelheid, eenheid").eq("user_id", userId),
    listId
      ? supabase
          .from("shopping_items")
          .select("id, name, checked, quantity, unit, recipe_id")
          .eq("list_id", listId)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);
  return {
    voorraad: (voorraad.data ?? []) as AanvullingRuw["voorraad"],
    lijst: (lijst.data ?? []) as AanvullingRuw["lijst"],
  };
}
