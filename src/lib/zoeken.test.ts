import { describe, expect, it } from "vitest";
import { bewerkAfstand, lijktOp, zoekScore, zoekWoorden } from "./zoeken";

describe("zoeken met tikfouten (BUG-100)", () => {
  it("bewerkafstand telt weglating, vervanging en omwisseling als één fout", () => {
    expect(bewerkAfstand("stofvlees", "stoofvlees")).toBe(1);
    expect(bewerkAfstand("spagetti", "spaghetti")).toBe(1);
    expect(bewerkAfstand("lasgane", "lasagne")).toBe(1);
    expect(bewerkAfstand("zalm", "zalm")).toBe(0);
  });
  it("vindt recepten ondanks een tikfout", () => {
    const stoof = { titel: "Stoofvlees met frietjes", ingredienten: ["rundvlees", "bier"] };
    expect(zoekScore(stoof, zoekWoorden("stofvlees"))).toBeGreaterThan(0);
    expect(zoekScore({ titel: "Spaghetti bolognese" }, zoekWoorden("spagetti"))).toBeGreaterThan(0);
    expect(zoekScore({ titel: "Romige pompoensoep" }, zoekWoorden("pompoen"))).toBeGreaterThan(0);
  });
  it("exacte treffer scoort hoger dan een tikfout", () => {
    const r = { titel: "Stoofvlees met frietjes" };
    expect(zoekScore(r, zoekWoorden("stoofvlees"))).toBeGreaterThan(
      zoekScore(r, zoekWoorden("stofvlees")),
    );
  });
  it("korte woorden en echt andere woorden geven geen valse treffer", () => {
    expect(lijktOp("ui", "uien en look")).toBe(false);
    expect(zoekScore({ titel: "Chocolademousse" }, zoekWoorden("zalm"))).toBe(0);
    expect(zoekScore({ titel: "Griekse salade" }, zoekWoorden("pizza"))).toBe(0);
  });
});
