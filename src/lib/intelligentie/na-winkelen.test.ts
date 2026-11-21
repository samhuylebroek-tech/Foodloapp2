import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { idsNaarVoorraad, naWinkelen, voorraadKeuzes, zetNaWinkelen } from "./na-winkelen";

const opslag = new Map<string, string>();
beforeEach(() => {
  opslag.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (s: string) => opslag.get(s) ?? null,
      setItem: (s: string, v: string) => void opslag.set(s, v),
    },
    dispatchEvent: () => true,
  };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("na het winkelen", () => {
  it("standaard altijd (zoals voordien), keuze per gebruiker", () => {
    expect(naWinkelen("u")).toBe("altijd");
    zetNaWinkelen("u", "vragen");
    expect(naWinkelen("u")).toBe("vragen");
    expect(naWinkelen("v")).toBe("altijd");
    expect(naWinkelen(null)).toBe("altijd");
  });
  it("onbekende waarde = altijd", () => {
    opslag.set("foodlo:na-winkelen:u", "rommel");
    expect(naWinkelen("u")).toBe("altijd");
  });
  it("welke ids naar de voorraad gaan", () => {
    expect(idsNaarVoorraad("altijd")).toBeUndefined();
    expect([...idsNaarVoorraad("nooit")!]).toEqual([]);
    expect([...idsNaarVoorraad("vragen", new Set(["a"]))!]).toEqual(["a"]);
    expect([...idsNaarVoorraad("vragen")!]).toEqual([]);
  });
  it("basisproducten en lege namen staan niet in de vraag", () => {
    const l = voorraadKeuzes([
      { id: "1", name: "zout" },
      { id: "2", name: "Kippenfilet" },
      { id: "3", name: "  " },
    ]);
    expect(l.map((x) => x.id)).toEqual(["2"]);
  });
});
