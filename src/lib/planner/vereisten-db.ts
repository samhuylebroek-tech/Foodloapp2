/**
 * Apparatuurvereisten per recept die de eigenaar zelf aanpaste (`recept_vereisten`, voorstel
 * 0013). Zonder rij (of zonder tabel, vóór de migratie) leidt de app ze af uit de tekst.
 */
import { db, isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import { isApparaat, type Apparaat } from "./apparatuur";

export const VEREISTEN_TABEL = "recept_vereisten";

/** Zelf gekozen apparatuur per recept-id; ontbrekende tabel of fout = niets (herkenning telt). */
export async function leesVereisten(ids: readonly string[]): Promise<Record<string, Apparaat[]>> {
  const uit: Record<string, Apparaat[]> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from(VEREISTEN_TABEL)
      .select("recipe_id, apparatuur")
      .in("recipe_id", ids.slice(i, i + 100));
    if (error) return uit;
    for (const r of (data ?? []) as { recipe_id: string; apparatuur: unknown }[])
      uit[r.recipe_id] = Array.isArray(r.apparatuur) ? r.apparatuur.filter(isApparaat) : [];
  }
  return uit;
}

/** `null` = terug naar de herkenning (rij weg). Gooit alleen bij een echte fout. */
export async function bewaarVereisten(
  recipeId: string,
  apparatuur: readonly Apparaat[] | null,
): Promise<"bewaard" | "niet-beschikbaar"> {
  const res =
    apparatuur === null
      ? await db.from(VEREISTEN_TABEL).delete().eq("recipe_id", recipeId)
      : await db.from(VEREISTEN_TABEL).upsert(
          {
            recipe_id: recipeId,
            apparatuur: [...apparatuur],
            bijgewerkt_op: new Date().toISOString(),
          },
          { onConflict: "recipe_id" },
        );
  if (res.error) {
    if (isOntbrekendeTabel(res.error)) return "niet-beschikbaar";
    throw res.error;
  }
  return "bewaard";
}
