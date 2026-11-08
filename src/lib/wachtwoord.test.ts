import { describe, expect, it } from "vitest";
import { controleerNieuwWachtwoord as c } from "./wachtwoord";

describe("controleerNieuwWachtwoord", () => {
  it("leeg of enkel spaties", () => {
    expect(c("", "")).toMatch(/Vul een nieuw wachtwoord in/);
    expect(c("   ", "   ")).toMatch(/Vul een nieuw wachtwoord in/);
  });
  it("te kort", () => {
    expect(c("abc", "abc")).toMatch(/te kort/);
  });
  it("niet gelijk", () => {
    expect(c("koffie met melk", "koffie met mel")).toMatch(/niet gelijk/);
  });
  it("in orde: lange zin zonder symbolen is prima", () => {
    expect(c("mijn kat eet graag vis", "mijn kat eet graag vis")).toBeNull();
  });
  it("precies 6 tekens is genoeg", () => {
    expect(c("abcdef", "abcdef")).toBeNull();
  });
});
