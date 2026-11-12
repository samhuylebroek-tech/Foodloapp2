import { describe, expect, it } from "vitest";
import type { Geschiedenis } from "./geschiedenis";
import type { Kandidaat, Voorkeur } from "./voorstel";
import { vulAan, type VulAanInvoer } from "./vul-aan";

const leeg: Geschiedenis = { laatst: {}, komend: new Set(), minutenPerWeekdag: {} };
const k = (id: string, extra: Partial<Kandidaat> = {}): Kandidaat => ({
  id,
  title: id,
  minuten: 25,
  category: "hoofdgerecht",
  tags: [],
  ingredienten: ["ui"],
  ...extra,
});
const gewoon: Voorkeur = { maxMinuten: 0, soort: null, vermijd: "" };
const invoer = (extra: Partial<VulAanInvoer> = {}): VulAanInvoer => ({
  // Donderdag 12, vrijdag 13, zaterdag 14 november 2026.
  dagen: ["2026-11-12", "2026-11-13", "2026-11-14"],
  kandidaten: [
    k("Stoemp met prei", { ingredienten: ["prei", "aardappel"] }),
    k("Pasta"),
    k("Curry"),
  ],
  voorraad: ["ui"],
  geschiedenis: leeg,
  voorkeurVoor: () => gewoon,
  ...extra,
});

describe("vulAan (Week: vul aan met voorstellen)", () => {
  it("één voorstel per lege dag, nooit twee keer hetzelfde gerecht", () => {
    const uit = vulAan(invoer());
    expect(uit.map((u) => u.datum)).toEqual(["2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(new Set(uit.map((u) => u.aanbeveling.id)).size).toBe(3);
    for (const u of uit) expect(u.aanbeveling.redenen.length).toBeGreaterThan(0);
  });
  it("wat deze week al gepland staat, komt niet terug", () => {
    const uit = vulAan(invoer({ alGepland: new Set(["Pasta"]) }));
    expect(uit.map((u) => u.aanbeveling.id)).not.toContain("Pasta");
    expect(uit).toHaveLength(2);
  });
  it("hooguit `max` dagen, de eerste eerst", () => {
    expect(vulAan(invoer({ max: 1 })).map((u) => u.datum)).toEqual(["2026-11-12"]);
  });
  it("voorkeur per weekdag: op vrijdag (4) max 20 min", () => {
    const uit = vulAan(
      invoer({
        dagen: ["2026-11-13"],
        kandidaten: [k("Lang", { minuten: 90 }), k("Snel", { minuten: 15 })],
        voorkeurVoor: (wd) => (wd === 4 ? { ...gewoon, maxMinuten: 20 } : gewoon),
      }),
    );
    expect(uit[0]?.aanbeveling.id).toBe("Snel");
  });
  it("seizoen per dag: prei in november geeft de reden", () => {
    const uit = vulAan(invoer({ max: 3 }));
    const stoemp = uit.find((u) => u.aanbeveling.id === "Stoemp met prei");
    expect(stoemp?.aanbeveling.redenen.map((r) => r.tekst).join(" · ")).toMatch(
      /Prei is nu in het seizoen/,
    );
  });
  it("harde regels: allergeen nooit, en met allergieën geen recept zonder ingrediënten", () => {
    const uit = vulAan(
      invoer({
        kandidaten: [
          k("Spaghetti", { ingredienten: ["spaghetti", "tomaat"] }),
          k("Zonder lijst", { ingredienten: [] }),
          k("Linzensoep", { ingredienten: ["linzen", "ui"] }),
        ],
        allergieen: ["gluten"],
      }),
    );
    expect(uit.map((u) => u.aanbeveling.id)).toEqual(["Linzensoep"]);
  });
  it("Niet nu wordt gerespecteerd", () => {
    const uit = vulAan(invoer({ nietNu: ["Curry", "Pasta"] }));
    expect(uit.map((u) => u.aanbeveling.id)).toEqual(["Stoemp met prei"]);
  });
  it("weer per dag (later I-3) kan meegegeven worden", () => {
    const uit = vulAan(
      invoer({
        dagen: ["2026-11-12"],
        kandidaten: [
          k("Pompoensoep", { ingredienten: ["ui"], minuten: 40 }),
          k("Salade", { minuten: 40 }),
        ],
        voorraad: [],
        weerVoor: () => ({ temp: 3, regen: true }),
      }),
    );
    expect(uit[0]?.aanbeveling.id).toBe("Pompoensoep");
  });
});
