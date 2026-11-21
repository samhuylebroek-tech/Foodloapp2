import { describe, expect, it } from "vitest";
import { hintVoorAI, voorAI } from "./privacy";

describe("privacylaag voor AI (BUG-142)", () => {
  it("laat neutrale smaakwensen door", () => {
    expect(voorAI("paddenstoelen, bloemkool")).toEqual({
      tekst: "paddenstoelen, bloemkool",
      weggelaten: 0,
    });
    expect(voorAI("spruitjes en witloof").tekst).toBe("spruitjes, witloof");
  });

  it("laat allergenen weg, ook in een zin", () => {
    const r = voorAI("noten, bloemkool, ik ben allergisch voor pinda's, melk");
    expect(r.tekst).toBe("bloemkool");
    expect(r.weggelaten).toBe(3);
  });

  it("laat intoleranties, dieet en gezondheid weg", () => {
    for (const gevoelig of [
      "lactose-intolerant",
      "glutenvrij",
      "coeliakie",
      "diabetes",
      "zwanger",
      "vegan",
      "vegetarisch",
      "halal",
      "geen schaaldieren",
      "selder",
      "sesam",
      "garnalen",
    ]) {
      expect(voorAI(`spruitjes, ${gevoelig}`).tekst, gevoelig).toBe("spruitjes");
    }
  });

  it("geeft nooit meer dan 300 tekens en niets voor leeg", () => {
    expect(voorAI("").tekst).toBe("");
    expect(voorAI(null).tekst).toBe("");
    expect(voorAI("a".repeat(500)).tekst.length).toBeLessThanOrEqual(300);
  });

  it("schoont een hint 'Vermijd: …' op en laat een lege hint weg", () => {
    expect(hintVoorAI("Vermijd: bloemkool, noten")).toBe("Vermijd: bloemkool");
    expect(hintVoorAI("Vermijd: noten, melk")).toBe("");
    expect(hintVoorAI("")).toBe("");
  });
});
