import { describe, expect, it } from "vitest";
import {
  budgetOordeel,
  euro,
  kostVan,
  leesBedrag,
  schatGerecht,
  schatWeek,
  SCHATTING,
  type PrijsBron,
} from "./budget";

const witloof = [
  { name: "witloof", quantity: 8, unit: "stuk(s)" },
  { name: "gekookte hesp", quantity: 8, unit: "snee" },
  { name: "melk", quantity: 50, unit: "cl" },
  { name: "gemalen kaas", quantity: 150, unit: "g" },
  { name: "boter", quantity: 40, unit: "g" },
  { name: "bloem", quantity: 40, unit: "g" },
];

describe("budget: schatting per ingrediënt", () => {
  it("rekent gewicht, volume en stuks om", () => {
    expect(kostVan({ name: "gehakt", quantity: 500, unit: "g" })).toBeCloseTo(5);
    expect(kostVan({ name: "melk", quantity: 1, unit: "l" })).toBeCloseTo(1.15);
    expect(kostVan({ name: "melk", quantity: 50, unit: "cl" })).toBeCloseTo(0.575);
    expect(kostVan({ name: "eieren", quantity: 4, unit: "" })).toBeCloseTo(1.28);
    // Stuks met een kiloprijs: via het gewicht per stuk.
    expect(kostVan({ name: "witloof", quantity: 8, unit: "stuk(s)" })).toBeCloseTo(8 * 0.13 * 3.5);
    // Factor (personen)
    expect(kostVan({ name: "gehakt", quantity: 500, unit: "g" }, 0.5)).toBeCloseTo(2.5);
  });

  it("zout en peper: € 0; onbekend of zonder hoeveelheid: niet geschat", () => {
    expect(kostVan({ name: "zout", quantity: null, unit: "" })).toBe(0);
    expect(kostVan({ name: "saffraan", quantity: 1, unit: "g" })).toBeNull();
    expect(kostVan({ name: "gehakt", quantity: null, unit: "" })).toBeNull();
  });

  it("verwart lijkende namen niet (bloemkool is geen bloem, kokosmelk geen melk)", () => {
    expect(SCHATTING.prijsVoor("bloemkool")).toEqual({ perStuk: 2.6 });
    expect(SCHATTING.prijsVoor("kokosmelk")).toEqual({ perKg: 5 });
  });
});

describe("budget: gerecht en week", () => {
  it("witloof met hesp: alles geschat, rond € 9", () => {
    const k = schatGerecht(witloof);
    expect(k.onbekend).toEqual([]);
    expect(k.dekking).toBe(1);
    expect(k.totaal).toBeGreaterThan(7);
    expect(k.totaal).toBeLessThan(11);
    // Voor 2 i.p.v. 4 personen: de helft.
    expect(schatGerecht(witloof, 0.5).totaal).toBeCloseTo(k.totaal / 2, 1);
  });

  it("onbekende ingrediënten worden gemeld, niet verzonnen", () => {
    const k = schatGerecht([...witloof, { name: "truffelolie extra", quantity: 1, unit: "el" }]);
    const k2 = schatGerecht([{ name: "yuzu", quantity: 1, unit: "" }]);
    expect(k.onbekend).toEqual(["truffelolie extra"]);
    expect(k.totaal).toBe(schatGerecht(witloof).totaal);
    expect(k2).toEqual({ totaal: 0, onbekend: ["yuzu"], dekking: 0 });
  });

  it("week: schaalt per maaltijd met personen; maaltijd zonder recept = niet geschat", () => {
    const w = schatWeek(
      [
        { recipe_id: "w", personen: 4, servings: 4 },
        { recipe_id: "w", personen: 2, servings: 4 },
        { recipe_id: null },
      ],
      { w: witloof },
    );
    const een = schatGerecht(witloof).totaal;
    expect(w.maaltijden).toBe(3);
    expect(w.nietGeschat).toBe(1);
    expect(w.totaal).toBeCloseTo(een * 1.5, 1);
  });

  it("een andere prijsbron (bv. testpartner) past achter dezelfde interface", () => {
    const vast: PrijsBron = {
      naam: "test",
      soort: "testgegevens",
      prijsVoor: () => ({ perStuk: 1 }),
    };
    expect(schatGerecht([{ name: "iets", quantity: 3, unit: "" }], 1, vast).totaal).toBe(3);
  });
});

describe("budget: oordeel en notatie", () => {
  it("binnen, bijna, over", () => {
    expect(budgetOordeel(40, 50).status).toBe("binnen");
    expect(budgetOordeel(46, 50).status).toBe("bijna");
    expect(budgetOordeel(56.2, 50)).toMatchObject({ status: "over", verschil: -6.2 });
    expect(budgetOordeel(56, 0).status).toBe("binnen");
  });

  it("Belgische notatie en vergevingsgezinde invoer", () => {
    expect(euro(4.5)).toBe("€\u00a04,50");
    expect(euro(1234.5)).toMatch(/^€\s1.?234,50$/);
    expect(leesBedrag("45")).toBe(45);
    expect(leesBedrag("€ 45,50")).toBe(45.5);
    expect(leesBedrag("45.5")).toBe(45.5);
    expect(leesBedrag("0")).toBeNull();
    expect(leesBedrag("veel")).toBeNull();
    expect(leesBedrag("99999")).toBeNull();
  });
});
