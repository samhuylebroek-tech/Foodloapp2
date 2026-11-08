import { describe, expect, it } from "vitest";
import { kiesOmslag } from "./omslag";

describe("kiesOmslag", () => {
  it.each([
    [{ title: "Pompoensoep", category: "soep" }, "soep", "soup"],
    [{ title: "Tiramisu", category: "nagerecht" }, "zoet", "cake"],
    [{ title: "Griekse salade", category: "salade" }, "groen", "salad"],
    [{ title: "Overnight oats", category: "ontbijt" }, "ontbijt", "croissant"],
    [{ title: "Stoofvlees", category: "hoofdgerecht", tags: ["vlees"] }, "vlees", "beef"],
    [{ title: "Zalm met dille", category: "hoofdgerecht" }, "vis", "fish"],
    [{ title: "Champignonrisotto", category: "hoofdgerecht" }, "groen", "carrot"],
    [{}, "neutraal", "utensils"],
  ])("%o → %s/%s", (recept, stijl, icoon) => {
    expect(kiesOmslag(recept)).toEqual({ stijl, icoon });
  });
});
