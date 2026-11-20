import { describe, expect, it } from "vitest";
import {
  eenheidKeuze,
  isBijnaOp,
  leesHoeveelheid,
  plekVan,
  standaardPlek,
  zoekVoorraad,
} from "./voorraad-plek";

describe("voorraad: plek", () => {
  it.each([
    ["kippenfilet", "koelkast"],
    ["melk", "koelkast"],
    ["spinazie", "koelkast"],
    ["uien", "kast"],
    ["aardappelen", "kast"],
    ["rijst", "kast"],
    ["diepvries erwten", "diepvries"],
    ["vanille-ijs", "diepvries"],
  ])("%s → %s", (naam, plek) => expect(standaardPlek(naam)).toBe(plek));
  it("kolom wint van toestel, toestel van de gok", () => {
    expect(plekVan({ id: "1", naam: "melk", plek: "diepvries" }, { "1": "kast" })).toBe(
      "diepvries",
    );
    expect(plekVan({ id: "1", naam: "melk", plek: null }, { "1": "kast" })).toBe("kast");
    expect(plekVan({ id: "1", naam: "melk", plek: "rommel" })).toBe("koelkast");
  });
});

describe("voorraad: zoeken, bijna op, hoeveelheden", () => {
  const items = [{ naam: "Crème fraîche" }, { naam: "Rode ui" }, { naam: "Uien" }];
  it("zoekt zonder accenten en hoofdletters, op alle woorden", () => {
    expect(zoekVoorraad(items, "creme").map((i) => i.naam)).toEqual(["Crème fraîche"]);
    expect(zoekVoorraad(items, "ui").map((i) => i.naam)).toEqual(["Rode ui", "Uien"]);
    expect(zoekVoorraad(items, "rode ui").map((i) => i.naam)).toEqual(["Rode ui"]);
    expect(zoekVoorraad(items, "  ")).toHaveLength(3);
  });
  it("bijna op alleen met een gekende hoeveelheid", () => {
    expect(isBijnaOp({ hoeveelheid: 100, eenheid: "g" })).toBe(true);
    expect(isBijnaOp({ hoeveelheid: 0.1, eenheid: "kg" })).toBe(true);
    expect(isBijnaOp({ hoeveelheid: 0.5, eenheid: "kg" })).toBe(false);
    expect(isBijnaOp({ hoeveelheid: 1, eenheid: "" })).toBe(true);
    expect(isBijnaOp({ hoeveelheid: 6, eenheid: "" })).toBe(false);
    expect(isBijnaOp({ hoeveelheid: 10, eenheid: "cl" })).toBe(true);
    expect(isBijnaOp({ hoeveelheid: null, eenheid: "" })).toBe(false);
    expect(isBijnaOp({ hoeveelheid: 1, eenheid: "blik" })).toBe(false);
  });
  it("Belgische komma, nooit negatief of nul", () => {
    expect(leesHoeveelheid("1,5")).toBe(1.5);
    expect(leesHoeveelheid("250")).toBe(250);
    expect(leesHoeveelheid("0")).toBeNull();
    expect(leesHoeveelheid("-2")).toBeNull();
    expect(leesHoeveelheid("veel")).toBeNull();
  });
  it("eenheid als keuze", () => {
    expect(eenheidKeuze("KG")).toBe("kg");
    expect(eenheidKeuze("stuk")).toBe("");
    expect(eenheidKeuze("blik")).toBe("");
  });
});
