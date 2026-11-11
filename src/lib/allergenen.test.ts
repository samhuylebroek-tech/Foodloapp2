import { describe, expect, it } from "vitest";
import { allergenenIn } from "./allergenen";
import { naarWeekmenu } from "./kennismaking";

describe("allergenenIn", () => {
  it("vindt de gekozen allergenen in ingrediëntnamen", () => {
    const r = allergenenIn(
      ["200 g hazelnoten", "boter", "bloem", "suiker"],
      ["noten", "melk", "gluten"],
    );
    expect(r.map((x) => [x.id, x.ingredienten])).toEqual([
      ["gluten", ["bloem"]],
      ["melk", ["boter"]],
      ["noten", ["200 g hazelnoten"]],
    ]);
  });
  it("geen vals alarm bij bekende valkuilen", () => {
    expect(
      allergenenIn(
        ["bloemkool", "nootmuskaat", "kokosmelk", "zonnebloemolie", "portobello"],
        ["gluten", "noten", "melk", "sulfiet"],
      ),
    ).toEqual([]);
  });
  it("korte woorden alleen als heel woord: 'ei' niet in 'geitenkaas', 'vis' niet in 'inktvis'", () => {
    expect(allergenenIn(["geitenkaas"], ["eieren"])).toEqual([]);
    expect(allergenenIn(["2 eieren", "1 ei"], ["eieren"])[0]!.ingredienten).toEqual([
      "2 eieren",
      "1 ei",
    ]);
    expect(allergenenIn(["inktvis"], ["vis"])).toEqual([]);
    expect(allergenenIn(["inktvis"], ["weekdieren"])).toHaveLength(1);
  });
  it("niets gekozen: niets gemeld", () => {
    expect(allergenenIn(["pinda's"], [])).toEqual([]);
  });
  it("accenten en hoofdletters maken niet uit", () => {
    expect(allergenenIn(["Crème fraîche"], ["melk"])).toHaveLength(1);
  });
});

describe("kennismaking → weekmenu (privacy)", () => {
  it("alleen de kooktijd gaat naar het account", () => {
    expect(naarWeekmenu({ allergieen: ["noten"], dieet: "vegetarisch", kooktijd: 30 })).toEqual({
      maxMinuten: 30,
    });
  });
  it("dieet alleen met uitdrukkelijke toestemming; allergieën nooit", () => {
    const w = naarWeekmenu({ allergieen: ["noten"], dieet: "vegetarisch", dieetInWeekmenu: true });
    expect(w).toEqual({ vlees: 0, vis: 0, vega: 6 });
    expect(JSON.stringify(w)).not.toMatch(/noten/);
  });
});
