/**
 * Databankkant van makers, verzamelingen, community en meldingen. Deze tabellen bestaan in
 * productie pas na migratievoorstel 0008; de schermen controleren dat eerst met
 * `useModuleBeschikbaar` en tonen anders "binnenkort".
 */
import { db } from "@/lib/module-beschikbaar";
import { zichtbareEigenaren } from "@/lib/zichtbare-eigenaren";
import {
  isPubliekZichtbaar,
  MODERATIE_VOORAF,
  type Maker,
  type MeldReden,
  type MeldSoort,
  type Publicatie,
  type Zichtbaarheid,
} from "@/lib/makers";
import { bouwFeed, type FeedItem, type Volg } from "@/lib/makers-feed";

export type ReceptKaart = {
  id: string;
  user_id: string;
  title: string;
  image_url: string | null;
  category: string | null;
  tags: string[] | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
};

const KAART_VELDEN = "id, user_id, title, image_url, category, tags, prep_minutes, cook_minutes";

function gooi(error: unknown) {
  if (error) throw error;
}

// ---------- makers ----------

export async function haalMakers(): Promise<Maker[]> {
  const { data, error } = await db.from("creators").select("*").order("naam").limit(200);
  gooi(error);
  return (data ?? []) as Maker[];
}

export async function haalMakerOpHandle(handle: string): Promise<Maker | null> {
  const { data, error } = await db
    .from("creators")
    .select("*")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  gooi(error);
  return (data as Maker | null) ?? null;
}

export async function haalMijnMaker(userId: string): Promise<Maker | null> {
  const { data, error } = await db.from("creators").select("*").eq("user_id", userId).maybeSingle();
  gooi(error);
  return (data as Maker | null) ?? null;
}

/** Is deze handle al van een andere maker? (De unieke index in de databank blijft de grens.) */
export async function handleBezet(handle: string, behalveId?: string): Promise<boolean> {
  const { data, error } = await db.from("creators").select("id").eq("handle", handle).limit(1);
  gooi(error);
  return (data ?? []).some((r: { id: string }) => r.id !== behalveId);
}

export async function bewaarMaker(
  userId: string,
  velden: Pick<Maker, "handle" | "naam" | "bio" | "specialisaties">,
  bestaandId?: string,
): Promise<Maker> {
  if (bestaandId) {
    const { data, error } = await db
      .from("creators")
      .update(velden)
      .eq("id", bestaandId)
      .eq("user_id", userId)
      .select("*")
      .single();
    gooi(error);
    return data as Maker;
  }
  const { data, error } = await db
    .from("creators")
    .insert({
      ...velden,
      user_id: userId,
      geverifieerd: false,
      omslag_url: null,
      avatar_url: null,
    })
    .select("*")
    .single();
  gooi(error);
  return data as Maker;
}

// ---------- volgen (privé: je ziet alleen je eigen rijen) ----------

export async function haalGevolgd(userId: string): Promise<Set<string>> {
  const { data, error } = await db.from("follows").select("creator_id").eq("follower_id", userId);
  gooi(error);
  return new Set((data ?? []).map((r: { creator_id: string }) => r.creator_id));
}

export async function volg(userId: string, creatorId: string) {
  const { error } = await db.from("follows").upsert(
    // Fase 4: het moment van volgen bepaalt wat "nieuw" is in de meldingen.
    { follower_id: userId, creator_id: creatorId, created_at: new Date().toISOString() },
    { onConflict: "follower_id,creator_id" },
  );
  gooi(error);
}

export async function ontvolg(userId: string, creatorId: string) {
  const { error } = await db
    .from("follows")
    .delete()
    .eq("follower_id", userId)
    .eq("creator_id", creatorId);
  gooi(error);
}

/** Fase 4: wie je volgt, met het moment waarop je begon (voor "nieuw sinds je volgt"). */
export async function haalVolgt(userId: string): Promise<Volg[]> {
  const { data, error } = await db
    .from("follows")
    .select("creator_id, created_at")
    .eq("follower_id", userId)
    .limit(500);
  gooi(error);
  return (data ?? []) as Volg[];
}

/**
 * Fase 4 — feed "Volgend": openbare recepten en collecties van gevolgde makers, nieuwste eerst.
 * Leeg als je niemand volgt. Exclusieve recepten verschijnen als aankondiging (titel en foto);
 * de inhoud blijft achter het abonnement (RLS-voorstel 0021).
 */
export async function haalVolgendFeed(
  userId: string,
): Promise<{ volgt: Volg[]; feed: FeedItem[] }> {
  const volgt = await haalVolgt(userId);
  if (!volgt.length) return { volgt, feed: [] };
  const ids = volgt.map((v) => v.creator_id);
  const { data: makers, error: e1 } = await db.from("creators").select("*").in("id", ids);
  gooi(e1);
  const { data: pubs, error: e2 } = await publiekFilter(
    db.from("recipe_publicaties").select("*").in("creator_id", ids),
  )
    .order("gepubliceerd_op", { ascending: false })
    .limit(60);
  gooi(e2);
  const publicaties = (pubs ?? []) as Publicatie[];
  const lijst = (makers ?? []) as Maker[];
  const [recepten, collecties] = await Promise.all([
    haalRecepten(publicaties.map((p) => p.recipe_id)),
    db
      .from("collections")
      .select("*, collection_recipes(recipe_id)")
      .in(
        "user_id",
        lijst.map((m) => m.user_id),
      )
      .eq("openbaar", true)
      .limit(60),
  ]);
  const feed = bouwFeed({
    gevolgd: new Set(ids),
    makers: lijst,
    publicaties,
    recepten,
    collecties: collecties.error ? [] : ((collecties.data ?? []) as never[]),
  });
  return { volgt, feed };
}

// ---------- publicaties ----------

type Filterbaar = { eq: (k: string, v: string) => Filterbaar };
function publiekFilter<T>(q: T): T {
  const f = q as unknown as Filterbaar;
  const basis = f.eq("zichtbaarheid", "openbaar").eq("status", "gepubliceerd");
  return (MODERATIE_VOORAF ? basis.eq("moderatie", "goedgekeurd") : basis) as unknown as T;
}

export async function haalRecepten(ids: string[]): Promise<ReceptKaart[]> {
  if (!ids.length) return [];
  const { data, error } = await db
    .from("recipes")
    .select(KAART_VELDEN)
    .in("id", ids)
    .is("deleted_at", null);
  gooi(error);
  return (data ?? []) as ReceptKaart[];
}

/** Openbaar gepubliceerde (en goedgekeurde) recepten van een maker, nieuwste eerst. */
export async function haalPubliekeRecepten(
  creatorId: string,
): Promise<{ recept: ReceptKaart; publicatie: Publicatie }[]> {
  const { data, error } = await publiekFilter(
    db.from("recipe_publicaties").select("*").eq("creator_id", creatorId),
  )
    .order("gepubliceerd_op", { ascending: false })
    .limit(100);
  gooi(error);
  const pubs = ((data ?? []) as Publicatie[]).filter((p) => isPubliekZichtbaar(p));
  const recepten = await haalRecepten(pubs.map((p) => p.recipe_id));
  const perId = new Map(recepten.map((r) => [r.id, r]));
  return pubs.flatMap((p) => {
    const recept = perId.get(p.recipe_id);
    return recept ? [{ recept, publicatie: p }] : [];
  });
}

export async function haalMijnPublicaties(creatorId: string): Promise<Publicatie[]> {
  const { data, error } = await db
    .from("recipe_publicaties")
    .select("*")
    .eq("creator_id", creatorId)
    .limit(500);
  gooi(error);
  return (data ?? []) as Publicatie[];
}

export async function zetPublicatie(
  creatorId: string,
  recipeId: string,
  velden: Partial<
    Pick<Publicatie, "zichtbaarheid" | "status" | "gepubliceerd_op" | "video_url" | "moderatie">
  >,
): Promise<Publicatie> {
  // Bijwerken als er al een rij is (anders zou een upsert de andere velden terugzetten).
  const { data: bestaand, error: leesFout } = await db
    .from("recipe_publicaties")
    .select("id")
    .eq("recipe_id", recipeId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  gooi(leesFout);
  if (bestaand) {
    const { data, error } = await db
      .from("recipe_publicaties")
      .update(velden)
      .eq("id", (bestaand as { id: string }).id)
      .select("*")
      .single();
    gooi(error);
    return data as Publicatie;
  }
  const { data, error } = await db
    .from("recipe_publicaties")
    .insert({
      recipe_id: recipeId,
      creator_id: creatorId,
      zichtbaarheid: "prive" as Zichtbaarheid,
      status: "concept",
      gepubliceerd_op: null,
      video_url: null,
      moderatie: null,
      ...velden,
    })
    .select("*")
    .single();
  gooi(error);
  return data as Publicatie;
}

/** Maker en publicatie van een openbaar recept, of `null` (ook als de module nog ontbreekt). */
export async function haalPubliekeBron(
  recipeId: string,
): Promise<{ maker: Maker; publicatie: Publicatie } | null> {
  const bronnen = await haalBronnen([recipeId]);
  return bronnen.get(recipeId) ?? null;
}

/** Bronvermelding voor meerdere recepten tegelijk. Fouten (module ontbreekt) = geen bron. */
export async function haalBronnen(
  recipeIds: string[],
): Promise<Map<string, { maker: Maker; publicatie: Publicatie }>> {
  const uit = new Map<string, { maker: Maker; publicatie: Publicatie }>();
  if (!recipeIds.length) return uit;
  const { data, error } = await publiekFilter(
    db.from("recipe_publicaties").select("*").in("recipe_id", recipeIds),
  );
  if (error || !data?.length) return uit;
  const pubs = (data as Publicatie[]).filter((p) => isPubliekZichtbaar(p));
  const makerIds = [...new Set(pubs.map((p) => p.creator_id))];
  if (!makerIds.length) return uit;
  const { data: makers, error: fout } = await db.from("creators").select("*").in("id", makerIds);
  if (fout) return uit;
  const perId = new Map(((makers ?? []) as Maker[]).map((m) => [m.id, m]));
  for (const p of pubs) {
    const maker = perId.get(p.creator_id);
    if (maker) uit.set(p.recipe_id, { maker, publicatie: p });
  }
  return uit;
}

/** Geaggregeerde cijfers (databankfunctie); `null` als die er niet is. Nooit wie. */
export async function haalMakerStatistiek(
  creatorId: string,
): Promise<{ volgers?: number; bewaard?: number; gepland?: number } | null> {
  const { data, error } = await db.rpc("maker_statistiek", { p_creator: creatorId });
  if (error || !data || typeof data !== "object") return null;
  return data as { volgers?: number; bewaard?: number; gepland?: number };
}

// ---------- meldingen (moderatie: data verzamelen) ----------

export type Melding = {
  id: string;
  melder_id: string;
  soort: MeldSoort;
  doel_id: string;
  reden: MeldReden;
  toelichting: string | null;
  status: "open" | "behandeld" | "afgewezen";
  created_at: string;
};

export async function meld(
  userId: string,
  m: { soort: MeldSoort; doel_id: string; reden: MeldReden; toelichting?: string },
) {
  const { error } = await db.from("content_meldingen").insert({
    melder_id: userId,
    soort: m.soort,
    doel_id: m.doel_id,
    reden: m.reden,
    toelichting: m.toelichting?.trim().slice(0, 500) || null,
    status: "open",
  });
  gooi(error);
}

export async function haalMijnMeldingen(userId: string): Promise<Melding[]> {
  const { data, error } = await db
    .from("content_meldingen")
    .select("*")
    .eq("melder_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  gooi(error);
  return (data ?? []) as Melding[];
}

// ---------- verzamelingen ----------

export type Verzameling = {
  id: string;
  user_id: string;
  naam: string;
  beschrijving: string | null;
  openbaar: boolean;
  created_at?: string;
  collection_recipes?: { id: string; recipe_id: string; positie: number }[];
};

export async function haalVerzamelingenVan(
  userId: string,
  alleenOpenbaar = false,
): Promise<Verzameling[]> {
  let q = db.from("collections").select("*, collection_recipes(*)").eq("user_id", userId);
  if (alleenOpenbaar) q = q.eq("openbaar", true);
  const { data, error } = await q.order("created_at", { ascending: true }).limit(100);
  gooi(error);
  return (data ?? []) as Verzameling[];
}

export async function maakVerzameling(
  userId: string,
  naam: string,
  beschrijving: string | null = null,
): Promise<Verzameling> {
  const { data, error } = await db
    .from("collections")
    .insert({ user_id: userId, naam: naam.trim().slice(0, 60), beschrijving, openbaar: false })
    .select("*")
    .single();
  gooi(error);
  return data as Verzameling;
}

export async function wijzigVerzameling(
  id: string,
  velden: Partial<Pick<Verzameling, "naam" | "beschrijving" | "openbaar">>,
) {
  const { error } = await db.from("collections").update(velden).eq("id", id);
  gooi(error);
}

export async function zetInVerzameling(collectionId: string, recipeId: string, positie: number) {
  const { error } = await db
    .from("collection_recipes")
    .upsert(
      { collection_id: collectionId, recipe_id: recipeId, positie },
      { onConflict: "collection_id,recipe_id" },
    );
  gooi(error);
}

export async function haalUitVerzameling(collectionId: string, recipeId: string) {
  const { error } = await db
    .from("collection_recipes")
    .delete()
    .eq("collection_id", collectionId)
    .eq("recipe_id", recipeId);
  gooi(error);
}

/** Fase 3: nieuwe posities bewaren (na herschikken). */
export async function zetVolgorde(
  collectionId: string,
  rijen: readonly { recipe_id: string; positie: number }[],
) {
  if (!rijen.length) return;
  const { error } = await db.from("collection_recipes").upsert(
    rijen.map((r) => ({ collection_id: collectionId, recipe_id: r.recipe_id, positie: r.positie })),
    { onConflict: "collection_id,recipe_id" },
  );
  gooi(error);
}

export async function haalVerzameling(id: string): Promise<Verzameling | null> {
  const { data, error } = await db
    .from("collections")
    .select("*, collection_recipes(*)")
    .eq("id", id)
    .maybeSingle();
  gooi(error);
  return (data as Verzameling | null) ?? null;
}

/** Verwijdert de verzameling (niet de recepten) en geeft wat nodig is om ze terug te zetten. */
export async function verwijderVerzameling(v: Verzameling): Promise<() => Promise<void>> {
  const rijen = v.collection_recipes ?? [];
  const { error } = await db.from("collections").delete().eq("id", v.id);
  gooi(error);
  // Zoals ON DELETE CASCADE in de databank (de nep-databank kent geen cascade).
  await db.from("collection_recipes").delete().eq("collection_id", v.id);
  return async () => {
    const { collection_recipes: _r, ...kop } = v;
    const { error: e1 } = await db.from("collections").insert(kop);
    gooi(e1);
    if (rijen.length) {
      const { error: e2 } = await db
        .from("collection_recipes")
        .insert(rijen.map((r) => ({ ...r, collection_id: v.id })));
      gooi(e2);
    }
  };
}

/**
 * Recepten in een verzameling die jij mag zien: van jezelf/je gezin/vrienden, of openbaar
 * gepubliceerd. Zo toont een verzameling nooit een recept dat ondertussen privé werd.
 */
export async function zichtbareReceptenIn(v: Verzameling): Promise<ReceptKaart[]> {
  const volgorde = [...(v.collection_recipes ?? [])].sort((a, b) => a.positie - b.positie);
  const ids = volgorde.map((r) => r.recipe_id);
  const [recepten, eigenaren, bronnen] = await Promise.all([
    haalRecepten(ids),
    zichtbareEigenaren(),
    haalBronnen(ids),
  ]);
  const perId = new Map(recepten.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = perId.get(id);
    if (!r) return [];
    return eigenaren.includes(r.user_id) || bronnen.has(id) ? [r] : [];
  });
}

// ---------- community ----------

export type Bijdrage = {
  id: string;
  recipe_id: string;
  user_id: string;
  weergavenaam: string | null;
  tekst: string;
  sterren: number;
  foto_url: string | null;
  verborgen: boolean;
  created_at: string;
};

export async function haalBijdragen(recipeId: string): Promise<Bijdrage[]> {
  const { data, error } = await db
    .from("community_bijdragen")
    .select("*")
    .eq("recipe_id", recipeId)
    .eq("verborgen", false)
    .order("created_at", { ascending: false })
    // Rustige rij, geen eindeloze tijdlijn.
    .limit(12);
  gooi(error);
  return (data ?? []) as Bijdrage[];
}

export async function plaatsBijdrage(
  b: Pick<Bijdrage, "recipe_id" | "user_id" | "weergavenaam" | "tekst" | "sterren">,
): Promise<Bijdrage> {
  const { data, error } = await db
    .from("community_bijdragen")
    .insert({ ...b, tekst: b.tekst.trim(), foto_url: null, verborgen: false })
    .select("*")
    .single();
  gooi(error);
  return data as Bijdrage;
}

export async function verwijderBijdrage(b: Bijdrage): Promise<() => Promise<void>> {
  const { error } = await db
    .from("community_bijdragen")
    .delete()
    .eq("id", b.id)
    .eq("user_id", b.user_id);
  gooi(error);
  return async () => {
    const { error: e } = await db.from("community_bijdragen").insert(b);
    gooi(e);
  };
}
