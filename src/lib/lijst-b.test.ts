import { describe, expect, it } from "vitest";
import { waaromNodig } from "./kringloop";
import { normaliseerVolgorde, verschuif, isStandaard } from "./winkelvolgorde";
import { CATEGORIE_VOLGORDE } from "./categorie";

describe("B3 waaromNodig", () => {
  const recepten = [
    { id: "lasagne", title: "Lasagne", servings: 4 },
    { id: "soep", title: "Soep", servings: 2 },
  ];
  const ingredienten = [
    { recipe_id: "lasagne", name: "melk", quantity: 5, unit: "dl" },
    { recipe_id: "soep", name: "melk", quantity: 20, unit: "cl" },
    { recipe_id: "soep", name: "pompoen", quantity: 1, unit: "" },
  ];
  const plan = [
    { plan_date: "2026-11-10", recipe_id: "soep", personen: 4 },
    { plan_date: "2026-11-09", recipe_id: "lasagne", personen: null },
    { plan_date: "2026-11-01", recipe_id: "lasagne", personen: null }, // voorbij
  ];
  it("toont elk gepland gerecht (geschaald, op datum), het totaal, voorraad en andere regels", () => {
    const w = waaromNodig({
      naam: "melk",
      regelId: "f1",
      plan,
      recepten,
      ingredienten,
      voorraad: [{ id: "v", naam: "halfvolle melk", hoeveelheid: 1, eenheid: "dl" }],
      lijst: [
        { id: "f1", name: "melk", checked: false, quantity: 8, unit: "dl", recipe_id: "lasagne" },
        { id: "e1", name: "melk", checked: false, quantity: 1, unit: "l", recipe_id: null },
        { id: "x", name: "melk", checked: true, quantity: 1, unit: "l", recipe_id: null },
      ],
      vanaf: "2026-11-09",
    });
    expect(w.voor).toEqual([
      { titel: "Lasagne", dag: "2026-11-09", quantity: 5, unit: "dl" },
      { titel: "Soep", dag: "2026-11-10", quantity: 40, unit: "cl" },
    ]);
    expect(w.nodig).toEqual({ quantity: 9, unit: "dl" });
    expect(w.inHuis).toEqual([{ naam: "halfvolle melk", quantity: 1, unit: "dl" }]);
    expect(w.opLijst).toEqual([{ id: "e1", naam: "melk", quantity: 1, unit: "l", eigen: true }]);
  });

  it("vervangen product: telt voor het oorspronkelijke", () => {
    const w = waaromNodig({
      naam: "Diepvriespompoen (i.p.v. pompoen)",
      plan,
      recepten,
      ingredienten,
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-09",
    });
    expect(w.voor.map((v) => v.titel)).toEqual(["Soep"]);
    expect(w.voor[0]!.quantity).toBe(2);
  });

  it("niet gepland: lege uitleg", () => {
    const w = waaromNodig({
      naam: "koffie",
      plan,
      recepten,
      ingredienten,
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-09",
    });
    expect(w.voor).toEqual([]);
    expect(w.nodig).toBeNull();
  });
});

describe("B4 winkelvolgorde", () => {
  it("normaliseert: onbekend weg, dubbels weg, ontbrekende achteraan", () => {
    const v = normaliseerVolgorde(["dranken", "dranken", "onzin", "vlees-vis"]);
    expect(v.slice(0, 2)).toEqual(["dranken", "vlees-vis"]);
    expect(v).toHaveLength(CATEGORIE_VOLGORDE.length);
    expect(new Set(v).size).toBe(v.length);
    expect(normaliseerVolgorde(null)).toEqual([...CATEGORIE_VOLGORDE]);
  });
  it("verschuift één plek en blijft binnen de grenzen", () => {
    const s = [...CATEGORIE_VOLGORDE];
    expect(verschuif(s, "vlees-vis", -1).slice(0, 2)).toEqual(["vlees-vis", "groenten-fruit"]);
    expect(verschuif(s, "groenten-fruit", -1)).toBe(s);
    expect(isStandaard(s)).toBe(true);
    expect(isStandaard(verschuif(s, "dranken", 1))).toBe(false);
  });
});
