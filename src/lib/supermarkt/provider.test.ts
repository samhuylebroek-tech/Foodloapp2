// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { schatGerecht } from "@/lib/budget";
import { bewaarCorrectie, categorieVan, leesCorrecties } from "@/lib/categorie";
import { AFDELINGEN } from "@/lib/winkel-afdelingen";
import { bewaarVolgorde, leesVolgorde } from "@/lib/winkelvolgorde";
import { kiesSupermarkt, LokaleSupermarkt, TestSupermarktProvider } from "./provider";

beforeEach(() => window.localStorage.clear());

describe("SupermarktProvider: het bestaande gedrag blijft exact", () => {
  it("standaard is de lokale winkel (geen test, geen partner)", () => {
    expect(kiesSupermarkt().modus).toBe("lokaal");
    expect(kiesSupermarkt().prijsBron).toBeNull();
  });

  it("afdelingen zijn dezelfde lijst als winkel-afdelingen.ts", () => {
    expect(new LokaleSupermarkt().afdelingen()).toBe(AFDELINGEN);
  });

  it("volgorde lezen en bewaren gaat via dezelfde opslag als winkelvolgorde.ts", () => {
    const w = new LokaleSupermarkt();
    expect(w.volgorde()).toEqual(leesVolgorde());
    const omgekeerd = [...leesVolgorde()].reverse();
    w.bewaarVolgorde(omgekeerd);
    expect(leesVolgorde()).toEqual(omgekeerd);
    bewaarVolgorde([...omgekeerd].reverse());
    expect(w.volgorde()).toEqual([...omgekeerd].reverse());
  });

  it("categorie per product is dezelfde als categorieVan", () => {
    const w = new LokaleSupermarkt();
    for (const n of ["melk", "witloof", "gehakt", "wc-papier", "spaghetti", "iets onbekends"])
      expect(w.categorie(n)).toBe(categorieVan(n, leesCorrecties()));
    // Ook met een correctie van de gebruiker.
    bewaarCorrectie("iets onbekends", "diepvries");
    expect(w.categorie("iets onbekends")).toBe("diepvries");
  });

  it("lokaal: geen productvoorstellen, geen prijzen", async () => {
    expect(await new LokaleSupermarkt().productVoorstellen()).toEqual([]);
  });
});

describe("TestSupermarktProvider: testgegevens, zelfde basisgedrag", () => {
  it("zelfde afdelingen, volgorde en categorieën als lokaal", () => {
    const t = new TestSupermarktProvider();
    const l = new LokaleSupermarkt();
    expect(t.afdelingen()).toBe(l.afdelingen());
    expect(t.volgorde()).toEqual(l.volgorde());
    expect(t.categorie("melk")).toBe(l.categorie("melk"));
  });

  it("productvoorstellen altijd met het label testgegevens", async () => {
    const p = await new TestSupermarktProvider().productVoorstellen("halfvolle melk");
    expect(p).toEqual([
      {
        naam: "Halfvolle melk (test)",
        prijsCent: 109,
        inhoud: "1 l",
        label: "testgegevens",
        merk: "Huismerk",
        maat: { quantity: 1, unit: "l" },
      },
    ]);
    expect(await new TestSupermarktProvider().productVoorstellen("saffraan")).toEqual([]);
  });

  it("de testprijzen passen achter dezelfde budgetinterface", () => {
    const t = new TestSupermarktProvider();
    expect(t.prijsBron.soort).toBe("testgegevens");
    const k = schatGerecht([{ name: "melk", quantity: 1, unit: "l" }], 1, t.prijsBron);
    expect(k.totaal).toBe(1.09);
  });
});
