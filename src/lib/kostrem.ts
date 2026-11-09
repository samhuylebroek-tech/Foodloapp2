/**
 * Kostenrem — goedkope bescherming tegen onverwachte AI-kosten, zonder databank of extra dienst.
 *
 * - `Venster`: hoeveel oproepen per sleutel (bv. IP of gebruiker) binnen een tijdvenster.
 * - `KleineCache`: begrensde cache (oudste eruit), zodat dezelfde tekst niet opnieuw betaald wordt.
 *
 * Werkt per serverinstantie (in het geheugen). Dat is een vangnet, geen boekhouding: de echte
 * meting en de credits per gebruiker zitten in `credits.server.ts` en `ai_usage`.
 */

export class Venster {
  private readonly per = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly ms: number,
    private readonly nu: () => number = Date.now,
  ) {}

  /** Mag deze sleutel nog? Zo ja, dan telt de oproep meteen mee. */
  neem(sleutel: string): boolean {
    const t = this.nu();
    const grens = t - this.ms;
    const lijst = (this.per.get(sleutel) ?? []).filter((x) => x > grens);
    if (lijst.length >= this.max) {
      this.per.set(sleutel, lijst);
      return false;
    }
    lijst.push(t);
    this.per.set(sleutel, lijst);
    // Opruimen, zodat de kaart zelf niet onbeperkt groeit.
    if (this.per.size > 5000) {
      for (const [k, v] of this.per) if (!v.some((x) => x > grens)) this.per.delete(k);
    }
    return true;
  }

  /** Hoeveel oproepen er nog over zijn voor deze sleutel. */
  rest(sleutel: string): number {
    const grens = this.nu() - this.ms;
    return Math.max(0, this.max - (this.per.get(sleutel) ?? []).filter((x) => x > grens).length);
  }
}

export class KleineCache<V> {
  private readonly kaart = new Map<string, V>();
  constructor(private readonly max: number) {}

  get(k: string): V | undefined {
    const v = this.kaart.get(k);
    if (v !== undefined) {
      // Recent gebruikt: achteraan zetten.
      this.kaart.delete(k);
      this.kaart.set(k, v);
    }
    return v;
  }

  set(k: string, v: V) {
    this.kaart.delete(k);
    this.kaart.set(k, v);
    while (this.kaart.size > this.max) {
      const oudste = this.kaart.keys().next().value;
      if (oudste === undefined) break;
      this.kaart.delete(oudste);
    }
  }

  get grootte() {
    return this.kaart.size;
  }
}

/** Grenzen voor vertalen (interfaceteksten en recepten). Bewust ruim voor normaal gebruik. */
export const VERTAAL_GRENZEN = {
  /** Oproepen per bezoeker per 10 minuten (de app bundelt tot 60 teksten per oproep). */
  perBezoeker: 40,
  /** Oproepen per serverinstantie per uur: noodrem als iets doorslaat. */
  perUur: 1500,
  /** Vertaalde teksten in de gedeelde cache. */
  cache: 20_000,
} as const;
