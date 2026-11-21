/**
 * BUG-152: voor gezinsleden waarvan je de gegevens niet mag lezen, controleert de server
 * (`maaltijd_veilig_voor`) elk gekozen gerecht vóór het bewaren, niet alleen het getoonde.
 * Pure functie met een meegegeven oordeel, zodat ze zonder databank te testen is.
 */
export type ServerOordeel = (recipeId: string, lidIds: string[]) => Promise<Map<string, boolean>>;

/**
 * Welke gerechten zijn volgens de server niet veilig voor minstens één mee-eter? Een gerecht
 * waarvoor de server niets zegt (geen ingrediënten) geldt als niet te controleren: geen blokkade,
 * zoals op het toestel. Een fout bij de controle = niet bewaren (gooit door).
 */
export async function onveiligeGerechten(
  receptIds: readonly string[],
  nietLeesbaar: readonly string[],
  oordeel: ServerOordeel,
): Promise<Set<string>> {
  const uit = new Set<string>();
  if (!nietLeesbaar.length) return uit;
  const uniek = [...new Set(receptIds)];
  const paren = await Promise.all(
    uniek.map(async (id) => [id, await oordeel(id, [...nietLeesbaar])] as const),
  );
  for (const [id, m] of paren) if ([...m.values()].some((v) => v === false)) uit.add(id);
  return uit;
}
