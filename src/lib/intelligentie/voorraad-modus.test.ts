import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bruikbareVoorraad,
  merkVoorraadGebruik,
  voorraadModus,
  zetVoorraadBijhouden,
} from "./voorraad-modus";

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

const NU = Date.parse("2026-11-12T12:00:00Z");
const geleden = (d: number) => new Date(NU - d * 86400000).toISOString();
const items = [
  { naam: "kip", updated_at: geleden(1) },
  { naam: "spinazie", updated_at: geleden(6) },
  { naam: "rijst" },
];

describe("voorraad is optioneel", () => {
  it("onbekend = niet bijgehouden; eigen voorraadactie zet het aan; uit blijft uit", () => {
    expect(voorraadModus("u1")).toBe("onbekend");
    merkVoorraadGebruik("u1");
    expect(voorraadModus("u1")).toBe("bijhouden");
    zetVoorraadBijhouden("u2", false);
    merkVoorraadGebruik("u2");
    expect(voorraadModus("u2")).toBe("niet");
    expect(voorraadModus(null)).toBe("onbekend");
  });
  it("bijgehouden: alles in huis, met Gebruik eerst", () => {
    const b = bruikbareVoorraad(items, true, NU);
    expect(b.inHuis).toEqual(["kip", "spinazie", "rijst"]);
    expect(b.oudInHuis.map((o) => o.naam)).toEqual(["spinazie"]);
    expect(b.onlangsGekocht).toEqual([]);
  });
  it("niet bijgehouden: niets 'in huis', geen Gebruik eerst, alleen recente aankopen als hint", () => {
    const b = bruikbareVoorraad(items, false, NU);
    expect(b.inHuis).toEqual([]);
    expect(b.oudInHuis).toEqual([]);
    expect(b.onlangsGekocht).toEqual(["kip"]);
  });
});
