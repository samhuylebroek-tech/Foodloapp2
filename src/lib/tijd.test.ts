import { afterEach, describe, expect, it, vi } from "vitest";
import { lokaleDatum } from "./tijd";

afterEach(() => vi.unstubAllEnvs());

describe("lokaleDatum", () => {
  it("gebruikt de lokale kalenderdag, niet UTC", () => {
    // 9 november 00:30 lokale tijd = 8 november 23:30 UTC (in België, winteruur).
    const d = new Date(2026, 10, 9, 0, 30);
    expect(lokaleDatum(d)).toBe("2026-11-09");
  });
  it("vult maand en dag aan met nullen", () => {
    expect(lokaleDatum(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});
