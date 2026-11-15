/**
 * Supermarkt-adapter (MODULE_DESIGNS §9: `WinkelAanbieder`). Doel: nieuwe winkels of partners
 * zonder code in de schermen.
 *
 * Bewuste keuze (werkstroom F): het **bestaande gedrag blijft exact zoals het is**. De schermen
 * (Lijst, winkelmodus, winkelideeën, winkelvolgorde) roepen nog steeds rechtstreeks
 * `winkelvolgorde.ts`, `winkel-afdelingen.ts` en `categorie.ts` aan. Die aanroepen omzetten naar
 * deze interface raakt vier drukke schermen tegelijk; dat gebeurt pas samen met de eerste echte
 * partner (en "In welke winkel?", BUG-087). Tot dan:
 *
 * - `LokaleSupermarkt` is een dunne laag over precies dezelfde functies (getest: zelfde uitkomst);
 * - `TestSupermarktProvider` toont hoe een partner productvoorstellen en prijzen zou leveren,
 *   met vaste **testgegevens** (verzonnen producten en prijzen, geen echte winkel, geen netwerk).
 *
 * Klantenkaarten (`loyalty_cards`) vallen hier niet onder: die zijn van de gebruiker, niet van de
 * winkel, en blijven ongewijzigd.
 */
import type { PrijsBron, Prijs } from "@/lib/budget";
import { categorieVan, leesCorrecties, type CategorieId } from "@/lib/categorie";
import { AFDELINGEN, type Afdeling } from "@/lib/winkel-afdelingen";
import { bewaarVolgorde, leesVolgorde } from "@/lib/winkelvolgorde";
import { normaliseerTekst } from "@/lib/zoeken";

export type ProductVoorstel = {
  naam: string;
  /** Prijs in eurocent, of null als onbekend. */
  prijsCent: number | null;
  inhoud: string;
  /** Verplicht zichtbaar label: testgegevens nooit als echte winkel tonen. */
  label: "testgegevens" | "partner";
};

export interface SupermarktProvider {
  readonly id: string;
  readonly naam: string;
  /** "lokaal": alles op het toestel (huidig gedrag). "test": verzonnen gegevens. "partner": echt. */
  readonly modus: "lokaal" | "test" | "partner";
  /** Afdelingen met typische producten (wandeling door de winkel). */
  afdelingen(): readonly Afdeling[];
  /** Volgorde van de lijstcategorieën in deze winkel. */
  volgorde(): CategorieId[];
  bewaarVolgorde(volgorde: CategorieId[]): void;
  /** In welke categorie hoort dit product (met de correcties van de gebruiker)? */
  categorie(naam: string): CategorieId;
  /** Optioneel: producten bij een ingrediënt (partner). Lokaal: geen. */
  productVoorstellen(ingredient: string): Promise<ProductVoorstel[]>;
  /** Optioneel: prijzen voor de budgetschatting. Lokaal: geen (de budgettabel blijft gelden). */
  readonly prijsBron: PrijsBron | null;
}

/** Het bestaande gedrag, ongewijzigd: dezelfde functies, dezelfde opslag (per toestel). */
export class LokaleSupermarkt implements SupermarktProvider {
  readonly id = "lokaal";
  readonly naam = "Mijn winkel";
  readonly modus = "lokaal" as const;
  readonly prijsBron = null;
  afdelingen() {
    return AFDELINGEN;
  }
  volgorde() {
    return leesVolgorde();
  }
  bewaarVolgorde(volgorde: CategorieId[]) {
    bewaarVolgorde(volgorde);
  }
  categorie(naam: string) {
    return categorieVan(naam, leesCorrecties());
  }
  async productVoorstellen(): Promise<ProductVoorstel[]> {
    return [];
  }
}

/** Verzonnen assortiment (testgegevens). Prijzen in eurocent. */
const TEST_ASSORTIMENT: {
  woorden: string[];
  naam: string;
  prijsCent: number;
  inhoud: string;
  prijs: Prijs;
}[] = [
  {
    woorden: ["melk"],
    naam: "Halfvolle melk (test)",
    prijsCent: 109,
    inhoud: "1 l",
    prijs: { perKg: 1.09 },
  },
  {
    woorden: ["boter"],
    naam: "Roomboter (test)",
    prijsCent: 249,
    inhoud: "250 g",
    prijs: { perKg: 9.96 },
  },
  {
    woorden: ["witloof"],
    naam: "Witloof (test)",
    prijsCent: 299,
    inhoud: "1 kg",
    prijs: { perKg: 2.99 },
  },
  {
    woorden: ["gehakt"],
    naam: "Gemengd gehakt (test)",
    prijsCent: 479,
    inhoud: "500 g",
    prijs: { perKg: 9.58 },
  },
  {
    woorden: ["pasta", "spaghetti"],
    naam: "Spaghetti (test)",
    prijsCent: 119,
    inhoud: "500 g",
    prijs: { perKg: 2.38 },
  },
  {
    woorden: ["eieren", "ei"],
    naam: "Scharreleieren (test)",
    prijsCent: 289,
    inhoud: "10 stuks",
    prijs: { perStuk: 0.289 },
  },
];

function zoekTest(ingredient: string) {
  const n = normaliseerTekst(ingredient).split(" ");
  return TEST_ASSORTIMENT.filter((p) =>
    p.woorden.some((w) => n.includes(w) || n.includes(`${w}s`)),
  );
}

/**
 * Testpartner: zelfde afdelingen, volgorde en categorieën als lokaal (geen ander gedrag), plus vaste
 * producten en prijzen. In de app altijd met het label "testgegevens".
 */
export class TestSupermarktProvider implements SupermarktProvider {
  readonly id = "test";
  readonly naam = "Testwinkel";
  readonly modus = "test" as const;
  private readonly basis = new LokaleSupermarkt();
  readonly prijsBron: PrijsBron = {
    naam: "Testwinkel",
    soort: "testgegevens",
    prijsVoor: (ingredient: string) => zoekTest(ingredient)[0]?.prijs ?? null,
  };
  afdelingen() {
    return this.basis.afdelingen();
  }
  volgorde() {
    return this.basis.volgorde();
  }
  bewaarVolgorde(volgorde: CategorieId[]) {
    this.basis.bewaarVolgorde(volgorde);
  }
  categorie(naam: string) {
    return this.basis.categorie(naam);
  }
  async productVoorstellen(ingredient: string): Promise<ProductVoorstel[]> {
    return zoekTest(ingredient).map((p) => ({
      naam: p.naam,
      prijsCent: p.prijsCent,
      inhoud: p.inhoud,
      label: "testgegevens" as const,
    }));
  }
}

/** Welke winkel? Nu altijd het bestaande, lokale gedrag; de testwinkel alleen expliciet (tests). */
export function kiesSupermarkt(opties: { test?: boolean } = {}): SupermarktProvider {
  return opties.test ? new TestSupermarktProvider() : new LokaleSupermarkt();
}
