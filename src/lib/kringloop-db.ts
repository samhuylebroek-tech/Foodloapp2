/**
 * Kringloop tegen de databank.
 *
 * Betrouwbaarheid (zolang er geen databanktransacties/RPC's zijn, zie masterplan §5.3):
 * - elke stap wordt gecontroleerd (`moet`): een fout gaat nooit stil voorbij;
 * - mislukt een latere stap, dan worden de eerdere stappen teruggedraaid
 *   (compensatie), zodat er geen half uitgevoerde actie achterblijft;
 * - vlak vóór het schrijven wordt opnieuw gerekend (twee gezinsleden tegelijk,
 *   een tweede venster, dubbel tikken → geen dubbels);
 * - elke actie geeft één herstelfunctie terug die maar één keer werkt.
 * Geen schemawijzigingen: meal_plan, recipes, recipe_ingredients, pantry_items, shopping_items.
 */
import { supabase } from "@/integrations/supabase/client";
import { zorgVoorLijst } from "@/lib/boodschappen";
import { bewaarGekocht } from "@/lib/boodschappen-geheugen";
import {
  berekenAanvulling,
  waaromNodig,
  type Waarom,
  lijstBijsturen,
  lijstWijzigingen,
  verbruik,
  voorraadNaKoop,
  type Aanvulling,
  type Gekocht,
  type LijstRegel,
  type Regel,
  type VoorraadRij,
} from "@/lib/kringloop";
import { lokaleDatum } from "@/lib/tijd";

export const KOMENDE_DAGEN = 7;

export type Herstel = () => Promise<void>;

/** Fout van de databank → echte fout (supabase-js gooit zelf niet). */
function moet<T extends { error: unknown }>(res: T): T {
  if (res.error)
    throw res.error instanceof Error
      ? res.error
      : new Error(String((res.error as { message?: string }).message ?? res.error));
  return res;
}

/** Herstel dat maar één keer uitgevoerd wordt (dubbel tikken op "Ongedaan maken"). */
function eenmalig(f: Herstel): Herstel {
  let gedaan = false;
  return async () => {
    if (gedaan) return;
    gedaan = true;
    await f();
  };
}

/**
 * De actie mislukte én terugdraaien lukte niet helemaal (bv. verbinding volledig weg).
 * Dan mag de app níet zeggen dat er niets veranderd is.
 */
export class HalfGelukt extends Error {
  constructor() {
    super("Terugdraaien lukte niet helemaal");
    this.name = "HalfGelukt";
  }
}

/**
 * Voert compensaties in omgekeerde volgorde uit. Probeert ze allemaal, ook als er één
 * faalt, en gooit `HalfGelukt` als er minstens één mislukte.
 */
async function draaiTerug(stappen: Herstel[]): Promise<void> {
  let mislukt = false;
  for (const s of [...stappen].reverse()) {
    try {
      await s();
    } catch {
      mislukt = true;
    }
  }
  if (mislukt) throw new HalfGelukt();
}

function totDatum(vandaag: string) {
  const d = new Date(`${vandaag}T12:00:00`);
  d.setDate(d.getDate() + KOMENDE_DAGEN - 1);
  return lokaleDatum(d);
}

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

/** Ruwe rijen die Slim aanvullen al las; Vandaag hergebruikt ze (BUG-118, geen dubbele verzoeken). */
export type AanvullingRuw = {
  voorraad: { id: string; naam: string; hoeveelheid: number | null; eenheid: string }[];
  lijst: {
    id: string;
    name: string;
    checked: boolean;
    quantity: number | null;
    unit: string | null;
    recipe_id: string | null;
  }[];
  /** Recepten waarvan de ingrediënten gelezen zijn (ook als een recept er geen heeft). */
  receptIds: string[];
  ingredienten: { recipe_id: string; name: string; quantity: number | null; unit: string | null }[];
};

export async function laadAanvulling(
  userId: string,
  vandaag = lokaleDatum(),
): Promise<{ listId: string | null; aanvulling: Aanvulling; ruw: AanvullingRuw }> {
  // Alleen lezen: bekijken mag niets aanmaken. De lijst komt er pas bij het aanvullen.
  const listId = await vindLijst(userId);
  const [plan, later, voorraad, lijst] = await Promise.all([
    supabase
      .from("meal_plan")
      .select("plan_date, recipe_id, personen, custom_title, soort")
      .eq("user_id", userId)
      .is("group_id", null)
      .gte("plan_date", vandaag)
      .lte("plan_date", totDatum(vandaag)),
    // Later geplande gerechten: hun regels op de lijst zijn niet "niet meer nodig".
    supabase
      .from("meal_plan")
      .select("recipe_id")
      .eq("user_id", userId)
      .is("group_id", null)
      .gt("plan_date", totDatum(vandaag)),
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
    ruw: {
      voorraad: (voorraad.data ?? []) as AanvullingRuw["voorraad"],
      lijst: (lijst.data ?? []) as AanvullingRuw["lijst"],
      receptIds: ids,
      ingredienten: (ingredienten.data ?? []) as AanvullingRuw["ingredienten"],
    },
    aanvulling: berekenAanvulling({
      plan: plan.data ?? [],
      recepten: recepten.data ?? [],
      ingredienten: ingredienten.data ?? [],
      voorraad: voorraad.data ?? [],
      lijst: lijst.data ?? [],
      vanaf: vandaag,
      nogGepland: new Set(
        (later.data ?? []).map((p) => p.recipe_id).filter((x): x is string => !!x),
      ),
    }),
  };
}

/**
 * Regels op de lijst zetten: bijtellen bij een open regel of nieuw.
 * Mislukt iets halverwege, dan wordt alles teruggezet en volgt een fout.
 */
async function schrijfNaarLijst(userId: string, regels: Regel[]): Promise<Herstel> {
  const listId = await zorgVoorLijst(userId);
  const { data: open } = moet(
    await supabase
      .from("shopping_items")
      .select("id, name, checked, quantity, unit")
      .eq("list_id", listId)
      .eq("checked", false),
  );
  const w = lijstWijzigingen(
    regels.map((r) => (r.quantity == null && r.nodig != null ? { ...r, quantity: r.nodig } : r)),
    (open ?? []) as {
      id: string;
      name: string;
      checked: boolean;
      quantity: number | null;
      unit: string;
    }[],
  );
  const gedaan: Herstel[] = [];
  try {
    for (const b of w.bijtellen) {
      moet(await supabase.from("shopping_items").update({ quantity: b.quantity }).eq("id", b.id));
      gedaan.push(async () => {
        moet(await supabase.from("shopping_items").update({ quantity: b.oud }).eq("id", b.id));
      });
    }
    if (w.nieuw.length) {
      const { data } = moet(
        await supabase
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
          .select("id"),
      );
      const ids = (data ?? []).map((r) => r.id as string);
      gedaan.push(async () => {
        moet(await supabase.from("shopping_items").delete().in("id", ids));
      });
    }
  } catch (fout) {
    await draaiTerug(gedaan); // gooit HalfGelukt als terugdraaien niet lukte
    throw fout;
  }
  return () => draaiTerug(gedaan);
}

/**
 * Zet de gekozen regels op de lijst. Rekent eerst opnieuw (iemand anders kan
 * intussen iets toegevoegd hebben) en telt bij open regels op.
 */
export async function vulAan(
  userId: string,
  gekozen: Set<string> | "alles",
): Promise<{ aantal: number; herstel: Herstel }> {
  const { aanvulling } = await laadAanvulling(userId);
  const kandidaten = [...aanvulling.kopen, ...aanvulling.inHuis].filter((r) =>
    gekozen === "alles" ? aanvulling.kopen.includes(r) : gekozen.has(r.sleutel),
  );
  if (!kandidaten.length) return { aantal: 0, herstel: async () => undefined };
  const herstel = await schrijfNaarLijst(userId, kandidaten);
  return { aantal: kandidaten.length, herstel: eenmalig(herstel) };
}

/**
 * "Kook dit vanavond": plant het gerecht vandaag en zet alleen wat voor dít
 * gerecht ontbreekt op de lijst. Alles of niets: mislukt de lijst, dan wordt
 * de planning teruggedraaid. Staat het gerecht al op vanavond, dan gebeurt er niets.
 */
export async function kookVanavond(opts: {
  userId: string;
  recept: { id: string; title: string; servings: number | null };
  moment: string;
}): Promise<{ ontbreekt: number; alGepland: boolean; herstel: Herstel }> {
  const { userId, recept, moment } = opts;
  const vandaag = lokaleDatum();
  const { data: bestaand } = moet(
    await supabase
      .from("meal_plan")
      .select("id")
      .eq("user_id", userId)
      .eq("plan_date", vandaag)
      .eq("meal_type", moment)
      .eq("recipe_id", recept.id)
      .limit(1),
  );
  if (bestaand?.length) return { ontbreekt: 0, alGepland: true, herstel: async () => undefined };
  // Zelfde weg als elke menuwijziging (WP4): plannen + lijst bijsturen, alles of niets.
  const r = await wijzigMenu(
    userId,
    planErbij({
      userId,
      recipeId: recept.id,
      datum: vandaag,
      moment,
      personen: recept.servings,
    }),
  );
  return { ontbreekt: r.effect.erbij, alGepland: false, herstel: r.herstel };
}

/** Lijstregels voor gerechten die niet meer gepland zijn, weghalen (met herstel). */
export async function haalVanLijst(ids: string[]): Promise<Herstel> {
  const { data } = moet(
    await supabase
      .from("shopping_items")
      .select("user_id, list_id, name, quantity, unit, recipe_id, note, checked")
      .in("id", ids),
  );
  moet(await supabase.from("shopping_items").delete().in("id", ids));
  return eenmalig(async () => {
    if (data?.length) moet(await supabase.from("shopping_items").insert(data));
  });
}

/**
 * Klaar met winkelen: afgevinkte items naar de voorraad (optellen), lijst opruimen.
 * Alles of niets: mislukt het opruimen, dan wordt de voorraad teruggezet.
 */
export async function klaarMetWinkelen(opts: {
  userId: string;
  lijst: { id: string; name: string; group_id?: string | null };
  gekocht: (Gekocht & { id: string; recipe_id?: string | null; note?: string | null })[];
}): Promise<{ inVoorraad: number; herstel: Herstel }> {
  const { userId, lijst, gekocht } = opts;
  const { data: bestaand } = moet(
    await supabase
      .from("pantry_items")
      .select("id, naam, hoeveelheid, eenheid")
      .eq("user_id", userId),
  );
  const plan = voorraadNaKoop(gekocht, (bestaand ?? []) as VoorraadRij[]);
  const oud = new Map(
    (bestaand ?? []).map((v) => [v.id as string, v.hoeveelheid as number | null]),
  );
  const gedaan: Herstel[] = [];
  try {
    for (const b of plan.bijwerken) {
      moet(
        await supabase.from("pantry_items").update({ hoeveelheid: b.hoeveelheid }).eq("id", b.id),
      );
      gedaan.push(async () => {
        moet(
          await supabase
            .from("pantry_items")
            .update({ hoeveelheid: oud.get(b.id) ?? null })
            .eq("id", b.id),
        );
      });
    }
    if (plan.nieuw.length) {
      const { data } = moet(
        await supabase
          .from("pantry_items")
          .insert(plan.nieuw.map((n) => ({ ...n, user_id: userId })))
          .select("id"),
      );
      const ids = (data ?? []).map((r) => r.id as string);
      gedaan.push(async () => {
        moet(await supabase.from("pantry_items").delete().in("id", ids));
      });
    }
    moet(
      await supabase
        .from("shopping_items")
        .delete()
        .in(
          "id",
          gekocht.map((g) => g.id),
        ),
    );
    gedaan.push(async () => {
      moet(
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
        ),
      );
    });
  } catch (fout) {
    await draaiTerug(gedaan); // gooit HalfGelukt als terugdraaien niet lukte
    throw fout;
  }
  // Geschiedenis ("Eerder gekocht") is een extraatje: mag nooit de actie doen mislukken.
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
  return {
    inVoorraad: plan.bijwerken.length + plan.nieuw.length,
    herstel: eenmalig(() => draaiTerug(gedaan)),
  };
}

/**
 * Na het koken: gebruikte hoeveelheden uit de voorraad halen. Alles of niets.
 */
export async function verwerkKoken(opts: {
  userId: string;
  ingredienten: { name: string; quantity: number | null; unit: string | null }[];
  factor: number;
}): Promise<{ samenvatting: string[]; herstel: Herstel } | null> {
  const { data: voorraad } = moet(
    await supabase
      .from("pantry_items")
      .select("id, naam, hoeveelheid, eenheid")
      .eq("user_id", opts.userId),
  );
  const v = verbruik(opts.ingredienten, (voorraad ?? []) as VoorraadRij[], opts.factor);
  if (!v.bijwerken.length && !v.op.length) return null;
  const gedaan: Herstel[] = [];
  try {
    for (const b of v.bijwerken) {
      moet(
        await supabase.from("pantry_items").update({ hoeveelheid: b.hoeveelheid }).eq("id", b.id),
      );
      gedaan.push(async () => {
        moet(await supabase.from("pantry_items").update({ hoeveelheid: b.oud }).eq("id", b.id));
      });
    }
    if (v.op.length) {
      moet(
        await supabase
          .from("pantry_items")
          .delete()
          .in(
            "id",
            v.op.map((o) => o.id),
          ),
      );
      gedaan.push(async () => {
        moet(
          await supabase.from("pantry_items").insert(
            v.op.map((o) => ({
              user_id: opts.userId,
              naam: o.naam,
              hoeveelheid: o.hoeveelheid,
              eenheid: o.eenheid ?? "",
            })),
          ),
        );
      });
    }
  } catch (fout) {
    await draaiTerug(gedaan); // gooit HalfGelukt als terugdraaien niet lukte
    throw fout;
  }
  return {
    samenvatting: [
      ...v.op.map((o) => `${o.naam} op`),
      ...v.bijwerken.map((b) => `${b.naam} minder`),
    ],
    herstel: eenmalig(() => draaiTerug(gedaan)),
  };
}

// ---------------------------------------------------------------- WP4 weekmenu → lijst

/** Een maaltijd die erbij kwam of wegging (voor de lijst telt alleen recept en dag). */
export type PlanStap = { plan_date: string; recipe_id: string | null };

export type PlanUitvoering = {
  id?: string | undefined;
  herstel: Herstel;
  erbij: PlanStap[];
  weg: PlanStap[];
};

export type LijstEffect = { erbij: number; minder: number; weg: number };

const GEEN_EFFECT: LijstEffect = { erbij: 0, minder: 0, weg: 0 };

/** Gerecht in het weekmenu zetten. */
export function planErbij(o: {
  userId: string;
  recipeId: string | null;
  datum: string;
  moment: string;
  personen?: number | null;
  customTitle?: string | null;
  soort?: string | null;
}): () => Promise<PlanUitvoering> {
  return async () => {
    const { data } = moet(
      await supabase
        .from("meal_plan")
        .insert({
          user_id: o.userId,
          recipe_id: o.recipeId,
          custom_title: o.recipeId ? null : (o.customTitle ?? null),
          soort: o.soort ?? null,
          plan_date: o.datum,
          meal_type: o.moment,
          personen: o.personen ?? null,
          group_id: null,
        })
        .select("id")
        .single(),
    );
    if (!data) throw new Error("Inplannen lukte niet");
    const id = data.id as string;
    return {
      id,
      herstel: async () => {
        moet(await supabase.from("meal_plan").delete().eq("id", id));
      },
      erbij: [{ plan_date: o.datum, recipe_id: o.recipeId }],
      weg: [],
    };
  };
}

type PlanRij = Record<string, unknown> & {
  id: string;
  group_id: string | null;
  plan_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_title: string | null;
};

async function leesPlan(planId: string): Promise<PlanRij | null> {
  const { data } = moet(await supabase.from("meal_plan").select("*").eq("id", planId).limit(1));
  return ((data ?? [])[0] as PlanRij | undefined) ?? null;
}

/** Gerecht uit het weekmenu halen. Al weg (dubbel tikken, ander toestel)? Dan gebeurt er niets. */
export function planWeg(planId: string): () => Promise<PlanUitvoering> {
  return async () => {
    const rij = await leesPlan(planId);
    if (!rij) return { herstel: async () => undefined, erbij: [], weg: [] };
    moet(await supabase.from("meal_plan").delete().eq("id", planId));
    return {
      id: planId,
      herstel: async () => {
        moet(await supabase.from("meal_plan").insert(rij as never));
      },
      erbij: [],
      weg: rij.group_id ? [] : [{ plan_date: rij.plan_date, recipe_id: rij.recipe_id }],
    };
  };
}

/** Ander recept op dezelfde plek (ook: een titel zonder recept koppelen). */
export function planVervang(planId: string, recipeId: string): () => Promise<PlanUitvoering> {
  return async () => {
    const rij = await leesPlan(planId);
    if (!rij) throw new Error("Deze maaltijd staat niet meer in je weekmenu");
    moet(
      await supabase
        .from("meal_plan")
        .update({ recipe_id: recipeId, custom_title: null })
        .eq("id", planId),
    );
    return {
      id: planId,
      herstel: async () => {
        moet(
          await supabase
            .from("meal_plan")
            .update({ recipe_id: rij.recipe_id, custom_title: rij.custom_title })
            .eq("id", planId),
        );
      },
      erbij: rij.group_id ? [] : [{ plan_date: rij.plan_date, recipe_id: recipeId }],
      weg: rij.group_id ? [] : [{ plan_date: rij.plan_date, recipe_id: rij.recipe_id }],
    };
  };
}

/** Naar een andere dag of ander moment. */
export function planVerplaats(
  planId: string,
  datum: string,
  moment: string,
): () => Promise<PlanUitvoering> {
  return async () => {
    const rij = await leesPlan(planId);
    if (!rij) throw new Error("Deze maaltijd staat niet meer in je weekmenu");
    moet(
      await supabase
        .from("meal_plan")
        .update({ plan_date: datum, meal_type: moment })
        .eq("id", planId),
    );
    return {
      id: planId,
      herstel: async () => {
        moet(
          await supabase
            .from("meal_plan")
            .update({ plan_date: rij.plan_date, meal_type: rij.meal_type })
            .eq("id", planId),
        );
      },
      erbij: rij.group_id ? [] : [{ plan_date: datum, recipe_id: rij.recipe_id }],
      weg: rij.group_id ? [] : [{ plan_date: rij.plan_date, recipe_id: rij.recipe_id }],
    };
  };
}

/**
 * Eén ronde bijsturen: alles vers lezen, rekenen (`lijstBijsturen`), schrijven.
 * Mislukt een schrijfstap, dan worden de vorige teruggedraaid.
 */
async function bijstuurRonde(o: {
  userId: string;
  listId: string;
  vandaag: string;
  tot: string;
  toegevoegd: string[];
  weggehaald: string[];
}): Promise<{ effect: LijstEffect; herstel: Herstel }> {
  const [plan, later, voorraad, lijst] = await Promise.all([
    supabase
      .from("meal_plan")
      .select("plan_date, recipe_id, personen, custom_title, soort")
      .eq("user_id", o.userId)
      .is("group_id", null)
      .gte("plan_date", o.vandaag)
      .lte("plan_date", o.tot),
    supabase
      .from("meal_plan")
      .select("recipe_id")
      .eq("user_id", o.userId)
      .is("group_id", null)
      .gt("plan_date", o.tot),
    supabase.from("pantry_items").select("id, naam, hoeveelheid, eenheid").eq("user_id", o.userId),
    supabase.from("shopping_items").select("*").eq("list_id", o.listId),
  ]);
  moet(plan);
  moet(later);
  moet(voorraad);
  moet(lijst);
  const ids = [
    ...new Set([...(plan.data ?? []).map((p) => p.recipe_id), ...o.toegevoegd, ...o.weggehaald]),
  ].filter((x): x is string => !!x);
  const [recepten, ingredienten] = await Promise.all([
    supabase.from("recipes").select("id, title, servings").in("id", ids),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, name, quantity, unit")
      .in("recipe_id", ids),
  ]);
  moet(recepten);
  moet(ingredienten);
  const rijen = (lijst.data ?? []) as unknown as (LijstRegel & Record<string, unknown>)[];
  const b = lijstBijsturen({
    plan: plan.data ?? [],
    recepten: recepten.data ?? [],
    ingredienten: ingredienten.data ?? [],
    voorraad: voorraad.data ?? [],
    lijst: rijen,
    vanaf: o.vandaag,
    toegevoegd: o.toegevoegd,
    weggehaald: o.weggehaald,
    nogGepland: new Set((later.data ?? []).map((p) => p.recipe_id).filter((x): x is string => !!x)),
  });

  const effect: LijstEffect = { ...GEEN_EFFECT };
  const gedaan: Herstel[] = [];
  try {
    for (const w of b.bijwerken) {
      moet(
        await supabase
          .from("shopping_items")
          .update({ quantity: w.quantity, recipe_id: w.recipe_id })
          .eq("id", w.id),
      );
      gedaan.push(async () => {
        moet(
          await supabase
            .from("shopping_items")
            .update({ quantity: w.oud.quantity, recipe_id: w.oud.recipe_id })
            .eq("id", w.id),
        );
      });
      if ((w.quantity ?? 0) < (w.oud.quantity ?? 0)) effect.minder++;
      else if ((w.quantity ?? 0) > (w.oud.quantity ?? 0)) effect.erbij++;
    }
    if (b.nieuw.length) {
      const { data } = moet(
        await supabase
          .from("shopping_items")
          .insert(
            b.nieuw.map((r) => ({
              user_id: o.userId,
              list_id: o.listId,
              name: r.naam,
              quantity: r.quantity,
              unit: r.unit,
              recipe_id: r.recipe_id,
              note: null,
            })),
          )
          .select("id"),
      );
      const nieuweIds = (data ?? []).map((r) => r.id as string);
      gedaan.push(async () => {
        moet(await supabase.from("shopping_items").delete().in("id", nieuweIds));
      });
      effect.erbij += b.nieuw.length;
    }
    if (b.weg.length) {
      const wegIds = b.weg.map((w) => w.id);
      const volledig = rijen.filter((r) => wegIds.includes(r.id));
      moet(await supabase.from("shopping_items").delete().in("id", wegIds));
      gedaan.push(async () => {
        moet(await supabase.from("shopping_items").insert(volledig as never));
      });
      effect.weg += b.weg.length;
    }
  } catch (fout) {
    await draaiTerug(gedaan); // gooit HalfGelukt als terugdraaien niet lukte
    throw fout;
  }
  return { effect, herstel: () => draaiTerug(gedaan) };
}

/**
 * Stuurt de lijst bij na een wijziging in het weekmenu. Alleen maaltijden vanaf vandaag tellen;
 * wat erbij komt telt pas mee binnen de komende 7 dagen (zoals Slim aanvullen).
 * Daarna een nacontrole: schreef iemand anders tegelijk (tweede venster, gezinslid), dan
 * worden dubbels meteen samengevoegd.
 */
async function stuurLijstBij(
  userId: string,
  erbij: PlanStap[],
  weg: PlanStap[],
): Promise<{ effect: LijstEffect; herstel: Herstel }> {
  const vandaag = lokaleDatum();
  const venster = totDatum(vandaag);
  const uniek = (l: PlanStap[]) =>
    [...new Set(l.map((x) => x.recipe_id))].filter((x): x is string => !!x);
  const toegevoegd = uniek(erbij.filter((e) => e.plan_date >= vandaag && e.plan_date <= venster));
  const wegRelevant = weg.filter((w) => w.recipe_id && w.plan_date >= vandaag);
  const weggehaald = uniek(wegRelevant);
  const niets = { effect: { ...GEEN_EFFECT }, herstel: async () => undefined };
  if (!toegevoegd.length && !weggehaald.length) return niets;
  const tot = [venster, ...wegRelevant.map((w) => w.plan_date)].sort().at(-1)!;
  let listId = await vindLijst(userId);
  if (!listId) {
    if (!toegevoegd.length) return niets;
    listId = await zorgVoorLijst(userId);
  }
  const ronde = () => bijstuurRonde({ userId, listId, vandaag, tot, toegevoegd, weggehaald });
  const eerste = await ronde();
  let tweede: Awaited<ReturnType<typeof ronde>>;
  try {
    tweede = await ronde();
  } catch (fout) {
    await draaiTerug([eerste.herstel]);
    throw fout;
  }
  return {
    effect: {
      erbij: eerste.effect.erbij + tweede.effect.erbij,
      minder: eerste.effect.minder + tweede.effect.minder,
      weg: eerste.effect.weg + tweede.effect.weg,
    },
    herstel: () => draaiTerug([eerste.herstel, tweede.herstel]),
  };
}

/**
 * Weekmenu wijzigen én de lijst meteen bijsturen, als één actie:
 * - lukt de lijst niet, dan wordt de menuwijziging teruggedraaid (niets half);
 * - "Ongedaan maken" zet menu én lijst terug, en werkt maar één keer.
 */
export async function wijzigMenu(
  userId: string,
  actie: () => Promise<PlanUitvoering>,
): Promise<{ id?: string | undefined; effect: LijstEffect; veranderd: boolean; herstel: Herstel }> {
  const r = await actie();
  // Niets voor de lijst (bv. gezinsmaaltijd of al weg): wel de menuwijziging zelf terug te draaien.
  if (!r.erbij.length && !r.weg.length)
    return {
      id: r.id,
      effect: { ...GEEN_EFFECT },
      veranderd: !!r.id,
      herstel: eenmalig(() => draaiTerug([r.herstel])),
    };
  let lijst: Awaited<ReturnType<typeof stuurLijstBij>>;
  try {
    lijst = await stuurLijstBij(userId, r.erbij, r.weg);
  } catch (fout) {
    await draaiTerug([r.herstel]); // gooit HalfGelukt als terugdraaien niet lukte
    throw fout;
  }
  return {
    id: r.id,
    effect: lijst.effect,
    veranderd: true,
    herstel: eenmalig(() => draaiTerug([r.herstel, lijst.herstel])),
  };
}

/** Korte uitleg voor de melding: "lijst: 2 erbij, 1 minder". Leeg als de lijst gelijk bleef. */
export function lijstUitleg(e: LijstEffect): string {
  const delen = [
    e.erbij ? `${e.erbij} erbij` : "",
    e.minder ? `${e.minder} minder` : "",
    e.weg ? `${e.weg} eraf` : "",
  ].filter(Boolean);
  return delen.length ? `lijst: ${delen.join(", ")}` : "";
}

// ---------------------------------------------------------------- B3 waarom op mijn lijst?

/**
 * Waarom staat dit product op de lijst? Alleen lezen. Kijkt naar het eigen weekmenu van
 * vandaag tot en met 6 dagen later (zoals Slim aanvullen), de voorraad en de gekozen lijst.
 */
export async function laadWaarom(opts: {
  userId: string;
  listId: string;
  naam: string;
  regelId?: string;
  vandaag?: string;
}): Promise<Waarom> {
  const vandaag = opts.vandaag ?? lokaleDatum();
  const [plan, voorraad, lijst] = await Promise.all([
    supabase
      .from("meal_plan")
      .select("plan_date, recipe_id, personen, custom_title, soort")
      .eq("user_id", opts.userId)
      .is("group_id", null)
      .gte("plan_date", vandaag)
      .lte("plan_date", totDatum(vandaag)),
    supabase
      .from("pantry_items")
      .select("id, naam, hoeveelheid, eenheid")
      .eq("user_id", opts.userId),
    supabase
      .from("shopping_items")
      .select("id, name, checked, quantity, unit, recipe_id")
      .eq("list_id", opts.listId),
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
  return waaromNodig({
    naam: opts.naam,
    ...(opts.regelId ? { regelId: opts.regelId } : {}),
    plan: plan.data ?? [],
    recepten: recepten.data ?? [],
    ingredienten: ingredienten.data ?? [],
    voorraad: voorraad.data ?? [],
    lijst: (lijst.data ?? []) as never,
    vanaf: vandaag,
  });
}
