/** Totale tijd van een gerecht. Staat er geen tijd bij, dan tonen we niets. */
export function totaleTijd(prep?: number | null, cook?: number | null): number {
  return (prep ?? 0) + (cook ?? 0);
}

/** "35 min" of null wanneer de tijd onbekend is. */
export function tijdLabel(prep?: number | null, cook?: number | null): string | null {
  const m = totaleTijd(prep, cook);
  return m > 0 ? `${m} min` : null;
}

/**
 * Datum als "JJJJ-MM-DD" in de LOKALE tijd van het toestel.
 * Niet `toISOString().slice(0, 10)`: dat is UTC, en geeft in België tussen
 * middernacht en 1 à 2 u 's nachts de datum van gisteren.
 */
export function lokaleDatum(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
