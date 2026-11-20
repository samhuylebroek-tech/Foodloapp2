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
  /** Prijs in eurocent, of null als onbekend (dan toont de app "geen prijs van de winkel"). */
  prijsCent: number | null;
  inhoud: string;
  /** Verplicht zichtbaar label: testgegevens nooit als echte winkel tonen. */
  label: "testgegevens" | "partner";
  /** Fase 7: merk of huismerk, als de winkel dat levert. */
  merk?: string;
  /** Fase 7: inhoud als getal (om het aantal verpakkingen te rekenen), als de winkel dat levert. */
  maat?: { quantity: number; unit: string };
};

/** Fase 7: een mandje dat naar de winkel gaat. Prijzen in eurocent. */
export type MandjeRegel = {
  /** De regel op je lijst. */
  lijstNaam: string;
  product: ProductVoorstel;
  aantal: number;
};

export type MandjeBevestiging = {
  /** Kenmerk bij de winkel (testmodus: "TEST-…"). */
  referentie: string;
  /** In testmodus gaat er niets naar een echte winkel. */
  test: boolean;
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
  /** Fase 7: kan deze winkel een mandje ontvangen? Lokaal: nee. */
  readonly kanMandje: boolean;
  /** Fase 7: mandje doorsturen. Een echte partner doet dit later via de server, nooit vanuit de browser met een sleutel. */
  stuurMandje(regels: readonly MandjeRegel[]): Promise<MandjeBevestiging>;
}

/** Het bestaande gedrag, ongewijzigd: dezelfde functies, dezelfde opslag (per toestel). */
export class LokaleSupermarkt implements SupermarktProvider {
  readonly id = "lokaal";
  readonly naam = "Mijn winkel";
  readonly modus = "lokaal" as const;
  readonly prijsBron = null;
  readonly kanMandje = false;
  async stuurMandje(): Promise<MandjeBevestiging> {
    throw new Error("Deze winkel kan nog geen mandje ontvangen.");
  }
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

/** Verzonnen assortiment (testgegevens). Prijzen in eurocent; `null` = de winkel geeft geen prijs. */
const TEST_ASSORTIMENT: {
  woorden: string[];
  naam: string;
  prijsCent: number | null;
  inhoud: string;
  prijs: Prijs | null;
  merk?: string;
  maat?: { quantity: number; unit: string };
}[] = [
  {
    woorden: ["melk"],
    naam: "Halfvolle melk (test)",
    prijsCent: 109,
    inhoud: "1 l",
    prijs: { perKg: 1.09 },
    merk: "Huismerk",
    maat: { quantity: 1, unit: "l" },
  },
  {
    woorden: ["boter"],
    naam: "Roomboter (test)",
    prijsCent: 249,
    inhoud: "250 g",
    prijs: { perKg: 9.96 },
    maat: { quantity: 250, unit: "g" },
  },
  {
    woorden: ["witloof"],
    naam: "Witloof (test)",
    prijsCent: 299,
    inhoud: "1 kg",
    prijs: { perKg: 2.99 },
    maat: { quantity: 1, unit: "kg" },
  },
  {
    woorden: ["gehakt"],
    naam: "Gemengd gehakt (test)",
    prijsCent: 479,
    inhoud: "500 g",
    prijs: { perKg: 9.58 },
    maat: { quantity: 500, unit: "g" },
  },
  {
    woorden: ["pasta", "spaghetti"],
    naam: "Spaghetti (test)",
    prijsCent: 119,
    inhoud: "500 g",
    prijs: { perKg: 2.38 },
    merk: "Huismerk",
    maat: { quantity: 500, unit: "g" },
  },
  {
    woorden: ["pasta", "spaghetti"],
    naam: "Spaghetti n° 5 (test)",
    prijsCent: 229,
    inhoud: "500 g",
    prijs: null,
    merk: "Testmerk",
    maat: { quantity: 500, unit: "g" },
  },
  {
    woorden: ["eieren", "ei"],
    naam: "Scharreleieren (test)",
    prijsCent: 289,
    inhoud: "10 stuks",
    prijs: { perStuk: 0.289 },
    maat: { quantity: 10, unit: "" },
  },
  // Fase 7: genoeg om een gewone lijst (ook de demolijst) te koppelen.
  {
    woorden: ["brood", "volkorenbrood"],
    naam: "Volkorenbrood, gesneden (test)",
    prijsCent: 239,
    inhoud: "800 g",
    prijs: { perStuk: 2.39 },
    merk: "Huismerk",
  },
  {
    woorden: ["brood", "volkorenbrood"],
    naam: "Bakkersbrood, vers (test)",
    prijsCent: null,
    inhoud: "1 stuk",
    prijs: null,
    merk: "Bakkerij in de winkel",
  },
  {
    woorden: ["rundvlees", "stoofvlees"],
    naam: "Runderstoofvlees (test)",
    prijsCent: 899,
    inhoud: "500 g",
    prijs: { perKg: 17.98 },
    maat: { quantity: 500, unit: "g" },
  },
  {
    woorden: ["uien", "ui", "ajuin"],
    naam: "Gele uien (test)",
    prijsCent: 149,
    inhoud: "1 kg (net)",
    prijs: { perKg: 1.49 },
    maat: { quantity: 1, unit: "kg" },
  },
  {
    woorden: ["bier"],
    naam: "Donker abdijbier, 33 cl (test)",
    prijsCent: 159,
    inhoud: "33 cl",
    prijs: { perKg: 4.82 },
    maat: { quantity: 33, unit: "cl" },
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
    prijsVoor: (ingredient: string) => zoekTest(ingredient).find((p) => p.prijs)?.prijs ?? null,
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
  readonly kanMandje = true;
  async productVoorstellen(ingredient: string): Promise<ProductVoorstel[]> {
    return zoekTest(ingredient).map((p) => ({
      naam: p.naam,
      prijsCent: p.prijsCent,
      inhoud: p.inhoud,
      label: "testgegevens" as const,
      ...(p.merk ? { merk: p.merk } : {}),
      ...(p.maat ? { maat: p.maat } : {}),
    }));
  }
  /** Testmodus: niets verlaat het toestel. Het kenmerk is vast per inhoud (testbaar). */
  async stuurMandje(regels: readonly MandjeRegel[]): Promise<MandjeBevestiging> {
    if (!regels.length) throw new Error("Het mandje is leeg.");
    let h = 0;
    for (const r of regels)
      for (const c of `${r.product.naam}×${r.aantal}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { referentie: `TEST-${String(h % 1_000_000).padStart(6, "0")}`, test: true };
  }
}

/** Welke winkel? Nu altijd het bestaande, lokale gedrag; de testwinkel alleen expliciet (tests). */
export function kiesSupermarkt(opties: { test?: boolean } = {}): SupermarktProvider {
  return opties.test ? new TestSupermarktProvider() : new LokaleSupermarkt();
}
