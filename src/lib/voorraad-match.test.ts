import { describe, expect, it } from "vitest";
import { isBasis, watKanIkKoken, zitInVoorraad } from "./voorraad-match";

const r = (id: string, title: string, ...namen: string[]) => ({
  id,
  title,
  ingredienten: namen.map((name) => ({ name })),
});

describe("zitInVoorraad", () => {
  it.each([
    ["bloem", ["bloem"], true],
    ["rijpe tomaten", ["tomaat"], true],
    ["rundvlees (stoofvlees)", ["rundvlees"], true],
    ["uien", ["ui"], true],
    ["eieren", ["eieren"], true],
    ["melk", ["kokosmelk"], false],
    ["pure chocolade", ["melk"], false],
    ["", ["bloem"], false],
  ])("%s in %o → %s", (ing, voorraad, verwacht) => {
    expect(zitInVoorraad(ing, voorraad)).toBe(verwacht);
  });
});

describe("isBasis", () => {
  it("zout, peper en water tellen niet als ontbrekend", () => {
    expect(isBasis("zout")).toBe(true);
    expect(isBasis("snufje zout")).toBe(true);
    expect(isBasis("peper")).toBe(true);
    expect(isBasis("bloem")).toBe(false);
  });
});

describe("watKanIkKoken", () => {
  const recepten = [
    r("1", "Pannenkoeken", "bloem", "eieren", "melk", "snufje zout"),
    r("2", "Omelet", "eieren", "boter", "peper", "zout"),
    r("3", "Stoofvlees", "rundvlees", "uien", "donker bier", "peperkoek"),
    r("4", "Water", "water"),
  ];

  it("rangschikt op het minst aantal ontbrekende ingrediënten", () => {
    const uit = watKanIkKoken(recepten, ["bloem", "eieren", "melk", "boter"]);
    expect(uit.map((m) => m.title)).toEqual(["Omelet", "Pannenkoeken"]);
    expect(uit[0]).toMatchObject({ totaal: 2, ontbreekt: [], score: 1 });
    expect(uit[1]).toMatchObject({ totaal: 3, ontbreekt: [] });
  });

  it("toont wat ontbreekt", () => {
    const uit = watKanIkKoken(recepten, ["ui", "rundvlees"]);
    expect(uit).toEqual([
      expect.objectContaining({
        title: "Stoofvlees",
        aanwezig: ["rundvlees", "uien"],
        ontbreekt: ["donker bier", "peperkoek"],
        score: 0.5,
      }),
    ]);
  });

  it("lege voorraad of geen enkele match → niets", () => {
    expect(watKanIkKoken(recepten, [])).toEqual([]);
    expect(watKanIkKoken(recepten, ["kaviaar"])).toEqual([]);
  });

  it("recepten met alleen basisingrediënten worden overgeslagen", () => {
    expect(watKanIkKoken(recepten, ["water"]).map((m) => m.title)).not.toContain("Water");
  });

  it("respecteert het maximum", () => {
    const veel = Array.from({ length: 20 }, (_, i) => r(String(i), `Recept ${i}`, "bloem", "x"));
    expect(watKanIkKoken(veel, ["bloem"], { max: 6 })).toHaveLength(6);
  });
});
