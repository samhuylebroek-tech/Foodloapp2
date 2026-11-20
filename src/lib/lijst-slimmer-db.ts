/**
 * Fase 7 — "Maak mijn lijst slimmer" uitvoeren op de bestaande tabel `shopping_items` (geen
 * nieuwe tabel, werkt in productie zoals in de demo) en precies één keer terugdraaien.
 * De winkelvolgorde blijft per toestel (winkelvolgorde.ts), zoals vandaag.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CategorieId } from "@/lib/categorie";
import { herstelStappen, stappenVoor, type SlimVerschil } from "@/lib/lijst-slimmer";
import { bewaarVolgorde } from "@/lib/winkelvolgorde";
import { zelfdeProduct } from "@/lib/product-herkenning";

export async function voerSlimUit(
  userId: string,
  listId: string,
  gekozen: readonly SlimVerschil[],
  vorigeVolgorde: readonly CategorieId[],
): Promise<() => Promise<void>> {
  const s = stappenVoor(gekozen);
  const h = herstelStappen(gekozen, vorigeVolgorde);
  const start = new Date(Date.now() - 2000).toISOString();
  // Wat al gebeurd is, zodat een half gelukte poging precies dat terugdraait.
  const klaar = { bijgewerkt: 0, weg: false, erbij: false, volgorde: false };

  const herstel = async (
    tot = { bijgewerkt: Infinity, weg: true, erbij: true, volgorde: true },
  ) => {
    // Toegevoegd door dit voorstel: alleen die rijen weer weg (nooit iets dat intussen bijkwam).
    if (tot.erbij && h.toegevoegd.length) {
      const { data } = await supabase
        .from("shopping_items")
        .select("id, name")
        .eq("list_id", listId)
        .gte("created_at", start);
      const weg = (data ?? [])
        .filter((r) => h.toegevoegd.some((n) => zelfdeProduct(String(r.name), n)))
        .map((r) => r.id as string);
      if (weg.length) await supabase.from("shopping_items").delete().in("id", weg);
    }
    for (const t of h.terugzetten.slice(0, tot.bijgewerkt)) {
      const { error } = await supabase.from("shopping_items").update(t.velden).eq("id", t.id);
      if (error) throw error;
    }
    if (tot.weg && h.opnieuw.length) {
      const { error } = await supabase.from("shopping_items").insert(
        h.opnieuw.map((r) => ({
          user_id: userId,
          list_id: listId,
          name: r.name,
          quantity: r.quantity,
          unit: r.unit,
          checked: r.checked,
          recipe_id: r.recipe_id ?? null,
          note: r.note ?? null,
        })),
      );
      if (error) throw error;
    }
    if (tot.volgorde && h.volgorde) bewaarVolgorde(h.volgorde);
  };

  try {
    for (const b of s.bijwerken) {
      const { error } = await supabase.from("shopping_items").update(b.velden).eq("id", b.id);
      if (error) throw error;
      klaar.bijgewerkt += 1;
    }
    if (s.weghalen.length) {
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .in(
          "id",
          s.weghalen.map((r) => r.id),
        );
      if (error) throw error;
      klaar.weg = true;
    }
    if (s.toevoegen.length) {
      const { error } = await supabase.from("shopping_items").insert(
        s.toevoegen.map((t) => ({
          user_id: userId,
          list_id: listId,
          name: t.name,
          quantity: t.quantity,
          unit: t.unit,
          checked: false,
        })),
      );
      if (error) throw error;
      klaar.erbij = true;
    }
    if (s.volgorde) {
      bewaarVolgorde(s.volgorde);
      klaar.volgorde = true;
    }
  } catch (fout) {
    // Half gelukt: wat al gebeurde, meteen terugdraaien. Nooit een halve lijst achterlaten.
    await herstel({ ...klaar }).catch(() => undefined);
    throw fout;
  }
  let teruggezet = false;
  return async () => {
    if (teruggezet) return;
    teruggezet = true;
    await herstel();
  };
}
