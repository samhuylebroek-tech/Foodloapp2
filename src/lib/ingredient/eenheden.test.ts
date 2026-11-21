import { describe, expect, it } from "vitest";
import { netteEenheid } from "./eenheden";

describe("netteEenheid (P6: geen 'stuk(s)' op het scherm)", () => {
  it("stuk(s) → stuk of stuks", () => {
    expect(netteEenheid(1, "stuk(s)")).toBe("stuk");
    expect(netteEenheid(0.5, "stuk(s)")).toBe("stuk");
    expect(netteEenheid(2, "stuk(s)")).toBe("stuks");
    expect(netteEenheid(null, "stuk(s)")).toBe("stuks");
  });
  it("teen(tjes) → teentje of teentjes", () => {
    expect(netteEenheid(1, "teen(tjes)")).toBe("teentje");
    expect(netteEenheid(3, "Teen(tjes)")).toBe("teentjes");
  });
  it("andere eenheden blijven gelijk", () => {
    expect(netteEenheid(2, "g")).toBe("g");
    expect(netteEenheid(1, "")).toBe("");
    expect(netteEenheid(1, null)).toBe("");
  });
});
