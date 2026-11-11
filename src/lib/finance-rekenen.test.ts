import { describe, expect, it } from "vitest";
import { berekenOmzet, type Aankoop } from "./finance-rekenen";

const SINDS = "2026-11-01T00:00:00Z";
const a = (p: Partial<Aankoop>): Aankoop => ({
  user_id: "u1",
  bedrag_cent: 499,
  valuta: "EUR",
  status: "betaald",
  created_at: "2026-11-05T10:00:00Z",
  ...p,
});

describe("berekenOmzet (BUG-099)", () => {
  it("telt alleen betaalde euro's in de periode, in centen", () => {
    const r = berekenOmzet(
      [
        a({}),
        a({ bedrag_cent: 1, user_id: "u2" }),
        a({ status: "open" }),
        a({ created_at: "2026-10-20T10:00:00Z" }),
      ],
      SINDS,
    );
    expect(r.omzetEur).toBe(5);
    expect(r.omzetVorigEur).toBe(4.99);
    expect(r.betalendeKlanten).toBe(2);
  });
  it("telt andere munten nooit mee, maar meldt ze", () => {
    const r = berekenOmzet(
      [a({}), a({ valuta: "USD", bedrag_cent: 10000 }), a({ valuta: "gbp" })],
      SINDS,
    );
    expect(r.omzetEur).toBe(4.99);
    expect(r.andereValuta).toEqual({ aantal: 2, munten: ["GBP", "USD"] });
  });
  it("terugbetalingen apart, niet als omzet", () => {
    const r = berekenOmzet([a({}), a({ status: "refunded", bedrag_cent: 499 })], SINDS);
    expect(r.omzetEur).toBe(4.99);
    expect(r.terugbetaald).toEqual({ aantal: 1, bedragEur: 4.99 });
  });
  it("geen afrondingsfouten bij veel kleine bedragen", () => {
    const r = berekenOmzet(
      Array.from({ length: 1000 }, () => a({ bedrag_cent: 1 })),
      SINDS,
    );
    expect(r.omzetEur).toBe(10);
  });
});
