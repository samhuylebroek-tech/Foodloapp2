/**
 * Databankkant van het partnerportaal en de gesponsorde plek in Ontdek. De tabellen bestaan in
 * productie pas na migratievoorstel 0011; de schermen controleren dat met `useModuleBeschikbaar`.
 * RLS (0011) laat partnerleden alleen de rijen van hun eigen organisatie zien en bewerken.
 */
import { db } from "@/lib/module-beschikbaar";
import type {
  Campagne,
  Dagtotaal,
  GesponsordItem,
  Partner,
  PartnerLid,
  PartnerProduct,
  PartnerRol,
} from "@/lib/partners";

function gooi(error: unknown) {
  if (error) throw error;
}

export type Lidmaatschap = { lid: PartnerLid; partner: Partner };

/** Alle organisaties waarvan deze gebruiker lid is (meestal één). */
export async function haalMijnLidmaatschappen(userId: string): Promise<Lidmaatschap[]> {
  const { data, error } = await db.from("partner_leden").select("*").eq("user_id", userId);
  gooi(error);
  const leden = (data ?? []) as PartnerLid[];
  if (!leden.length) return [];
  const { data: partners, error: fout } = await db
    .from("partners")
    .select("*")
    .in(
      "id",
      leden.map((l) => l.partner_id),
    );
  gooi(fout);
  const perId = new Map(((partners ?? []) as Partner[]).map((p) => [p.id, p]));
  return leden.flatMap((lid) => {
    const partner = perId.get(lid.partner_id);
    return partner ? [{ lid, partner }] : [];
  });
}

export async function bewaarPartner(
  id: string,
  velden: Pick<Partner, "naam" | "soort" | "website" | "logo_url"> & {
    omschrijving: string | null;
  },
): Promise<Partner> {
  const { data, error } = await db
    .from("partners")
    .update(velden)
    .eq("id", id)
    .select("*")
    .single();
  gooi(error);
  return data as Partner;
}

// ---------- aanvragen ----------

export type Aanvraag = {
  id: string;
  user_id: string;
  bedrijfsnaam: string;
  soort: string;
  website: string | null;
  bericht: string | null;
  status: "nieuw" | "in_behandeling" | "goedgekeurd" | "geweigerd";
  created_at?: string;
  /** Fase 5 (voorstel 0022): uitleg van het Foodlo-team bij afwijzen. */
  beoordeling_reden?: string | null;
};

export async function haalMijnAanvraag(userId: string): Promise<Aanvraag | null> {
  const { data, error } = await db
    .from("partner_aanvragen")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  gooi(error);
  return ((data ?? [])[0] as Aanvraag | undefined) ?? null;
}

export async function dienAanvraagIn(
  a: Pick<Aanvraag, "user_id" | "bedrijfsnaam" | "soort" | "website" | "bericht">,
): Promise<void> {
  const { error } = await db.from("partner_aanvragen").insert({ ...a, status: "nieuw" });
  gooi(error);
}

// ---------- producten ----------

export async function haalProducten(partnerId: string): Promise<PartnerProduct[]> {
  const { data, error } = await db
    .from("partner_producten")
    .select("*")
    .eq("partner_id", partnerId)
    .order("naam");
  gooi(error);
  return (data ?? []) as PartnerProduct[];
}

export async function bewaarProduct(
  p: Omit<PartnerProduct, "id"> & { id?: string },
): Promise<PartnerProduct> {
  const velden = {
    partner_id: p.partner_id,
    naam: p.naam.trim(),
    ingredient_koppeling: p.ingredient_koppeling.trim().toLowerCase(),
    ean: p.ean?.trim() || null,
  };
  const q = p.id
    ? db.from("partner_producten").update(velden).eq("id", p.id).eq("partner_id", p.partner_id)
    : db.from("partner_producten").insert(velden);
  const { data, error } = await q.select("*").single();
  gooi(error);
  return data as PartnerProduct;
}

export async function verwijderProduct(p: PartnerProduct): Promise<() => Promise<void>> {
  const { error } = await db
    .from("partner_producten")
    .delete()
    .eq("id", p.id)
    .eq("partner_id", p.partner_id);
  gooi(error);
  return async () => {
    const { error: e } = await db.from("partner_producten").insert(p);
    gooi(e);
  };
}

// ---------- campagnes en gesponsorde items ----------

export async function haalCampagnes(partnerId: string): Promise<Campagne[]> {
  const { data, error } = await db
    .from("campagnes")
    .select("*")
    .eq("partner_id", partnerId)
    .order("start", { ascending: false });
  gooi(error);
  return (data ?? []) as Campagne[];
}

export async function bewaarCampagne(
  c: Pick<Campagne, "partner_id" | "naam" | "start" | "einde" | "doel"> & {
    id?: string;
    testbudget_cent?: number | undefined;
  },
): Promise<Campagne> {
  const velden = {
    partner_id: c.partner_id,
    naam: c.naam.trim(),
    start: c.start || null,
    einde: c.einde || null,
    doel: c.doel?.trim() || null,
    // Kolom uit voorstel 0022: alleen meesturen als het scherm een waarde geeft (undefined = niet
    // aanraken), zodat bewaren zonder budget ook werkt waar 0022 (nog) niet is uitgevoerd.
    ...(c.testbudget_cent !== undefined ? { testbudget_cent: c.testbudget_cent } : {}),
  };
  const q = c.id
    ? db
        .from("campagnes")
        .update(velden)
        .eq("id", c.id)
        .eq("partner_id", c.partner_id)
        .eq("status", "concept")
    : db.from("campagnes").insert({ ...velden, status: "concept" });
  const { data, error } = await q.select("*").single();
  gooi(error);
  return data as Campagne;
}

/** Concept → ingediend. Goedkeuren gebeurt alleen door het Foodlo-team (/beheer/moderatie). */
export async function dienCampagneIn(c: Campagne): Promise<void> {
  const { error } = await db
    .from("campagnes")
    .update({ status: "ingediend", beoordeling_reden: null })
    .eq("id", c.id)
    .eq("partner_id", c.partner_id)
    .eq("status", "concept");
  gooi(error);
}

export async function haalItems(campagneIds: string[]): Promise<GesponsordItem[]> {
  if (!campagneIds.length) return [];
  const { data, error } = await db
    .from("gesponsorde_items")
    .select("*")
    .in("campagne_id", campagneIds);
  gooi(error);
  return (data ?? []) as GesponsordItem[];
}

export async function koppelItem(
  i: Pick<GesponsordItem, "campagne_id" | "soort" | "recipe_id" | "product_naam">,
): Promise<void> {
  const { error } = await db.from("gesponsorde_items").insert({ ...i, label_tekst: "Gesponsord" });
  gooi(error);
}

export async function ontkoppelItem(id: string): Promise<void> {
  const { error } = await db.from("gesponsorde_items").delete().eq("id", id);
  gooi(error);
}

/** Openbare, goedgekeurde recepten die een partner kan sponsoren (bv. van een maker). */
export async function haalSponsorbareRecepten(): Promise<{ id: string; title: string }[]> {
  const { data, error } = await db
    .from("recipe_publicaties")
    .select("recipe_id")
    .eq("zichtbaarheid", "openbaar")
    .eq("status", "gepubliceerd")
    .eq("moderatie", "goedgekeurd")
    .limit(200);
  if (error || !data?.length) return [];
  const ids = (data as { recipe_id: string }[]).map((p) => p.recipe_id);
  const { data: rec } = await db
    .from("recipes")
    .select("id, title")
    .in("id", ids)
    .is("deleted_at", null);
  return ((rec ?? []) as { id: string; title: string }[]).sort((a, b) =>
    a.title.localeCompare(b.title, "nl"),
  );
}

// ---------- samenwerkingen, rapportage en team ----------

export type Samenwerking = {
  id: string;
  partner_id: string;
  creator_id: string;
  status: "voorstel" | "lopend" | "afgerond";
  omschrijving: string | null;
};

export async function haalSamenwerkingen(
  partnerId: string,
): Promise<(Samenwerking & { maker: string; handle: string | null })[]> {
  const { data, error } = await db.from("samenwerkingen").select("*").eq("partner_id", partnerId);
  gooi(error);
  const rijen = (data ?? []) as Samenwerking[];
  if (!rijen.length) return [];
  const { data: makers } = await db
    .from("creators")
    .select("id, naam, handle")
    .in(
      "id",
      rijen.map((r) => r.creator_id),
    );
  const perId = new Map(
    ((makers ?? []) as { id: string; naam: string; handle: string }[]).map((m) => [m.id, m]),
  );
  return rijen.map((r) => ({
    ...r,
    maker: perId.get(r.creator_id)?.naam ?? "Maker",
    handle: perId.get(r.creator_id)?.handle ?? null,
  }));
}

/** Alleen dagtotalen per campagne; de tabel bevat geen enkele gebruikers-id. */
export async function haalDagtotalen(campagneIds: string[]): Promise<Dagtotaal[]> {
  if (!campagneIds.length) return [];
  const { data, error } = await db
    .from("gesponsord_statistiek")
    .select("campagne_id, dag, vertoningen, klikken")
    .in("campagne_id", campagneIds)
    .order("dag");
  gooi(error);
  return (data ?? []) as Dagtotaal[];
}

export async function haalTeam(partnerId: string): Promise<(PartnerLid & { naam: string })[]> {
  const { data, error } = await db.from("partner_leden").select("*").eq("partner_id", partnerId);
  gooi(error);
  const leden = (data ?? []) as PartnerLid[];
  const { data: profielen } = leden.length
    ? await db
        .from("profiles")
        .select("id, display_name")
        .in(
          "id",
          leden.map((l) => l.user_id),
        )
    : { data: [] };
  const naam = new Map(
    ((profielen ?? []) as { id: string; display_name: string | null }[]).map((p) => [
      p.id,
      p.display_name,
    ]),
  );
  return leden.map((l) => ({ ...l, naam: naam.get(l.user_id) ?? "Teamlid" }));
}

export async function zetRol(lid: PartnerLid, rol: PartnerRol): Promise<void> {
  const { error } = await db
    .from("partner_leden")
    .update({ rol })
    .eq("id", lid.id)
    .eq("partner_id", lid.partner_id);
  gooi(error);
}

export async function verwijderLid(lid: PartnerLid): Promise<void> {
  const { error } = await db
    .from("partner_leden")
    .delete()
    .eq("id", lid.id)
    .eq("partner_id", lid.partner_id);
  gooi(error);
}

// ---------- consumentenkant: de ene gesponsorde plek ----------

export type GesponsordeInhoud = {
  item: GesponsordItem;
  partner: Pick<Partner, "id" | "naam">;
  recept: {
    id: string;
    title: string;
    image_url: string | null;
    category: string | null;
    tags: string[];
    ingredienten: string[];
  } | null;
};

/** Lopende (goedgekeurde/actieve) campagnes met hun items, voor de plek in Ontdek. */
export async function haalLopendeCampagnes(): Promise<{
  campagnes: Campagne[];
  items: GesponsordItem[];
}> {
  const { data, error } = await db
    .from("campagnes")
    .select("*")
    .in("status", ["goedgekeurd", "actief"])
    .limit(50);
  gooi(error);
  const campagnes = (data ?? []) as Campagne[];
  const items = await haalItems(campagnes.map((c) => c.id));
  return { campagnes, items };
}

export async function haalGesponsordeInhoud(
  item: GesponsordItem,
  campagne: Campagne,
): Promise<GesponsordeInhoud | null> {
  const { data: partner } = await db
    .from("partners")
    .select("id, naam")
    .eq("id", campagne.partner_id)
    .maybeSingle();
  if (!partner) return null;
  if (item.soort !== "recept" || !item.recipe_id) {
    return { item, partner: partner as GesponsordeInhoud["partner"], recept: null };
  }
  const [{ data: rec }, { data: ingr }] = await Promise.all([
    db
      .from("recipes")
      .select("id, title, image_url, category, tags")
      .eq("id", item.recipe_id)
      .is("deleted_at", null)
      .maybeSingle(),
    db.from("recipe_ingredients").select("name").eq("recipe_id", item.recipe_id),
  ]);
  // Niet leesbaar (privé of verwijderd): dan geen plek, nooit een lege kaart.
  if (!rec) return null;
  const r = rec as {
    id: string;
    title: string;
    image_url: string | null;
    category: string | null;
    tags: string[] | null;
  };
  return {
    item,
    partner: partner as GesponsordeInhoud["partner"],
    recept: {
      ...r,
      tags: r.tags ?? [],
      ingredienten: ((ingr ?? []) as { name: string }[]).map((i) => i.name),
    },
  };
}

/**
 * Telt een vertoning of klik van de gesponsorde plek (public.gesponsord_tel, voorstel 0011): +1 op
 * het dagtotaal van een lopende campagne, er wordt niets over de gebruiker bewaard. Een fout (bv.
 * de functie bestaat nog niet) mag de plek nooit breken: dan wordt er gewoon niet geteld.
 */
export async function telGesponsord(itemId: string, soort: "vertoning" | "klik"): Promise<void> {
  try {
    await db.rpc("gesponsord_tel", { _item: itemId, _soort: soort });
  } catch {
    /* tellen is nooit belangrijker dan tonen */
  }
}
