import { describe, expect, it } from "vitest";
import { GEEN_RECHTEN, schoonRechten } from "./deel-rechten";

describe("schoonRechten", () => {
  it("tekst 'false' of 'true' geeft géén recht (BUG-015)", () => {
    expect(schoonRechten({ recipes_view: "false", planner_edit: "true" })).toEqual(GEEN_RECHTEN);
  });
  it("getallen, objecten en arrays geven geen recht", () => {
    expect(schoonRechten({ recipes_view: 1, shopping_view: {}, planner_view: [] })).toEqual(
      GEEN_RECHTEN,
    );
  });
  it("echte booleans werken zoals voorheen", () => {
    expect(schoonRechten({ recipes_view: true, shopping_edit: true })).toMatchObject({
      recipes_view: true,
      shopping_edit: true,
      shopping_view: true, // bewerken impliceert bekijken
      planner_view: false,
    });
  });
  it("onbekende sleutels (bv. owner_id, status) worden genegeerd — geen mass assignment", () => {
    const uit = schoonRechten({ owner_id: "x", status: "accepted", recipes_edit: true });
    expect(Object.keys(uit).sort()).toEqual(Object.keys(GEEN_RECHTEN).sort());
    expect(uit.recipes_view).toBe(true);
  });
  it("null, undefined en tekst geven geen rechten", () => {
    expect(schoonRechten(null)).toEqual(GEEN_RECHTEN);
    expect(schoonRechten(undefined)).toEqual(GEEN_RECHTEN);
    expect(schoonRechten("alles")).toEqual(GEEN_RECHTEN);
  });
});
