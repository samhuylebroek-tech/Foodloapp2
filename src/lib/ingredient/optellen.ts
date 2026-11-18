/**
 * Dezelfde ingrediënten over recepten optellen: "1 ui" + "ajuin, 2 stuks" + "240 g uien"
 * worden één regel. Synoniemen vallen samen via de canonieke naam; eenheden worden
 * omgerekend binnen gewicht of volume, en stuks ↔ gram alleen met een gekend stukgewicht.
 * Wat niet om te rekenen valt, blijft als aparte deelregel staan (nooit gokken).
 */
import { canoniekeNaam } from "@/lib/product-herkenning";
import { familieVan, inFamilie, naarBasis, type Maat } from "./eenheden";

export type IngredientRegel = { name: string; quantity: number | null; unit: string | null };

export type Opgeteld = {
  /** Canonieke sleutel. */
  sleutel: string;
  /** Eerste naam zoals ze in een recept stond. */
  naam: string;
  /** Opgetelde maten per familie (meestal één). */
  maten: Maat[];
  /** Er was minstens één regel zonder hoeveelheid ("peper naar smaak"). */
  zonderHoeveelheid: boolean;
};

/** Optellen per product. Volgorde: zoals de producten voor het eerst voorkomen. */
export function telIngredientenOp(regels: readonly IngredientRegel[]): Opgeteld[] {
  const per = new Map<string, Opgeteld>();
  for (const r of regels) {
    const naam = r.name.trim();
    if (!naam) continue;
    const sleutel = canoniekeNaam(naam) || naam.toLowerCase();
    let o = per.get(sleutel);
    if (!o) {
      o = { sleutel, naam, maten: [], zonderHoeveelheid: false };
      per.set(sleutel, o);
    }
    const maat = naarBasis(r.quantity, r.unit);
    if (!maat) {
      o.zonderHoeveelheid = true;
      continue;
    }
    voegMaatToe(o.maten, maat, naam);
  }
  return [...per.values()];
}

/**
 * Een maat toevoegen aan een lijst maten: zelfde familie optellen; stuks en gram samen als het
 * stukgewicht gekend is (dan in gram); anders als aparte familie bewaren.
 */
export function voegMaatToe(maten: Maat[], maat: Maat, naam: string): void {
  const zelfde = maten.find((m) => m.familie === maat.familie);
  if (zelfde) {
    zelfde.waarde += maat.waarde;
    return;
  }
  if (maat.familie === "stuk" || maat.familie === "g") {
    const ander = maten.find((m) => m.familie === (maat.familie === "stuk" ? "g" : "stuk"));
    if (ander) {
      const inGram = (m: Maat) => (m.familie === "g" ? m : inFamilie(m, "g", naam));
      const a = inGram(ander);
      const b = inGram(maat);
      if (a && b) {
        ander.familie = "g";
        ander.waarde = a.waarde + b.waarde;
        return;
      }
    }
  }
  maten.push({ ...maat });
}

/** De familie waarin twee eenheden samen kunnen, of null. */
export function gemeenschappelijkeFamilie(
  a: string | null,
  b: string | null,
  naam: string,
): string | null {
  const fa = familieVan(a);
  const fb = familieVan(b);
  if (fa === fb) return fa;
  if (inFamilie({ familie: fa, waarde: 1 }, fb, naam)) return fb;
  return null;
}
