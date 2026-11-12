import { describe, expect, it } from "vitest";
import { tijdKeuzes } from "./tijdkeuzes";

describe("tijdKeuzes", () => {
  it("geeft kwartieren van 05:00 tot 23:45 in 24-uursnotatie", () => {
    const t = tijdKeuzes();
    expect(t[0]).toBe("05:00");
    expect(t.at(-1)).toBe("23:45");
    expect(t).toContain("18:30");
    expect(t).toHaveLength(76);
    expect(t.every((x) => /^\d{2}:\d{2}$/.test(x))).toBe(true);
    expect(t.some((x) => /AM|PM/i.test(x))).toBe(false);
  });

  it("houdt een bewaarde tijd buiten het kwartier, op zijn plaats", () => {
    const t = tijdKeuzes("18:35");
    expect(t).toContain("18:35");
    expect(t.indexOf("18:35")).toBe(t.indexOf("18:30") + 1);
  });

  it("negeert een ongeldige of lege waarde", () => {
    expect(tijdKeuzes("")).toHaveLength(76);
    expect(tijdKeuzes("6 PM")).toHaveLength(76);
    expect(tijdKeuzes(null)).toHaveLength(76);
  });
});
