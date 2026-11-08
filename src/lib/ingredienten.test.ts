import { describe, expect, it } from "vitest";
import {
  belgischeMaat,
  ingredientToLine,
  parseIngredientLine as p,
  parseIngredientText,
  toonBelgischeMaat,
} from "./ingredienten";

describe("parseIngredientLine — gewone regels (gedrag ongewijzigd)", () => {
  it.each([
    ["500 g bloem", { name: "bloem", quantity: 500, unit: "g" }],
    ["500g bloem", { name: "bloem", quantity: 500, unit: "g" }],
    ["1,5 kg aardappelen", { name: "aardappelen", quantity: 1.5, unit: "kg" }],
    ["3 eieren", { name: "eieren", quantity: 3, unit: "" }],
    ["2 gele uien", { name: "gele uien", quantity: 2, unit: "" }],
    ["½ ui", { name: "ui", quantity: 0.5, unit: "" }],
    ["1 1/2 el suiker", { name: "suiker", quantity: 1.5, unit: "el" }],
    ["- 2 tl zout", { name: "zout", quantity: 2, unit: "tl" }],
    ["• 1 blik tomaten", { name: "tomaten", quantity: 1, unit: "blik" }],
    ["2 teentjes knoflook", { name: "knoflook", quantity: 2, unit: "teen(tjes)" }],
    ["2 tomaten", { name: "tomaten", quantity: 2, unit: "" }], // "tot" mag "tomaten" niet raken
    ["snufje zout", { name: "snufje zout", quantity: null, unit: "" }],
    ["peper", { name: "peper", quantity: null, unit: "" }],
  ])("%s", (regel, verwacht) => {
    expect(p(regel)).toEqual(verwacht);
  });

  it("lege regel geeft null", () => {
    expect(p("   ")).toBeNull();
  });
});

describe("parseIngredientLine — eenheden met punt (BUG-018)", () => {
  it.each([
    ["1 el. olijfolie", { name: "olijfolie", quantity: 1, unit: "el" }],
    ["2 tl. zout", { name: "zout", quantity: 2, unit: "tl" }],
    ["1 l. melk", { name: "melk", quantity: 1, unit: "l" }],
    ["1 lb. rundvlees", { name: "rundvlees", quantity: 454, unit: "g" }],
    ["1 fl. oz. melk", { name: "melk", quantity: 3, unit: "cl" }],
    ["2 EL. honing", { name: "honing", quantity: 2, unit: "el" }],
  ])("%s", (regel, verwacht) => {
    expect(p(regel)).toEqual(verwacht);
  });
});

describe("parseIngredientLine — bereiken (BUG-019)", () => {
  it.each([
    ["2-3 teentjes knoflook", { name: "knoflook", quantity: 2, unit: "teen(tjes)" }],
    ["2 - 3 tomaten", { name: "tomaten", quantity: 2, unit: "" }],
    ["1–2 el honing", { name: "honing", quantity: 1, unit: "el" }],
    ["2 à 3 eieren", { name: "eieren", quantity: 2, unit: "" }],
    ["2 tot 3 dl room", { name: "room", quantity: 2, unit: "dl" }],
    ["100-150 g kaas", { name: "kaas", quantity: 100, unit: "g" }],
  ])("%s", (regel, verwacht) => {
    expect(p(regel)).toEqual(verwacht);
  });

  it("een streepje zonder getal blijft in de naam", () => {
    expect(p("1 zak chips - paprika")).toEqual({
      name: "zak chips - paprika",
      quantity: 1,
      unit: "",
    });
  });
});

describe("belgischeMaat — omrekenen", () => {
  it.each([
    [2, "cups", { quantity: 48, unit: "cl" }],
    [5, "cups", { quantity: 1.2, unit: "l" }],
    [3, "lb", { quantity: 1.36, unit: "kg" }],
    [1, "dozen", { quantity: 12, unit: "stuk(s)" }],
    [null, "snufje", { quantity: null, unit: "snuf" }],
    [2, "kopje", { quantity: 2, unit: "kopje" }], // onbekend: onaangeroerd
  ])("%s %s", (q, u, verwacht) => {
    expect(belgischeMaat(q, u)).toEqual(verwacht);
  });

  it("toont een komma als decimaalteken", () => {
    expect(toonBelgischeMaat(1.5, "kg")).toBe("1,5 kg");
  });
});

describe("parseIngredientText / ingredientToLine — heen en terug", () => {
  it("leest meerdere regels en slaat lege over", () => {
    expect(parseIngredientText("500 g bloem\n\n2 eieren")).toHaveLength(2);
  });

  it("een opgeslagen ingrediënt terug als tekst en opnieuw inlezen geeft hetzelfde", () => {
    for (const i of [
      { name: "bloem", quantity: 500, unit: "g" },
      { name: "olijfolie", quantity: 1.5, unit: "el" },
      { name: "eieren", quantity: 3, unit: "" },
    ]) {
      const regel = ingredientToLine(i).replace(",", ".");
      expect(p(regel)).toEqual(i);
    }
  });
});
