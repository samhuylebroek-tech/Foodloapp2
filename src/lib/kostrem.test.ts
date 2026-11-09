import { describe, expect, it } from "vitest";
import { KleineCache, Venster } from "./kostrem";

describe("kostenrem", () => {
  it("Venster laat max N oproepen per sleutel toe binnen het venster", () => {
    let t = 0;
    const v = new Venster(3, 1000, () => t);
    expect([v.neem("a"), v.neem("a"), v.neem("a"), v.neem("a")]).toEqual([true, true, true, false]);
    expect(v.neem("b")).toBe(true); // andere bezoeker telt apart
    expect(v.rest("a")).toBe(0);
    t = 1001; // venster voorbij
    expect(v.neem("a")).toBe(true);
    expect(v.rest("a")).toBe(2);
  });

  it("KleineCache houdt hooguit max items en gooit de oudst gebruikte eruit", () => {
    const c = new KleineCache<string>(2);
    c.set("x", "1");
    c.set("y", "2");
    expect(c.get("x")).toBe("1"); // x is nu recent
    c.set("z", "3");
    expect(c.get("y")).toBeUndefined();
    expect(c.get("x")).toBe("1");
    expect(c.grootte).toBe(2);
  });
});
