// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { bepaalContext } from "@/lib/intelligentie/context";
import type { Geschiedenis } from "@/lib/intelligentie/geschiedenis";
import type { Invoer, Kandidaat } from "@/lib/intelligentie/voorstel";
import { beveelAan } from "@/lib/planner/engine";
import { kiesWeerAdapter, TEST_WEER_SLEUTEL, TestWeerAdapter, weerSignaal } from "@/lib/weer-bron";
import { weerFactor } from "./weer-seizoen";

beforeEach(() => window.localStorage.clear());

const leeg: Geschiedenis = { laatst: {}, komend: new Set(), minutenPerWeekdag: {} };
const k = (id: string, extra: Partial<Kandidaat> = {}): Kandidaat => ({
  id,
  title: id,
  minuten: 40,
  category: "hoofdgerecht",
  tags: [],
  ingredienten: ["kaas"],
  ...extra,
});
const invoer = (weer: { temp: number; regen: boolean } | null): Invoer => ({
  kandidaten: [k("Ovenschotel met kaas"), k("Lichte zomerse bowl")],
  context: bepaalContext(new Date(2026, 5, 18, 17), weer),
  voorraad: ["kaas"],
  geschiedenis: leeg,
  voorkeur: { maxMinuten: 0, soort: null, vermijd: "" },
});

describe("weer en seizoen als zachte factor", () => {
  it("zonder bron of zonder meting: 'geen weer beschikbaar' en terug naar het seizoen", () => {
    const f = weerFactor({ aan: true, heeftBron: false, meting: null, maand: 10 });
    expect(f).toMatchObject({ weer: null, stand: "geen-bron" });
    expect(f.tekst).toMatch(/Geen weer beschikbaar.*seizoen: soep en stoofpot/);
    expect(weerFactor({ aan: true, heeftBron: true, meting: null, maand: 10 }).stand).toBe(
      "geen-bron",
    );
    // Productie: geen bron, dus nooit een netwerkoproep.
    expect(kiesWeerAdapter("echt-project")).toBeNull();
  });

  it("uitgezet: weer telt niet, het seizoen wel", () => {
    const f = weerFactor({
      aan: false,
      heeftBron: true,
      meting: { temp: 30, regen: false },
      maand: 6,
    });
    expect(f.weer).toBeNull();
    expect(f.stand).toBe("uit");
    expect(f.tekst).toMatch(/uitgezet.*seizoen/);
  });

  it("warm → lichte gerechten; koud → warme; testgegevens gemarkeerd", () => {
    const warm = weerFactor({
      aan: true,
      heeftBron: true,
      meting: { temp: 28, regen: false, test: true },
      maand: 6,
    });
    expect(warm.tekst).toMatch(/28 °C; lichte, frisse gerechten/);
    expect(warm.test).toBe(true);
    expect(
      weerFactor({ aan: true, heeftBron: true, meting: { temp: 3, regen: false }, maand: 0 }).tekst,
    ).toMatch(/warme gerechten/);
  });

  it("de engine zet bij warm weer het lichte gerecht bovenaan; zonder weer niet", () => {
    expect(beveelAan(invoer({ temp: 23, regen: false }))[0]!.id).toBe("Lichte zomerse bowl");
    const zonder = beveelAan(invoer(null));
    expect(
      zonder
        .find((a) => a.id === "Lichte zomerse bowl")!
        .redenen.map((r) => r.tekst)
        .join(" "),
    ).not.toMatch(/°C/);
  });

  it("zelfde drempel als het weersignaal op Vandaag (22 °C)", () => {
    expect(weerSignaal({ temp: 22, regen: false })?.soort).toBe("warm");
    expect(weerSignaal({ temp: 21, regen: false })).toBeNull();
  });

  it("testbron 'geen' doet alsof er geen weer is (geen netwerk)", async () => {
    window.localStorage.setItem(TEST_WEER_SLEUTEL, "geen");
    expect(await new TestWeerAdapter().haal(new Date())).toBeNull();
    window.localStorage.setItem(TEST_WEER_SLEUTEL, "warm");
    expect((await new TestWeerAdapter().haal(new Date()))?.temp).toBe(28);
  });
});
