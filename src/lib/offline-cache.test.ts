import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { dehydrate } from "@tanstack/react-query";
import { bruikbaar, MAX_LEEFTIJD_MS, moetBewaren } from "./offline-cache";

describe("offline-cache (P6: laatst bekende Week, Lijst en Vandaag)", () => {
  it("bewaart alleen lijst, weekmenu en dagmenu — geen voorkeuren of recepten", () => {
    expect(moetBewaren(["shopping", "lijst-1"])).toBe(true);
    expect(moetBewaren(["shopping-lists", "u"])).toBe(true);
    expect(moetBewaren(["meal-plan", "eigen", "u", "2026-11-16"])).toBe(true);
    expect(moetBewaren(["home-dagmenu", "u", "2026-11-19"])).toBe(true);
    expect(moetBewaren(["recipes"])).toBe(false);
    expect(moetBewaren(["persoonlijke-voeding", "u"])).toBe(false);
    expect(moetBewaren([])).toBe(false);
  });

  it("te oud, uit de toekomst of kapot = niet bruikbaar", () => {
    const nu = 1_800_000_000_000;
    const goed = JSON.stringify({ v: 1, op: nu - 1000, staat: { queries: [] } });
    expect(bruikbaar(goed, nu)).not.toBeNull();
    expect(
      bruikbaar(JSON.stringify({ v: 1, op: nu - MAX_LEEFTIJD_MS - 1, staat: {} }), nu),
    ).toBeNull();
    expect(bruikbaar(JSON.stringify({ v: 1, op: nu + 3_600_000, staat: {} }), nu)).toBeNull();
    expect(bruikbaar("{kapot", nu)).toBeNull();
    expect(bruikbaar(JSON.stringify({ v: 2, op: nu, staat: {} }), nu)).toBeNull();
    expect(bruikbaar(null, nu)).toBeNull();
  });

  it("dehydrate met de filter neemt alleen de bewaarde sleutels mee", () => {
    const qc = new QueryClient();
    qc.setQueryData(["shopping", "l1"], [{ id: "a", name: "melk" }]);
    qc.setQueryData(["recipes"], [{ id: "r" }]);
    const staat = dehydrate(qc, {
      shouldDehydrateQuery: (q) => q.state.status === "success" && moetBewaren(q.queryKey),
    });
    expect(staat.queries.map((q) => q.queryKey)).toEqual([["shopping", "l1"]]);
  });
});
