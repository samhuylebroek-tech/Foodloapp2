import { describe, expect, it } from "vitest";
import { CATALOGUS, beeldVoor, zoekCatalogus } from "./catalogus";
import { categorieVan } from "./categorie";

describe("productcatalogus", () => {
  it("geen dubbele producten", () => {
    const namen = CATALOGUS.flatMap((g) => g.producten.map((p) => p.naam));
    expect(new Set(namen).size).toBe(namen.length);
  });
  it("elk product valt in zijn afdeling volgens de eigen indeling (de lijst groepeert gelijk)", () => {
    const fout = CATALOGUS.flatMap((g) =>
      g.producten
        .filter((p) => g.afdeling !== "voorraadkast" && categorieVan(p.naam, {}) !== g.afdeling)
        .map((p) => `${p.naam}: ${categorieVan(p.naam, {})} ≠ ${g.afdeling}`),
    );
    expect(fout).toEqual([]);
  });
  it("zoeken op het begin van een woord; leeg = alles", () => {
    expect(zoekCatalogus("").length).toBe(CATALOGUS.length);
    const r = zoekCatalogus("mel").flatMap((g) => g.producten.map((p) => p.naam));
    expect(r).toContain("melk");
    expect(zoekCatalogus("xyzzy")).toEqual([]);
  });
  it("beeldVoor herkent ook hoofdletters", () => {
    expect(beeldVoor("Melk")).toBe("🥛");
    expect(beeldVoor("iets onbekends")).toBeNull();
  });
});
