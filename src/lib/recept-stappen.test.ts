import { describe, expect, it } from "vitest";
import {
  AANTAL_STAPPEN,
  ontbreektVoorBewaren,
  stapTitel,
  toonInStap,
  volgendeStap,
  vorigeStap,
  voortgangTekst,
} from "./recept-stappen";

describe("recept in stappen", () => {
  it("telt vier stappen en blijft binnen de grenzen", () => {
    expect(AANTAL_STAPPEN).toBe(4);
    expect(volgendeStap(1)).toBe(2);
    expect(volgendeStap(4)).toBe(4);
    expect(vorigeStap(1)).toBe(1);
    expect(vorigeStap(3)).toBe(2);
  });

  it("toont de voortgang in gewone taal", () => {
    expect(voortgangTekst(2)).toBe("Stap 2 van 4: Ingrediënten");
    expect(stapTitel(4)).toBe("Klopt alles?");
  });

  it("toont zonder stappenmodus alles, met stappenmodus alleen de huidige stap", () => {
    expect(toonInStap(false, 1, 3)).toBe(true);
    expect(toonInStap(true, 1, 3)).toBe(false);
    expect(toonInStap(true, 3, 3)).toBe(true);
  });

  it("vraagt alleen een naam om te bewaren", () => {
    expect(ontbreektVoorBewaren({ titel: "  " })).toMatch(/naam/);
    expect(ontbreektVoorBewaren({ titel: "Soep" })).toBeNull();
  });
});
