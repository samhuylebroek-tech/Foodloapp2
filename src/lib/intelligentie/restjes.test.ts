import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bewaarRestje,
  dagenOud,
  gekooktTekst,
  planRestje,
  restjes,
  restjeVeilig,
  verwijderRestje,
  voorTeStellenRestjes,
  zetRestjeTerug,
} from "./restjes";
import { restjesVoorWeek } from "./restjes-week";

const opslag = new Map<string, string>();
beforeEach(() => {
  opslag.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (s: string) => opslag.get(s) ?? null,
      setItem: (s: string, v: string) => void opslag.set(s, v),
    },
  };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const MAANDAG_19U = new Date(2026, 10, 9, 19).getTime();
const dagLater = (n: number, uur = 12) => new Date(2026, 10, 9 + n, uur).getTime();

describe("restjes (op het toestel)", () => {
  it("bewaren, per gebruiker, nieuwste eerst", () => {
    bewaarRestje("u1", { titel: "Soep", receptId: "r1", porties: 2 }, MAANDAG_19U);
    bewaarRestje("u1", { titel: "Stoofvlees", receptId: "r2", porties: 3 }, dagLater(1, 19));
    expect(restjes("u1", dagLater(1, 20)).map((r) => r.titel)).toEqual(["Stoofvlees", "Soep"]);
    expect(restjes("u2", dagLater(1, 20))).toEqual([]);
    expect(restjes(null)).toEqual([]);
  });
  it("hooguit 3 dagen voorgesteld; na een week opgeruimd", () => {
    bewaarRestje("u1", { titel: "Soep", receptId: "r1", porties: 2 }, MAANDAG_19U);
    expect(voorTeStellenRestjes("u1", dagLater(3))).toHaveLength(1);
    expect(voorTeStellenRestjes("u1", dagLater(4))).toHaveLength(0);
    expect(restjes("u1", dagLater(4))).toHaveLength(1);
    expect(restjes("u1", dagLater(8))).toHaveLength(0);
  });
  it("opnieuw tikken op dezelfde dag past de porties aan (geen dubbel)", () => {
    bewaarRestje("u1", { titel: "Soep", receptId: "r1", porties: 2 }, MAANDAG_19U);
    bewaarRestje("u1", { titel: "Soep", receptId: "r1", porties: 4 }, MAANDAG_19U + 60000);
    const l = restjes("u1", MAANDAG_19U + 120000);
    expect(l).toHaveLength(1);
    expect(l[0]!.porties).toBe(4);
  });
  it("verwijderen en terugzetten (ongedaan maken)", () => {
    const r = bewaarRestje("u1", { titel: "Soep", receptId: null, porties: 1 }, MAANDAG_19U);
    const weg = verwijderRestje("u1", r.id);
    expect(restjes("u1", MAANDAG_19U)).toEqual([]);
    zetRestjeTerug("u1", weg!);
    expect(restjes("u1", MAANDAG_19U)).toEqual([r]);
  });
  it("porties tussen 1 en 12; tekst per dag", () => {
    expect(bewaarRestje("u1", { titel: "X", receptId: null, porties: 40 }).porties).toBe(12);
    expect(gekooktTekst({ gekookt: MAANDAG_19U }, dagLater(0, 22))).toBe("vandaag gekookt");
    expect(gekooktTekst({ gekookt: MAANDAG_19U }, dagLater(1, 8))).toBe("gisteren gekookt");
    expect(gekooktTekst({ gekookt: MAANDAG_19U }, dagLater(2))).toBe("2 dagen geleden gekookt");
    expect(dagenOud({ gekookt: MAANDAG_19U }, dagLater(3))).toBe(3);
  });
});

describe("restjes plannen, in Week en veilig", () => {
  it("ingepland = niet meer voorgesteld; ongedaan maken maakt het weer vrij", () => {
    const r = bewaarRestje("u1", { titel: "Soep", receptId: "r1", porties: 2 }, MAANDAG_19U);
    planRestje("u1", r.id, "2026-11-10");
    expect(voorTeStellenRestjes("u1", dagLater(1))).toHaveLength(0);
    expect(restjes("u1", dagLater(1))[0]!.gepland).toBe("2026-11-10");
    planRestje("u1", r.id, null);
    expect(voorTeStellenRestjes("u1", dagLater(1))).toHaveLength(1);
  });
  it("Week: oudste restje op de eerste lege dag waarop het nog goed is, één per dag", () => {
    const oud = bewaarRestje("u1", { titel: "Stoofvlees", receptId: "a", porties: 2 }, MAANDAG_19U);
    const nieuw = bewaarRestje("u1", { titel: "Soep", receptId: "b", porties: 2 }, dagLater(2, 19));
    const uit = restjesVoorWeek(
      [nieuw, oud],
      ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-20"],
    );
    expect(uit.map((u) => [u.datum, u.restje.titel])).toEqual([
      ["2026-11-11", "Stoofvlees"],
      ["2026-11-12", "Soep"],
    ]);
    // Na 3 dagen past het restje nergens meer.
    expect(restjesVoorWeek([oud], ["2026-11-13"])).toEqual([]);
    // Geen geregistreerde restjes = geen restjes.
    expect(restjesVoorWeek([], ["2026-11-11"])).toEqual([]);
  });
  it("veilig: zonder allergieën altijd; met allergieën alleen met bekende, veilige ingrediënten", () => {
    const r = { titel: "Spaghetti bolognese" };
    expect(restjeVeilig(r, undefined, {})).toBe(true);
    expect(restjeVeilig(r, undefined, { allergieen: ["selder"] })).toBe(false);
    expect(restjeVeilig(r, ["spaghetti", "gehakt"], { allergieen: ["gluten"] })).toBe(false);
    expect(restjeVeilig({ titel: "Soep" }, ["pompoen", "ui"], { allergieen: ["gluten"] })).toBe(
      true,
    );
    expect(restjeVeilig(r, ["spaghetti", "gehakt"], { dieet: "vegetarisch" })).toBe(false);
  });
});
