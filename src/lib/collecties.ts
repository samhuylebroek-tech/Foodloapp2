/**
 * Fase 3 — verzamelingen beheren: herschikken (pijlknoppen, slepen, toetsenbord) en de link om
 * te delen. Pure functies; de databank-kant staat in `makers-db.ts`.
 */

/** Verplaats het element op `van` naar `naar` (begrensd); de rest schuift op. */
export function herschik<T>(lijst: readonly T[], van: number, naar: number): T[] {
  const uit = [...lijst];
  if (van < 0 || van >= uit.length) return uit;
  const doel = Math.max(0, Math.min(uit.length - 1, naar));
  const [x] = uit.splice(van, 1);
  uit.splice(doel, 0, x as T);
  return uit;
}

/** Posities 0, 1, 2 … in de nieuwe volgorde; alleen wat veranderde. */
export function gewijzigdePosities(
  oud: readonly { recipe_id: string; positie: number }[],
  nieuweVolgorde: readonly string[],
): { recipe_id: string; positie: number }[] {
  const was = new Map(oud.map((r) => [r.recipe_id, r.positie]));
  return nieuweVolgorde
    .map((recipe_id, positie) => ({ recipe_id, positie }))
    .filter((r) => was.get(r.recipe_id) !== r.positie);
}

/** De volgende vrije positie (achteraan). */
export function volgendePositie(rijen: readonly { positie: number }[]): number {
  return rijen.reduce((m, r) => Math.max(m, r.positie + 1), 0);
}

/** Link naar een verzameling. Privé = alleen de eigenaar kan ze openen (RLS). */
export function verzamelingLink(origin: string, id: string): string {
  return `${origin.replace(/\/+$/, "")}/verzamelingen/${id}`;
}
