/**
 * Verdeling van een makerabonnement (voorbereidend, geen echte uitbetaling). Alles in eurocent en
 * altijd afgerond zodat platform + betaalkosten + makerdeel exact de prijs zijn.
 * Btw: de prijs is inclusief btw; de btw-afdracht (OSS, per land) hangt af van de gekozen
 * provider en wordt pas na de fiscale review berekend. Daarom staat ze hier apart als voorstel.
 */
export type FeeInstelling = {
  /** Platformfee in procent van het bedrag na btw (voorstel). */
  platformProcent: number;
  /** Betaalkosten van de provider: procent + vast bedrag per betaling (schatting). */
  betaalProcent: number;
  betaalVastCent: number;
  /** Btw-tarief in procent (België: 21 voor digitale diensten). */
  btwProcent: number;
};

export const FEE_VOORSTEL: FeeInstelling = {
  platformProcent: 15,
  betaalProcent: 1.5,
  betaalVastCent: 25,
  btwProcent: 21,
};

export type Verdeling = {
  prijsCent: number;
  btwCent: number;
  betaalkostenCent: number;
  platformCent: number;
  makerCent: number;
};

export function verdeelOpbrengst(prijsCent: number, f: FeeInstelling = FEE_VOORSTEL): Verdeling {
  const prijs = Math.max(0, Math.round(prijsCent));
  if (prijs === 0)
    return { prijsCent: 0, btwCent: 0, betaalkostenCent: 0, platformCent: 0, makerCent: 0 };
  const btw = Math.round(prijs - prijs / (1 + f.btwProcent / 100));
  const netto = prijs - btw;
  const betaal = Math.min(netto, Math.round((prijs * f.betaalProcent) / 100 + f.betaalVastCent));
  const platform = Math.min(netto - betaal, Math.round((netto * f.platformProcent) / 100));
  const maker = netto - betaal - platform;
  return {
    prijsCent: prijs,
    btwCent: btw,
    betaalkostenCent: betaal,
    platformCent: platform,
    makerCent: maker,
  };
}

/** Invoer "4,99" of "4.99" → 499; ongeldig of buiten 1–50 euro → null. */
export function leesPrijs(invoer: string): number | null {
  const t = invoer.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cent = Math.round(Number(t) * 100);
  return cent >= 100 && cent <= 5000 ? cent : null;
}
