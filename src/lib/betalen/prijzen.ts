/**
 * Fase 6 — ALLE prijsvoorstellen op één plek. /premium, /abonnement, het partnerportaal, de
 * makerinstellingen en het Business Control Center lezen deze waarden; niemand schrijft een
 * bedrag of percentage nog zelf in een scherm.
 *
 * Alles is een VOORSTEL in testmodus: er wordt niets verkocht of aangerekend. Bedragen in eurocent,
 * btw inbegrepen (consumentenprijs). De btw is configureerbaar; België 21 % is het voorbeeld.
 * Echte tarieven per land (OSS) volgen pas na de fiscale review en de keuze van een
 * betaalprovider (docs/foodlo/BETAALPROVIDER-EISEN.md).
 */
/** "€ 4,99" (Belgische notatie). Ook beschikbaar via `./types`. */
export function euro(cent: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(cent / 100);
}

export type BtwInstelling = {
  /** ISO-landcode van het voorbeeld. */
  land: string;
  procent: number;
};

export const PRIJZEN = {
  premium: {
    maandCent: 499,
    /** Twee maanden gratis ten opzichte van maandelijks. */
    jaarCent: 4990,
    proefDagen: 14,
  },
  partner: {
    basisMaandCent: 0,
    plusMaandCent: 4900,
  },
  maker: {
    /** Grenzen voor de prijs die een maker zelf kiest. */
    minCent: 100,
    maxCent: 5000,
    standaardCent: 399,
  },
  /** Deel van Foodlo bij makerabonnementen (na btw en betaalkosten), in procent. */
  platformProcent: 15,
  /** Schatting van de kosten van een betaalprovider per betaling. */
  betaalkosten: { procent: 1.5, vastCent: 25 },
  btw: { land: "BE", procent: 21 } as BtwInstelling,
  /** Zolang een mislukte betaling niet hersteld is, blijft Premium nog zo lang werken. */
  genadeDagen: 7,
  /** Herroepingsrecht voor digitale diensten (voorstel, juridische review volgt). */
  herroepingDagen: 14,
  periodeDagen: { maand: 30, jaar: 365 },
} as const;

/** Btw-deel uit een bedrag inclusief btw. */
export function btwUitInclusief(cent: number, procent: number = PRIJZEN.btw.procent): number {
  const c = Math.max(0, Math.round(cent));
  return Math.round(c - c / (1 + procent / 100));
}

/** "waarvan € 0,87 btw (21 %)"; bij € 0 "geen btw". */
export function btwRegel(cent: number, procent: number = PRIJZEN.btw.procent): string {
  if (cent <= 0) return "geen btw (€ 0,00)";
  return `waarvan ${euro(btwUitInclusief(cent, procent))} btw (${procent.toLocaleString("nl-BE")} %)`;
}

/** "€ 4,99 per maand" / "€ 49,90 per jaar". */
export function prijsPer(cent: number, interval: "maand" | "jaar"): string {
  return `${euro(cent)} per ${interval}`;
}

/** Hoeveel je met een jaar bespaart tegenover twaalf maanden. */
export function jaarBesparingCent(): number {
  return Math.max(0, PRIJZEN.premium.maandCent * 12 - PRIJZEN.premium.jaarCent);
}

/** "€ 1 en € 50": de grenzen voor een makerprijs, zonder ",00". */
export function makerPrijsGrenzen(): string {
  const kort = (c: number) => euro(c).replace(/,00(?=\D*$)/, "");
  return `${kort(PRIJZEN.maker.minCent)} en ${kort(PRIJZEN.maker.maxCent)}`;
}
