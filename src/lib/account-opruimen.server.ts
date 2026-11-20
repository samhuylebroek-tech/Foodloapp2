/**
 * Opruimen bij accountverwijdering (BUG-110 gezinnen, BUG-025 foto's).
 * Draait met de service-sleutel; elke stap werkt alleen op gegevens van `userId` of op gezinnen
 * waarvan `userId` eigenaar is. Zie AVG-AUDIT §9–§10 en de tests in account-opruimen.test.ts.
 */
import { GEGEVENS_REGISTER, type RegisterRegel } from "@/lib/privacy/gegevens-register";
import { isOntbrekendeTabel } from "@/lib/ontbrekende-tabel";

const BUCKET = "recipe-photos";
/** BUG-179: foto's bij community-bijdragen ("Ik heb het gemaakt"), altijd in `{userId}/`. */
const COMMUNITY_BUCKET = "community-fotos";

type Resultaat<T> = PromiseLike<{ data: T | null; error: unknown }>;
type Bouwer = {
  select: (k: string) => Bouwer;
  update: (v: Record<string, unknown>) => Bouwer;
  delete: () => Bouwer;
  eq: (k: string, v: unknown) => Bouwer;
  neq: (k: string, v: unknown) => Bouwer;
  in: (k: string, v: unknown[]) => Bouwer;
  range?: (a: number, b: number) => Bouwer;
  order: (k: string, o?: { ascending: boolean }) => Bouwer;
} & Resultaat<unknown[]>;
type Opslag = {
  list: (map: string, o: { limit: number; offset: number }) => Resultaat<{ name: string }[]>;
  remove: (paden: string[]) => Resultaat<unknown[]>;
};
type Db = { from: (t: string) => Bouwer; storage: { from: (b: string) => Opslag } };

// ---------------- zuivere regels (getest) ----------------

export type Lid = { user_id: string; status: string | null; created_at: string | null };

/** Langst actieve ander lid wordt eigenaar; niemand over → null (gezin wordt gewist). */
export function nieuweEigenaar(leden: Lid[], vertrekker: string): string | null {
  const kandidaten = leden
    .filter((l) => l.user_id !== vertrekker && l.status === "actief")
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  return kandidaten[0]?.user_id ?? null;
}

/** Wat mag weg: eigen paden die door niemand anders (recept, fotorij, inspiratie) gebruikt worden. */
export function fotosTeWissen(eigenPaden: string[], inGebruikDoorAnderen: Set<string>) {
  const wissen = eigenPaden.filter((p) => !inGebruikDoorAnderen.has(p));
  const behouden = eigenPaden.filter((p) => inGebruikDoorAnderen.has(p));
  return { wissen, behouden };
}

// ---------------- stappen met de databank ----------------

export type GezinVerslag = { overgedragen: number; gewist: number };

/** BUG-110: vóór het wissen van het account. Gezinnen gaan naar een ander actief lid of verdwijnen. */
export async function draagGezinnenOver(client: unknown, userId: string): Promise<GezinVerslag> {
  const db = client as Db;
  const verslag: GezinVerslag = { overgedragen: 0, gewist: 0 };
  const { data: gezinnen, error } = await db.from("groups").select("id").eq("owner_id", userId);
  if (error) throw new Error("Gezinnen ophalen lukte niet.");
  for (const g of (gezinnen ?? []) as { id: string }[]) {
    const { data: leden } = await db
      .from("group_members")
      .select("user_id, status, created_at")
      .eq("group_id", g.id);
    const opvolger = nieuweEigenaar((leden ?? []) as Lid[], userId);
    if (opvolger) {
      // Eigenaarsrechten hangen aan groups.owner_id. De gezinslijst staat op naam van de
      // eigenaar en zou anders met diens account verdwijnen (met de items van anderen).
      const a = await db.from("groups").update({ owner_id: opvolger }).eq("id", g.id);
      const b = await db
        .from("shopping_lists")
        .update({ user_id: opvolger })
        .eq("group_id", g.id)
        .eq("user_id", userId);
      if (a.error || b.error) throw new Error("Het gezin overdragen lukte niet.");
      verslag.overgedragen++;
    } else {
      // De gezinslijst en het gezinsweekmenu verwijzen naar het gezin zonder ON DELETE CASCADE
      // (drizzle 0024): eerst die weg, anders weigert de databank het gezin te wissen (fase 8).
      const l = await db.from("shopping_lists").delete().eq("group_id", g.id);
      const m = await db.from("meal_plan").delete().eq("group_id", g.id);
      if (l.error || m.error) throw new Error("Het gezin wissen lukte niet.");
      const c = await db.from("groups").delete().eq("id", g.id);
      if (c.error) throw new Error("Het gezin wissen lukte niet.");
      verslag.gewist++;
    }
  }
  return verslag;
}

export type FotoVerslag = { gewist: number; behouden: number };

/** Alle bestanden in `{userId}/` (gepagineerd). */
async function eigenFotos(db: Db, userId: string): Promise<string[]> {
  const paden: string[] = [];
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(userId, { limit: 1000, offset });
    if (error) throw new Error("Foto's ophalen lukte niet.");
    const r = (data ?? []).filter((o) => o.name && !o.name.endsWith("/"));
    paden.push(...r.map((o) => `${userId}/${o.name}`));
    if (r.length < 1000) break;
  }
  return paden;
}

/** BUG-025: na het wissen van het account. Wist alleen foto's die niemand anders nog gebruikt. */
export async function ruimFotosOp(client: unknown, userId: string): Promise<FotoVerslag> {
  const db = client as Db;
  const paden = await eigenFotos(db, userId);
  if (!paden.length) return { gewist: 0, behouden: 0 };
  const inGebruik = new Set<string>();
  for (let i = 0; i < paden.length; i += 100) {
    const blok = paden.slice(i, i + 100);
    const [recepten, fotos, inspiratie] = await Promise.all([
      db.from("recipes").select("image_url, user_id").in("image_url", blok).neq("user_id", userId),
      db.from("recipe_photos").select("path, recipe_id").in("path", blok),
      db.from("inspiration_recipes").select("image_url").in("image_url", blok),
    ]);
    if (recepten.error || fotos.error || inspiratie.error)
      throw new Error("Nagaan welke foto's nog gebruikt worden lukte niet.");
    for (const r of (recepten.data ?? []) as { image_url: string }[]) inGebruik.add(r.image_url);
    for (const r of (inspiratie.data ?? []) as { image_url: string }[]) inGebruik.add(r.image_url);
    // Een fotorij hoort bij een recept: alleen "in gebruik" als dat recept van iemand anders is.
    const rijen = (fotos.data ?? []) as { path: string; recipe_id: string }[];
    if (rijen.length) {
      const { data: eig } = await db
        .from("recipes")
        .select("id, user_id")
        .in(
          "id",
          rijen.map((r) => r.recipe_id),
        )
        .neq("user_id", userId);
      const vanAnderen = new Set(((eig ?? []) as { id: string }[]).map((r) => r.id));
      for (const r of rijen) if (vanAnderen.has(r.recipe_id)) inGebruik.add(r.path);
    }
  }
  const { wissen, behouden } = fotosTeWissen(paden, inGebruik);
  for (let i = 0; i < wissen.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(wissen.slice(i, i + 100));
    if (error) throw new Error("Foto's wissen lukte niet.");
  }
  return { gewist: wissen.length, behouden: behouden.length };
}

// ---------------- fase 8: alles uit het register, ook nieuwe modules ----------------

/** Fout die betekent dat tabel of kolom (nog) niet bestaat: overslaan, geen mislukking. */
export function bestaatNiet(fout: unknown): boolean {
  if (isOntbrekendeTabel(fout)) return true;
  const f = (fout ?? {}) as { code?: unknown; message?: unknown };
  const code = typeof f.code === "string" ? f.code : "";
  if (code === "42703" || code === "PGRST204") return true;
  return typeof f.message === "string" && /column .* does not exist/i.test(f.message);
}

export type RegisterVerslag = {
  /** Aantal verwerkte regels (tabel + kolom). */
  verwerkt: number;
  /** Regels waarvan de tabel of kolom (nog) niet bestaat, bv. productie vóór een migratie. */
  overgeslagen: string[];
  /** Regels die mislukten (alleen tabel.kolom, nooit gegevens). */
  mislukt: string[];
};

async function ouderIds(db: Db, regel: RegisterRegel, userId: string): Promise<string[] | null> {
  if (!regel.via) return null;
  const ids: string[] = [];
  for (let van = 0; van < 200_000; van += 1000) {
    let q = db.from(regel.via.ouder).select("id").eq(regel.via.ouderKolom, userId).order("id");
    if (q.range) q = q.range(van, van + 999);
    const { data, error } = await q;
    if (error) throw error;
    const rijen = (data ?? []) as { id: string }[];
    ids.push(...rijen.map((r) => String(r.id)));
    if (rijen.length < 1000 || !q.range) break;
  }
  return ids;
}

/**
 * Wist (of anonimiseert) elke rij uit het register die bij `userId` hoort. Draait met de
 * service-sleutel vóór `auth.admin.deleteUser`: zo blijft er ook niets achter in tabellen zonder
 * ON DELETE CASCADE (groups, group_members, usage_events …) of in de nep-databank. Raakt nooit
 * rijen van anderen, behalve wat een CASCADE in de databank ook zou doen (bv. reacties op jouw
 * recept) of anonimiseren (jouw naam weg uit hun gegevens).
 */
export async function ruimRegisterOp(
  client: unknown,
  userId: string,
  register: readonly RegisterRegel[] = GEGEVENS_REGISTER,
): Promise<RegisterVerslag> {
  const db = client as Db;
  const verslag: RegisterVerslag = { verwerkt: 0, overgeslagen: [], mislukt: [] };
  for (const regel of register) {
    const naam = `${regel.tabel}.${regel.kolom}`;
    try {
      const ids = await ouderIds(db, regel, userId);
      const blokken = ids === null ? [null] : [];
      if (ids) for (let i = 0; i < ids.length; i += 100) blokken.push(ids.slice(i, i + 100) as never);
      for (const blok of blokken as (string[] | null)[]) {
        const basis =
          regel.actie === "wissen"
            ? db.from(regel.tabel).delete()
            : db.from(regel.tabel).update({ [regel.kolom]: null });
        const q = blok === null ? basis.eq(regel.kolom, userId) : basis.in(regel.kolom, blok);
        const { error } = await q;
        if (error) throw error;
      }
      verslag.verwerkt++;
    } catch (fout) {
      if (bestaatNiet(fout)) verslag.overgeslagen.push(naam);
      else verslag.mislukt.push(naam);
    }
  }
  return verslag;
}

/** BUG-179: alle eigen community-foto's (die horen bij jouw bijdragen, die ook weg zijn). */
export async function ruimCommunityFotosOp(client: unknown, userId: string): Promise<number> {
  const db = client as Db;
  const paden: string[] = [];
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const { data, error } = await db.storage
      .from(COMMUNITY_BUCKET)
      .list(userId, { limit: 1000, offset });
    if (error) {
      // Map of bucket bestaat (nog) niet (voorstel 0021 niet uitgevoerd): niets te wissen.
      return 0;
    }
    const r = (data ?? []).filter((o) => o.name && !o.name.endsWith("/"));
    paden.push(...r.map((o) => `${userId}/${o.name}`));
    if (r.length < 1000) break;
  }
  for (let i = 0; i < paden.length; i += 100) {
    const { error } = await db.storage.from(COMMUNITY_BUCKET).remove(paden.slice(i, i + 100));
    if (error) throw new Error("Community-foto's wissen lukte niet.");
  }
  return paden.length;
}

// ---------------- voorbeeld vóór het verwijderen (gezinseigenaar) ----------------

export type GezinGevolg = { naam: string; opvolger: string | null };

/** Wat er met elk gezin gebeurt waarvan je eigenaar bent: naar wie, of opgeheven. */
export async function gezinGevolgen(client: unknown, userId: string): Promise<GezinGevolg[]> {
  const db = client as Db;
  const { data: gezinnen, error } = await db
    .from("groups")
    .select("id, naam")
    .eq("owner_id", userId);
  if (error) throw new Error("Gezinnen ophalen lukte niet.");
  const uit: GezinGevolg[] = [];
  for (const g of (gezinnen ?? []) as { id: string; naam: string | null }[]) {
    const { data: leden } = await db
      .from("group_members")
      .select("user_id, status, created_at")
      .eq("group_id", g.id);
    const opvolger = nieuweEigenaar((leden ?? []) as Lid[], userId);
    let naam: string | null = null;
    if (opvolger) {
      const { data: p } = await db.from("profiles").select("id, display_name").eq("id", opvolger);
      naam = String(((p ?? []) as { display_name?: string | null }[])[0]?.display_name ?? "") || "een ander gezinslid";
    }
    uit.push({ naam: g.naam || "Mijn gezin", opvolger: naam });
  }
  return uit;
}
