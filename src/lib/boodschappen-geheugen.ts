import { supabase } from "@/integrations/supabase/client";
import { normaliseerTekst } from "@/lib/zoeken";

export type HistoriekRij = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  gekocht_op: string;
};

export type Vast = { id: string; name: string; quantity: number | null; unit: string };

export type Suggestie = { name: string; unit: string; quantity: number | null; reden: string };

/** Bewaar gekochte items in je geschiedenis vóór ze van de lijst gaan. */
export async function bewaarGekocht(
  userId: string,
  lijst: { id: string; group_id?: string | null },
  items: { name: string; quantity: number | null; unit: string; recipe_id?: string | null }[],
) {
  if (!items.length) return;
  await supabase.from("shopping_history").insert(
    items.map((i) => ({
      user_id: userId,
      list_id: lijst.id,
      group_id: lijst.group_id ?? null,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit ?? "",
      recipe_id: i.recipe_id ?? null,
    })),
  );
}

export async function leesGeschiedenis(userId: string): Promise<HistoriekRij[]> {
  const { data, error } = await supabase
    .from("shopping_history")
    .select("id, name, quantity, unit, gekocht_op")
    .eq("user_id", userId)
    .order("gekocht_op", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as HistoriekRij[];
}

/** Winkelbeurten: items per dag gegroepeerd. */
export function perBeurt(rijen: HistoriekRij[]) {
  const per = new Map<string, HistoriekRij[]>();
  for (const r of rijen) {
    const dag = r.gekocht_op.slice(0, 10);
    const l = per.get(dag) ?? [];
    l.push(r);
    per.set(dag, l);
  }
  return [...per.entries()].map(([dag, lijst]) => ({ dag, lijst }));
}

/** Producten die je het vaakst kocht (op verschillende dagen). */
export function vaakGekocht(rijen: HistoriekRij[]) {
  const per = new Map<string, { name: string; unit: string; quantity: number | null; dagen: Set<string>; laatst: string }>();
  for (const r of rijen) {
    const k = normaliseerTekst(r.name);
    const e = per.get(k) ?? { name: r.name, unit: r.unit, quantity: r.quantity, dagen: new Set(), laatst: r.gekocht_op };
    e.dagen.add(r.gekocht_op.slice(0, 10));
    if (r.gekocht_op > e.laatst) e.laatst = r.gekocht_op;
    per.set(k, e);
  }
  return [...per.values()]
    .map((e) => ({ ...e, keer: e.dagen.size }))
    .sort((a, b) => b.keer - a.keer);
}

/** Eenvoudige, eerlijke voorstellen: vaak gekocht en al even geleden. */
export function maakSuggesties(rijen: HistoriekRij[], opLijst: string[], max = 4): Suggestie[] {
  const op = new Set(opLijst.map(normaliseerTekst));
  const nu = Date.now();
  return vaakGekocht(rijen)
    .filter((e) => e.keer >= 2 && !op.has(normaliseerTekst(e.name)))
    .map((e) => {
      const dagen = Math.floor((nu - new Date(e.laatst).getTime()) / 86400000);
      return { e, dagen };
    })
    .filter(({ dagen }) => dagen >= 3)
    .sort((a, b) => b.e.keer * Math.min(b.dagen, 30) - a.e.keer * Math.min(a.dagen, 30))
    .slice(0, max)
    .map(({ e, dagen }) => ({
      name: e.name,
      unit: e.unit,
      quantity: e.quantity,
      reden: dagen >= 14 ? `${Math.round(dagen / 7)} weken geleden gekocht` : `${e.keer} keer gekocht`,
    }));
}

/* ---------- Offline: toevoegen en afvinken bewaren tot je weer online bent ---------- */

type Actie =
  | { soort: "toevoegen"; userId: string; listId: string; tekst: string }
  | { soort: "vink"; id: string; checked: boolean };

const SLEUTEL = "foodlo-boodschappen-wachtrij";

export function leesWachtrij(): Actie[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SLEUTEL) ?? "[]") as Actie[];
  } catch {
    return [];
  }
}

export function zetInWachtrij(a: Actie) {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify([...leesWachtrij(), a]));
  } catch {
    // niets aan te doen
  }
}

export function leegWachtrij() {
  try {
    localStorage.removeItem(SLEUTEL);
  } catch {
    // ok
  }
}
