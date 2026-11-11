/**
 * Reproduceerbare omzetberekening uit brontransacties (`aankopen`), zie BUSINESS-CONTROL-CENTER-AUDIT.
 * Regels (BUG-099):
 * - alleen betaalde transacties tellen als omzet; terugbetalingen apart;
 * - alleen euro wordt opgeteld. Andere munten worden NIET omgerekend of bijgeteld, maar apart
 *   gemeld (aantal + munten), zodat er nooit appels en peren in één totaal zitten;
 * - bedragen in centen (gehele getallen) optellen, pas op het einde naar euro.
 */
export type Aankoop = {
  user_id: string;
  bedrag_cent: number;
  valuta: string | null;
  status: string;
  created_at: string;
};

const BETAALD = ["betaald", "voltooid", "paid", "completed", "succeeded"];
const TERUG = ["terugbetaald", "refunded"];
const isEuro = (v: string | null) => (v ?? "EUR").toUpperCase() === "EUR";

export function berekenOmzet(aankopen: Aankoop[], sinds: string) {
  const inPeriode = (d: string) => d >= sinds;
  const euro = aankopen.filter((x) => isEuro(x.valuta));
  const anders = aankopen.filter((x) => !isEuro(x.valuta) && inPeriode(x.created_at));
  const betaald = euro.filter((x) => BETAALD.includes(x.status));
  const cent = (xs: Aankoop[]) => xs.reduce((s, x) => s + Math.round(x.bedrag_cent), 0);
  const terug = euro.filter((x) => TERUG.includes(x.status) && inPeriode(x.created_at));
  return {
    omzetEur: cent(betaald.filter((x) => inPeriode(x.created_at))) / 100,
    omzetVorigEur: cent(betaald.filter((x) => !inPeriode(x.created_at))) / 100,
    betalendeKlanten: new Set(betaald.filter((x) => inPeriode(x.created_at)).map((x) => x.user_id))
      .size,
    terugbetaald: { aantal: terug.length, bedragEur: cent(terug) / 100 },
    andereValuta: {
      aantal: anders.length,
      munten: [...new Set(anders.map((x) => String(x.valuta).toUpperCase()))].sort(),
    },
  };
}
