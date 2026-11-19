import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  conflictTekst,
  controleer,
  dagNaam,
  itemConflictTekst,
  itemVingerafdruk,
  MenuConflict,
  planVingerafdruk,
  voegItemsSamen,
  wieTekst,
} from "./conflict";

// Kleine nep-client voor meal_plan: genoeg voor leesPlan + update in kringloop-db.
const tabel: Record<string, Record<string, unknown>[]> = { meal_plan: [] };
function bouwer(naam: string) {
  const filters: [string, unknown][] = [];
  let update: Record<string, unknown> | null = null;
  let wis = false;
  const rijen = () => (tabel[naam] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    limit: () => q,
    update: (u: Record<string, unknown>) => ((update = u), q),
    delete: () => ((wis = true), q),
    then: (ok: (r: unknown) => void) => {
      if (update) for (const r of rijen()) Object.assign(r, update);
      if (wis) tabel[naam] = (tabel[naam] ?? []).filter((r) => !rijen().includes(r));
      ok({ data: update || wis ? null : rijen().map((r) => ({ ...r })), error: null });
    },
  };
  return q;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (n: string) => bouwer(n) },
}));

const woensdag = {
  id: "p1",
  plan_date: "2026-11-18",
  meal_type: "avondeten",
  recipe_id: "stoofvlees",
  custom_title: null,
  personen: 4,
  soort: null,
  group_id: "g1",
  user_id: "marie",
};

describe("vingerafdruk en controle", () => {
  it("zelfde versie → doorgaan", () => {
    const v = planVingerafdruk(woensdag);
    expect(controleer(v, planVingerafdruk({ ...woensdag }))).toEqual({ soort: "door" });
  });
  it("andere versie → conflict", () => {
    const v = planVingerafdruk(woensdag);
    expect(controleer(v, planVingerafdruk({ ...woensdag, recipe_id: "lasagne" }))).toEqual({
      soort: "conflict",
    });
    expect(controleer(v, planVingerafdruk({ ...woensdag, personen: 2 }))).toEqual({
      soort: "conflict",
    });
  });
  it("rij weg → weg; zonder verwachte versie geen controle", () => {
    expect(controleer(planVingerafdruk(woensdag), null)).toEqual({ soort: "weg" });
    expect(controleer(undefined, planVingerafdruk(woensdag))).toEqual({ soort: "door" });
    expect(controleer(undefined, null)).toEqual({ soort: "door" });
  });
  it("afvinken telt niet als conflict bij een lijst-item, hoofdletters en spaties ook niet", () => {
    const a = itemVingerafdruk({ id: "i", name: "Melk ", quantity: 1, unit: "l", note: null });
    const b = itemVingerafdruk({ id: "i", name: "melk", quantity: 1, unit: "l", note: "" });
    expect(a).toBe(b);
    expect(itemVingerafdruk({ id: "i", name: "melk", quantity: 2, unit: "l" })).not.toBe(a);
  });
});

describe("teksten", () => {
  it("noemt wie, welke dag en wat", () => {
    expect(dagNaam("2026-11-18")).toBe("woensdag");
    expect(conflictTekst({ wie: "Jan Peeters", datum: "2026-11-18", titel: "Lasagne" })).toBe(
      "Jan veranderde woensdag net in Lasagne",
    );
    expect(conflictTekst({ wie: null, datum: "2026-11-18", titel: null })).toBe(
      "Iemand anders haalde woensdag net uit het menu",
    );
    expect(wieTekst("  ")).toBe("Iemand anders");
  });
  it("lijst-item: Belgische komma, en weggehaald", () => {
    expect(
      itemConflictTekst({
        wie: "Jan",
        mijnNaam: "melk",
        huidig: { id: "i", name: "melk", quantity: 1.5, unit: "l" },
      }),
    ).toBe("Jan veranderde melk net in 1,5 l melk");
    expect(itemConflictTekst({ wie: "Jan", mijnNaam: "melk", huidig: null })).toBe(
      "Jan haalde melk net van de lijst",
    );
  });
});

describe("samenvoegen (Bekijk allebei)", () => {
  it("zelfde product: grootste hoeveelheid en beide notities", () => {
    expect(
      voegItemsSamen(
        { name: "melk", quantity: 2, unit: "l", note: "halfvol" },
        { id: "i", name: "Melk", quantity: 1, unit: "l", note: "bio" },
      ),
    ).toEqual({ name: "Melk", quantity: 2, unit: "l", note: "halfvol · bio" });
  });
  it("ander product of andere eenheid: niet samenvoegen", () => {
    expect(
      voegItemsSamen(
        { name: "melk", quantity: 2, unit: "l" },
        { id: "i", name: "melk", quantity: 1, unit: "pak" },
      ),
    ).toBeNull();
    expect(
      voegItemsSamen(
        { name: "havermelk", quantity: 1, unit: "l" },
        { id: "i", name: "melk", quantity: 1, unit: "l" },
      ),
    ).toBeNull();
  });
});

describe("kringloop-db: planVervang en planVerplaats met verwachte versie", () => {
  beforeEach(() => {
    tabel["meal_plan"] = [{ ...woensdag }];
  });
  it("niemand anders veranderde iets → wordt geschreven, en herstel zet terug", async () => {
    const { planVervang } = await import("@/lib/kringloop-db");
    const r = await planVervang("p1", "pasta", planVingerafdruk(woensdag))();
    expect(tabel["meal_plan"]![0]!["recipe_id"]).toBe("pasta");
    await r.herstel();
    expect(tabel["meal_plan"]![0]!["recipe_id"]).toBe("stoofvlees");
  });
  it("Jan veranderde woensdag intussen → MenuConflict met zijn versie, niets geschreven", async () => {
    const { planVervang } = await import("@/lib/kringloop-db");
    const gezien = planVingerafdruk(woensdag);
    tabel["meal_plan"]![0]!["recipe_id"] = "lasagne"; // Jan, op een ander toestel
    const fout = await planVervang("p1", "pasta", gezien)().catch((e: unknown) => e);
    expect(fout).toBeInstanceOf(MenuConflict);
    expect((fout as MenuConflict).huidig?.recipe_id).toBe("lasagne");
    expect(tabel["meal_plan"]![0]!["recipe_id"]).toBe("lasagne");
  });
  it("Zet de mijne (zonder controle) → één herstel zet de versie van Jan terug", async () => {
    const { planVervang } = await import("@/lib/kringloop-db");
    tabel["meal_plan"]![0]!["recipe_id"] = "lasagne";
    const r = await planVervang("p1", "pasta")();
    expect(tabel["meal_plan"]![0]!["recipe_id"]).toBe("pasta");
    await r.herstel();
    expect(tabel["meal_plan"]![0]!["recipe_id"]).toBe("lasagne");
  });
  it("weggehaald door iemand anders → MenuConflict zonder versie", async () => {
    const { planVerplaats } = await import("@/lib/kringloop-db");
    const gezien = planVingerafdruk(woensdag);
    tabel["meal_plan"] = [];
    const fout = await planVerplaats("p1", "2026-11-19", "avondeten", gezien)().catch(
      (e: unknown) => e,
    );
    expect(fout).toBeInstanceOf(MenuConflict);
    expect((fout as MenuConflict).huidig).toBeNull();
  });
});
