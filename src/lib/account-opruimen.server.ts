/**
 * Opruimen bij accountverwijdering (BUG-110 gezinnen, BUG-025 foto's).
 * Draait met de service-sleutel; elke stap werkt alleen op gegevens van `userId` of op gezinnen
 * waarvan `userId` eigenaar is. Zie AVG-AUDIT §9–§10 en de tests in account-opruimen.test.ts.
 */
const BUCKET = "recipe-photos";

type Resultaat<T> = PromiseLike<{ data: T | null; error: unknown }>;
type Bouwer = {
  select: (k: string) => Bouwer;
  update: (v: Record<string, unknown>) => Bouwer;
  delete: () => Bouwer;
  eq: (k: string, v: unknown) => Bouwer;
  neq: (k: string, v: unknown) => Bouwer;
  in: (k: string, v: unknown[]) => Bouwer;
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
