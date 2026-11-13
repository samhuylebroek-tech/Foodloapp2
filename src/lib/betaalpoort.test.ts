import { describe, expect, it } from "vitest";
import { BETAALPROVIDER_GEKOPPELD, betaalInstellingGeweigerd } from "./betaalpoort";

describe("betaalpoort (BUG-143)", () => {
  it("er is nog geen provider gekoppeld", () => {
    expect(BETAALPROVIDER_GEKOPPELD).toBe(false);
  });

  it("weigert betalen of credits kopen aanzetten zonder provider, ook als tekst of getal", () => {
    for (const sleutel of ["betalen_actief", "credits_kopen_actief"]) {
      for (const waarde of [true, "true", 1, "1"]) {
        expect(betaalInstellingGeweigerd(sleutel, waarde)).toMatch(/geen betaalprovider/);
      }
    }
  });

  it("uitzetten mag altijd", () => {
    expect(betaalInstellingGeweigerd("betalen_actief", false)).toBeNull();
    expect(betaalInstellingGeweigerd("credits_kopen_actief", "false")).toBeNull();
    expect(betaalInstellingGeweigerd("credits_kopen_actief", null)).toBeNull();
  });

  it("andere instellingen worden niet geraakt", () => {
    expect(betaalInstellingGeweigerd("gratis_gerechten", 100)).toBeNull();
    expect(betaalInstellingGeweigerd("credits_waarschuwing", true)).toBeNull();
  });

  it("met een gekoppelde provider mag aanzetten", () => {
    expect(betaalInstellingGeweigerd("betalen_actief", true, true)).toBeNull();
  });
});
