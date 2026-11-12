import { describe, expect, it } from "vitest";
import { beginletter } from "./RecipePhoto";

describe("beginletter", () => {
  it("neemt de eerste letter, in hoofdletter", () => {
    expect(beginletter("shakshuka met feta")).toBe("S");
    expect(beginletter("Witloofgratin met hesp en kaas")).toBe("W");
  });
  it("slaat een lidwoord over", () => {
    expect(beginletter("De beste stoofpot")).toBe("B");
    expect(beginletter("Het lekkerste brood")).toBe("L");
    expect(beginletter("Een snelle soep")).toBe("S");
  });
  it("slaat cijfers en tekens over en kent accenten", () => {
    expect(beginletter("3 × écht lekkere pasta")).toBe("É");
    expect(beginletter("'t Stoofpotje")).toBe("S");
  });
  it("geeft niets bij een lege naam", () => {
    expect(beginletter("")).toBe("");
    expect(beginletter(null)).toBe("");
    expect(beginletter("123")).toBe("");
  });
});
