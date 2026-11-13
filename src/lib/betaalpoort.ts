/**
 * Betaalpoort (BUG-143). Betalen of credits kopen mag pas aan als er werkelijk een betaalprovider
 * gekoppeld is. Dit wordt op de SERVER gecontroleerd (`adminInstellingZetten`); de schakelaar in het
 * beheercentrum volgt deze regel alleen. Uitzetten mag altijd.
 *
 * Pas `BETAALPROVIDER_GEKOPPELD` op `true` zetten na gate G5 (betalingen activeren) en een
 * juridische beoordeling (docs/foodlo/COMMERCIAL_ROADMAP.md §4).
 */
export const BETAALPROVIDER_GEKOPPELD = false;

/** Instellingen die geld laten stromen of een betaalde levering beloven. */
export const BETAAL_SLEUTELS = ["betalen_actief", "credits_kopen_actief"] as const;

/** `null` = toegestaan; anders de reden waarom de server de wijziging weigert. */
export function betaalInstellingGeweigerd(
  sleutel: string,
  waarde: unknown,
  providerGekoppeld: boolean = BETAALPROVIDER_GEKOPPELD,
): string | null {
  if (!(BETAAL_SLEUTELS as readonly string[]).includes(sleutel)) return null;
  const aan = waarde === true || waarde === "true" || waarde === 1 || waarde === "1";
  if (!aan) return null;
  if (providerGekoppeld) return null;
  return "Betalingen kunnen nog niet aan: er is geen betaalprovider gekoppeld.";
}
