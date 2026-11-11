import { describe, expect, it } from "vitest";
import { rondAf } from "./weer";

describe("weer: locatie afronden (BUG-108)", () => {
  it("houdt twee decimalen over (±1 km)", () => {
    expect(rondAf({ lat: 50.846734, lon: 4.352451 })).toEqual({ lat: 50.85, lon: 4.35 });
    expect(rondAf({ lat: -33.868819, lon: 151.209295 })).toEqual({ lat: -33.87, lon: 151.21 });
  });
});
