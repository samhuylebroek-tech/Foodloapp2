/**
 * Fase 7 — Van boodschappenlijst naar winkelmandje (testmodus), los van elke echte winkel.
 *
 * 1. `koppelLijst`: per open regel de productvoorstellen van de winkel (via de provider);
 *    wat de winkel niet kent, komt apart in "niet gevonden" (nooit stil weggelaten);
 * 2. `aantalVoor`: hoeveel verpakkingen, alleen als de winkel de inhoud als getal geeft;
 *    anders 1 (de gebruiker kan het aanpassen);
 * 3. `mandjeTotaal`: totaal in eurocent van wat een prijs heeft; producten zonder prijs van de
 *    winkel tellen apart ("geen prijs van de winkel"), nooit een verzonnen prijs.
 *
 * Een echte winkel komt later achter dezelfde `SupermarktProvider`-interface (server-side, met de
 * sleutel van de partner op de server). Hier wordt geen enkele winkel-API aangeroepen.
 */
import { naarBasis, inFamilie } from "@/lib/ingredient/eenheden";
import type { MandjeRegel, ProductVoorstel, SupermarktProvider } from "./provider";

export type LijstRegel = { id: string; name: string; quantity: number | null; unit: string };

export type Koppeling = {
  regel: LijstRegel;
  voorstellen: ProductVoorstel[];
};

export type KoppelUitkomst = {
  gevonden: Koppeling[];
  nietGevonden: LijstRegel[];
};

export async function koppelLijst(
  regels: readonly LijstRegel[],
  provider: Pick<SupermarktProvider, "productVoorstellen">,
): Promise<KoppelUitkomst> {
  const gevonden: Koppeling[] = [];
  const nietGevonden: LijstRegel[] = [];
  for (const regel of regels) {
    let voorstellen: ProductVoorstel[] = [];
    try {
      voorstellen = await provider.productVoorstellen(regel.name);
    } catch {
      voorstellen = [];
    }
    if (voorstellen.length) gevonden.push({ regel, voorstellen });
    else nietGevonden.push(regel);
  }
  return { gevonden, nietGevonden };
}

/** Hoeveel verpakkingen voor wat je nodig hebt; 1 als het niet zeker te rekenen valt. */
export function aantalVoor(regel: LijstRegel, product: ProductVoorstel): number {
  if (!product.maat) return 1;
  const nodig = naarBasis(regel.quantity, regel.unit);
  const pak = naarBasis(product.maat.quantity, product.maat.unit);
  if (!nodig || !pak || pak.waarde <= 0 || nodig.waarde <= 0) return 1;
  const zelfde = pak.familie === nodig.familie ? pak : inFamilie(pak, nodig.familie, regel.name);
  if (!zelfde || zelfde.waarde <= 0) return 1;
  return Math.min(20, Math.max(1, Math.ceil(nodig.waarde / zelfde.waarde - 1e-9)));
}

export function mandjeTotaal(regels: readonly MandjeRegel[]): {
  totaalCent: number;
  zonderPrijs: number;
  stuks: number;
} {
  let totaalCent = 0;
  let zonderPrijs = 0;
  let stuks = 0;
  for (const r of regels) {
    stuks += r.aantal;
    if (r.product.prijsCent === null) zonderPrijs += 1;
    else totaalCent += r.product.prijsCent * r.aantal;
  }
  return { totaalCent, zonderPrijs, stuks };
}

/** "€ 4,50" uit eurocent (Belgische notatie, vaste spatie). */
export function euroCent(cent: number): string {
  return `€\u00a0${(cent / 100).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
