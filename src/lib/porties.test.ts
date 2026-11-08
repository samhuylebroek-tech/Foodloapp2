import { describe, expect, it } from "vitest";
import { schatPersonen } from "./porties";

const ing = (name: string, quantity: number | null, unit = "") => ({ name, quantity, unit });

describe("schatPersonen — bestaand gedrag", () => {
  it.each([
    [[ing("spaghetti", 400, "g")], 4],
    [[ing("rijst", 320, "g")], 4],
    [[ing("aardappelen", 1, "kg")], 4],
    [[ing("kippenfilet", 600, "g")], 4],
    [[ing("gehakt", 300, "g")], 2],
    [[ing("eieren", 4)], 2],
    [[ing("eieren", 6, "stuk(s)")], 3],
    [[ing("Zalm", 600, "g")], 4],
    [[ing("pasta", 2, "kg")], 12], // maximum 12
  ])("%o → %i", (lijst, verwacht) => {
    expect(schatPersonen(lijst)).toBe(verwacht);
  });

  it("geen bekende basis → null (we raden niet)", () => {
    expect(schatPersonen([ing("tomaten", 4), ing("basilicum", 1, "bos")])).toBeNull();
  });
  it("hoeveelheid leeg of 0 telt niet mee", () => {
    expect(schatPersonen([ing("pasta", null, "g"), ing("rijst", 0, "g")])).toBeNull();
  });
  it("eieren in grammen tellen niet als stuks", () => {
    expect(schatPersonen([ing("eieren", 100, "g")])).toBeNull();
  });
  it("lege lijst → null", () => {
    expect(schatPersonen([])).toBeNull();
  });
});

describe("schatPersonen — geen valse treffers (BUG-020)", () => {
  it.each([
    ["kleine uien (bevat 'ei')", [ing("kleine uien", 4)]],
    ["geitenkaas (bevat 'ei')", [ing("geitenkaas", 2)]],
    ["kippenbouillon", [ing("kippenbouillon", 500, "ml")]],
    ["visbouillon", [ing("visbouillon", 1, "l")]],
    ["tomatenpasta", [ing("tomatenpasta", 70, "g")]],
    ["rijstazijn", [ing("rijstazijn", 30, "ml")]],
    ["vissaus", [ing("vissaus", 20, "ml")]],
  ])("%s → null", (_naam, lijst) => {
    expect(schatPersonen(lijst)).toBeNull();
  });

  it("bijproducten verstoren de echte schatting niet", () => {
    expect(schatPersonen([ing("pasta", 400, "g"), ing("kleine uien", 4)])).toBe(4);
    expect(schatPersonen([ing("visbouillon", 1, "l"), ing("zalm", 600, "g")])).toBe(4);
  });
});
