import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bewaarRestje,
  dagenOud,
  gekooktTekst,
  restjes,
  verwijderRestje,
  voorTeStellenRestjes,
  zetRestjeTerug,
} from "./restjes";

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
