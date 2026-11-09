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
  lijstWijzigingen,
  verbruik,
  voorraadNaKoop,
  type Aanvulling,
  type Gekocht,
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

  const { data: plan } = moet(
    await supabase
      .from("meal_plan")
      .insert({
        user_id: userId,
        recipe_id: recept.id,
        plan_date: vandaag,
        meal_type: moment,
        personen: recept.servings,
        group_id: null,
      })
      .select("id")
      .single(),
  );
  if (!plan) throw new Error("Inplannen lukte niet");
  const planId = plan.id;
  const planWeg: Herstel = async () => {
    moet(await supabase.from("meal_plan").delete().eq("id", planId));
  };
  try {
    const listId = await vindLijst(userId);
    const [ingredienten, voorraad, lijst] = await Promise.all([
      supabase
        .from("recipe_ingredients")
        .select("recipe_id, name, quantity, unit")
        .eq("recipe_id", recept.id),
      supabase.from("pantry_items").select("id, naam, hoeveelheid, eenheid").eq("user_id", userId),
      listId
        ? supabase
            .from("shopping_items")
            .select("id, name, checked, quantity, unit, recipe_id")
            .eq("list_id", listId)
        : Promise.resolve({ data: [] as never[], error: null }),
    ]);
    moet(ingredienten);
    moet(voorraad);
    moet(lijst);
    const a = berekenAanvulling({
      plan: [{ plan_date: vandaag, recipe_id: recept.id, personen: recept.servings }],
      recepten: [recept],
      ingredienten: ingredienten.data ?? [],
      voorraad: voorraad.data ?? [],
      lijst: lijst.data ?? [],
      vanaf: vandaag,
    });
    const lijstHerstel = a.kopen.length ? await schrijfNaarLijst(userId, a.kopen) : null;
    return {
      ontbreekt: a.kopen.length,
      alGepland: false,
      herstel: eenmalig(async () => {
        await lijstHerstel?.();
        await planWeg();
      }),
    };
  } catch (fout) {
    // Geen half werk: de planning gaat weer weg.
    await draaiTerug([planWeg]); // gooit HalfGelukt als terugdraaien niet lukte
    throw fout;
  }
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
