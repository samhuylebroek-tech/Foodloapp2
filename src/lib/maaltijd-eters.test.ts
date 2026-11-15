import { beforeEach, describe, expect, it } from "vitest";
import {
  bewaarToestelEters,
  etersVoorMaaltijd,
  leesToestelEters,
  metEigenRegels,
  plannenVoorProduct,
  wisselEter,
  zonderEter,
} from "./maaltijd-eters";
import { LEGE_VOEDING } from "./persoonlijke-voeding";

const leden = [
  { id: "m", naam: "Marie" },
  { id: "j", naam: "Jan" },
  { id: "g", naam: "Gust" },
];

describe("wie eet mee per maaltijd", () => {
  it("niets bewaard = het hele huishouden", () => {
    expect(etersVoorMaaltijd(leden, null).map((l) => l.id)).toEqual(["m", "j", "g"]);
    expect(etersVoorMaaltijd(leden, []).map((l) => l.id)).toEqual(["m", "j", "g"]);
  });
  it("bewaard = alleen die leden; verdwenen leden vallen weg", () => {
    expect(etersVoorMaaltijd(leden, ["m", "g"]).map((l) => l.id)).toEqual(["m", "g"]);
    expect(etersVoorMaaltijd(leden, ["weg"]).map((l) => l.id)).toEqual(["m", "j", "g"]);
  });
  it("wisselen en 'eet niet mee', nooit niemand", () => {
    expect(wisselEter(["m", "j"], "g")).toEqual(["m", "j", "g"]);
    expect(wisselEter(["m", "j"], "j")).toEqual(["m"]);
    expect(wisselEter(["m"], "m")).toEqual(["m"]);
    expect(zonderEter(["m", "j", "g"], "g")).toEqual(["m", "j"]);
  });
});

describe("terugval op het toestel", () => {
  beforeEach(() => {
    const opslag = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (k: string) => opslag.get(k) ?? null,
          setItem: (k: string, v: string) => void opslag.set(k, v),
          removeItem: (k: string) => void opslag.delete(k),
        },
      },
    });
  });
  it("bewaart per maaltijd en wist bij 'standaard'", () => {
    bewaarToestelEters("u", "p1", ["m", "j"]);
    bewaarToestelEters("u", "p2", ["m"]);
    expect(leesToestelEters("u")).toEqual({ p1: ["m", "j"], p2: ["m"] });
    bewaarToestelEters("u", "p1", null);
    expect(leesToestelEters("u")).toEqual({ p2: ["m"] });
    expect(leesToestelEters("ander")).toEqual({});
    expect(leesToestelEters(null)).toEqual({});
  });
  it("kapotte opslag geeft niets, geen fout", () => {
    window.localStorage.setItem("foodlo:maaltijd-eters:u", "{kapot");
    expect(leesToestelEters("u")).toEqual({});
  });
});

describe("product op de lijst → geplande maaltijden", () => {
  const plannen = [
    { id: "a", recipe_id: "stoof", ingredienten: ["rundvlees (stoofvlees)", "uien"] },
    { id: "b", recipe_id: "soep", ingredienten: ["pompoen", "ui"] },
  ];
  it("eerst via het recept, anders via hetzelfde product", () => {
    expect(plannenVoorProduct("uien", "stoof", plannen)).toEqual(["a"]);
    expect(plannenVoorProduct("rundvlees (stoofvlees)", null, plannen)).toEqual(["a"]);
    expect(plannenVoorProduct("koffie", null, plannen)).toEqual([]);
  });
});

describe("eigen regels voor jouw lid", () => {
  it("vult jouw allergie in als je geen lid-voeding hebt; overschrijft niets", () => {
    const leeg = new Map();
    const m = metEigenRegels(leeg, { id: "m" }, "u", { allergieen: ["noten"], dieet: null });
    expect(m.get("m")?.allergieen).toEqual(["noten"]);
    expect(metEigenRegels(leeg, { id: "m" }, "u", { allergieen: [] })).toBe(leeg);
    const bestaand = new Map([
      [
        "m",
        {
          ...LEGE_VOEDING,
          lid_id: "m",
          delen_met_gezin: false,
          toestemming_door: "u",
          toestemming_soort: "zelf" as const,
          toestemming_op: "",
        },
      ],
    ]);
    expect(metEigenRegels(bestaand, { id: "m" }, "u", { allergieen: ["noten"] })).toBe(bestaand);
  });
});
