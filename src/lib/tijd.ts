/** Totale tijd van een gerecht. Staat er geen tijd bij, dan tonen we niets. */
export function totaleTijd(prep?: number | null, cook?: number | null): number {
  return (prep ?? 0) + (cook ?? 0);
}

/** "35 min" of null wanneer de tijd onbekend is. */
export function tijdLabel(prep?: number | null, cook?: number | null): string | null {
  const m = totaleTijd(prep, cook);
  return m > 0 ? `${m} min` : null;
}
