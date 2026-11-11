import { supabase } from "@/integrations/supabase/client";

/**
 * Tweede verdedigingslaag voor recepten (BUG-105). RLS in de databank blijft de echte grens; dit
 * zorgt dat de app zelf ook nooit recepten van onbekenden toont of exporteert, zelfs als een
 * databankregel ooit te ruim staat (zoals `recipes_select = deleted_at IS NULL`).
 *
 * Wiens recepten mag je zien? Dezelfde regel als `has_share(…, 'recipes_view')`:
 * - jezelf;
 * - vrienden die met jou delen (`shares`: jij bent lid, status `accepted`, recipes_view/edit);
 * - actieve gezinsleden (beide `actief`) met recipes_view/edit.
 */
const BEWAAR_MS = 30_000;
let cache: { userId: string; ids: string[]; tot: number } | null = null;

export function vergeetZichtbareEigenaren() {
  cache = null;
}

/** Zuivere samenvoeging (getest): eigen id eerst, geen dubbels, alleen geldige rechten. */
export function voegEigenarenSamen(
  ik: string,
  deelrechten: {
    owner_id: string | null;
    status: string | null;
    recipes_view: boolean | null;
    recipes_edit: boolean | null;
  }[],
  mijnGezinnen: { group_id: string; status: string | null }[],
  gezinsleden: {
    group_id: string;
    user_id: string;
    status: string | null;
    recipes_view: boolean | null;
    recipes_edit: boolean | null;
  }[],
): string[] {
  const actieveGezinnen = new Set(
    mijnGezinnen.filter((g) => g.status === "actief").map((g) => g.group_id),
  );
  const ids = new Set<string>([ik]);
  for (const d of deelrechten)
    if (d.owner_id && d.status === "accepted" && (d.recipes_view || d.recipes_edit))
      ids.add(d.owner_id);
  for (const l of gezinsleden)
    if (
      actieveGezinnen.has(l.group_id) &&
      l.status === "actief" &&
      (l.recipes_view || l.recipes_edit)
    )
      ids.add(l.user_id);
  return [...ids];
}

/** Id's van wie je de recepten mag zien. Leeg zonder sessie (dan toont de app niets). */
export async function zichtbareEigenaren(): Promise<string[]> {
  const { data } = await supabase.auth.getSession();
  const ik = data.session?.user.id;
  if (!ik) return [];
  if (cache && cache.userId === ik && cache.tot > Date.now()) return cache.ids;

  const [deel, mijn] = await Promise.all([
    supabase
      .from("shares")
      .select("owner_id, status, recipes_view, recipes_edit")
      .eq("member_id", ik)
      .eq("status", "accepted"),
    supabase
      .from("group_members")
      .select("group_id, status")
      .eq("user_id", ik)
      .eq("status", "actief"),
  ]);
  const groepen = (mijn.data ?? []).map((g) => g.group_id);
  const leden = groepen.length
    ? await supabase
        .from("group_members")
        .select("group_id, user_id, status, recipes_view, recipes_edit")
        .in("group_id", groepen)
        .eq("status", "actief")
    : { data: [] };
  const ids = voegEigenarenSamen(ik, deel.data ?? [], mijn.data ?? [], leden.data ?? []);
  cache = { userId: ik, ids, tot: Date.now() + BEWAAR_MS };
  return ids;
}

/** Eigen gebruiker-id uit de lokale sessie (geen netwerk). */
export async function eigenId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
