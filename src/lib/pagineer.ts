/**
 * PostgREST (Supabase) geeft standaard maximaal 1000 rijen per verzoek, ook als je `.limit(50000)`
 * vraagt. Wie totalen berekent (omzet, kosten, credits) moet dus in stukken ophalen, anders kloppen
 * de cijfers stil niet meer zodra er meer dan 1000 rijen zijn (BUG-093).
 */
export async function pagineer<T = unknown>(
  bouw: (van: number, tot: number) => PromiseLike<{ data: unknown; error?: unknown }>,
  max = 200_000,
): Promise<{ data: T[]; afgekapt: boolean }> {
  const stap = 1000;
  const uit: T[] = [];
  for (let a = 0; a < max; a += stap) {
    const { data, error } = await bouw(a, Math.min(a + stap, max) - 1);
    if (error) throw new Error("Gegevens ophalen lukte niet.");
    const r = (data ?? []) as T[];
    uit.push(...r);
    if (r.length < stap) return { data: uit, afgekapt: false };
  }
  return { data: uit, afgekapt: true };
}
