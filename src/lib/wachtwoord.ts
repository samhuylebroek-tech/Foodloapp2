/** Minimumlengte zoals Supabase die nu afdwingt (instelbaar in de auth-instellingen). */
export const MIN_WACHTWOORD = 6;

/**
 * Controleert een nieuw wachtwoord vóór we het opsturen.
 * Geeft een gewone, korte uitleg terug, of null als alles in orde is.
 * Bewust geen eisen als "1 hoofdletter + 1 symbool": lange zinnen zijn
 * veiliger én makkelijker te onthouden (NIST SP 800-63B).
 */
export function controleerNieuwWachtwoord(wachtwoord: string, herhaal: string): string | null {
  if (wachtwoord.trim().length === 0) return "Vul een nieuw wachtwoord in.";
  if (wachtwoord.length < MIN_WACHTWOORD) {
    return `Je wachtwoord is te kort. Gebruik minstens ${MIN_WACHTWOORD} tekens.`;
  }
  if (wachtwoord !== herhaal) {
    return "De twee wachtwoorden zijn niet gelijk. Typ ze nog eens.";
  }
  return null;
}
