import { describe, expect, it } from "vitest";
import type { HuishoudenLid, LidVoeding } from "./gezin-veiligheid";
import { LEGE_VOEDING } from "./persoonlijke-voeding";
import {
  etiketVoorEters,
  namenLijst,
  nietGeschikt,
  oordelenVoor,
  veiligVoorEters,
  voorWieTekst,
  type EtersContext,
} from "./voorstel-eters";

const MARIE = "11111111-1111-4111-8111-111111111111";
const JAN = "22222222-2222-4222-8222-222222222222";

const lid = (id: string, naam: string, extra: Partial<HuishoudenLid> = {}): HuishoudenLid => ({
  id,
  group_id: "g",
  naam,
  user_id: null,
  rol: "kind",
  beheerder_id: JAN,
  ...extra,
});
const voeding = (lidId: string, v: Partial<LidVoeding>): LidVoeding => ({
  ...LEGE_VOEDING,
  lid_id: lidId,
  delen_met_gezin: false,
  toestemming_door: JAN,
  toestemming_soort: "beheerder",
  toestemming_op: "2026-11-14T10:00:00Z",
  ...v,
});

const lotte = lid("l", "Lotte");
const gust = lid("g", "Gust", { rol: "volwassene", beheerder_id: MARIE });
const marie = lid("m", "Marie", { user_id: MARIE, beheerder_id: MARIE, rol: "volwassene" });

const ctx = (extra: Partial<EtersContext> = {}): EtersContext => ({
  eters: [marie, lotte, gust],
  voeding: new Map([
    ["l", voeding("l", { allergieen: ["noten"] })],
    ["g", voeding("g", { dieet: "vegetarisch", delen_met_gezin: true })],
  ]),
  kijkerId: MARIE,
  ...extra,
});

const pesto = {
  id: "p",
  title: "Pasta met hazelnootpesto",
  ingredienten: ["spaghetti", "hazelnoten"],
};
const stoof = { id: "s", title: "Stoofvlees", ingredienten: ["rundvlees", "bier"] };
const soep = { id: "o", title: "Pompoensoep", ingredienten: ["pompoen", "ui"] };

describe("voorstellen per mee-eter", () => {
  it("noemt een niet-gedeelde allergie zonder reden", () => {
    const e = etiketVoorEters(oordelenVoor(pesto, ctx()));
    expect(e).toBe("Niet geschikt voor Lotte");
    expect(e).not.toMatch(/noten/);
  });

  it("toont de reden alleen als het lid die deelt", () => {
    expect(etiketVoorEters(oordelenVoor(stoof, ctx()))).toBe(
      "Niet geschikt voor Gust (Gust: past niet bij vegetarisch)",
    );
  });

  it("filtert onveilige gerechten weg en telt ze", () => {
    const r = veiligVoorEters([pesto, stoof, soep], (x) => x, ctx());
    expect(r.veilig.map((x) => x.id)).toEqual(["o"]);
    expect(r.weggelaten).toBe(2);
  });

  it("zonder mee-eters verandert er niets", () => {
    const r = veiligVoorEters([pesto, stoof], (x) => x, ctx({ eters: [] }));
    expect(r.veilig).toHaveLength(2);
    expect(nietGeschikt(pesto, ctx({ eters: [] }))).toBe(false);
  });

  it("alleen de gekozen eters tellen", () => {
    expect(nietGeschikt(pesto, ctx({ eters: [marie, gust] }))).toBe(false);
    expect(nietGeschikt(stoof, ctx({ eters: [marie, lotte] }))).toBe(false);
  });

  it("gebruikt het serveroordeel voor leden die je niet mag lezen", () => {
    const zonder = ctx({ voeding: new Map() });
    expect(nietGeschikt(soep, zonder)).toBe(false);
    const metServer = ctx({ voeding: new Map(), server: { o: new Map([["l", false]]) } });
    expect(etiketVoorEters(oordelenVoor(soep, metServer))).toBe("Niet geschikt voor Lotte");
  });

  it("schrijft namen in gewone taal", () => {
    expect(namenLijst(["Lotte"])).toBe("Lotte");
    expect(namenLijst(["Lotte", "Gust"])).toBe("Lotte en Gust");
    expect(namenLijst(["Lotte", "Gust", "Jan"])).toBe("Lotte, Gust en Jan");
    expect(voorWieTekst([])).toBeNull();
    expect(voorWieTekst([{ naam: "Lotte" }, { naam: "Gust" }])).toBe(
      "Rekening gehouden met Lotte en Gust",
    );
  });
});
