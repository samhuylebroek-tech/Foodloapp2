/**
 * Ingrediënten en stappen herschikken met omhoog/omlaag (geen slepen nodig). Werkt op de tekst
 * zoals die in het formulier staat: één ingrediënt of stap per regel.
 */

/** Regels die tellen (niet leeg na het weghalen van een nummer als "2." of "3)"). */
export function telbareRegels(tekst: string): string[] {
  return tekst.split("\n").filter((r) => r.replace(/^\s*\d+[.)]\s*/, "").trim().length > 0);
}

/** Kan het element op `index` in die richting? */
export function kanVerplaatsen(aantal: number, index: number, richting: -1 | 1): boolean {
  const doel = index + richting;
  return index >= 0 && index < aantal && doel >= 0 && doel < aantal;
}

/** Wisselt twee elementen; buiten de grenzen verandert er niets. */
export function verplaats<T>(lijst: readonly T[], index: number, richting: -1 | 1): T[] {
  const uit = [...lijst];
  if (!kanVerplaatsen(uit.length, index, richting)) return uit;
  const doel = index + richting;
  [uit[index], uit[doel]] = [uit[doel]!, uit[index]!];
  return uit;
}

/**
 * Zet regel `index` (van de telbare regels) één plaats hoger of lager. Lege regels vallen weg;
 * de tekst van elke regel blijft letterlijk dezelfde.
 */
export function verplaatsRegel(tekst: string, index: number, richting: -1 | 1): string {
  return verplaats(telbareRegels(tekst), index, richting).join("\n");
}

/**
 * Koppelingen per stap (sleutel = stapnummer vanaf 0) wisselen mee als twee stappen van plaats
 * wisselen, zodat "wat gebruik je bij deze stap" bij de juiste stap blijft.
 */
export function wisselSleutels<V>(
  koppeling: Readonly<Record<string, V>>,
  a: number,
  b: number,
): Record<string, V> {
  const uit: Record<string, V> = { ...koppeling };
  const ka = String(a);
  const kb = String(b);
  const va = koppeling[ka];
  const vb = koppeling[kb];
  delete uit[ka];
  delete uit[kb];
  if (vb !== undefined) uit[ka] = vb;
  if (va !== undefined) uit[kb] = va;
  return uit;
}
