import { describe, expect, it } from "vitest";
import type { HuishoudenLid, LidVoeding } from "./gezin-veiligheid";
import { LEGE_VOEDING } from "./persoonlijke-voeding";
import {
  beoordeel,
  etiketVoorEters,
  ingredientBotsing,
  kookWaarschuwingen,
  maaltijdOordeel,
  namenLijst,
  productOordeel,
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

describe("fase 1: één oordeel voor een maaltijd (hard / zacht)", () => {
  const jan = lid("j", "Jan", { user_id: JAN, beheerder_id: JAN, rol: "volwassene" });
  const metJan = (extra: Partial<EtersContext> = {}) =>
    ctx({
      eters: [marie, jan, lotte, gust],
      voeding: new Map([
        ["l", voeding("l", { allergieen: ["noten"] })],
        ["g", voeding("g", { dieet: "vegetarisch", delen_met_gezin: true })],
        ["j", voeding("j", { uitsluitingen: ["kokos"], delen_met_gezin: true })],
      ]),
      ...extra,
    });
  const kokossoep = { id: "k", title: "Pompoensoep", ingredienten: ["pompoen", "kokosmelk"] };

  it("hard: strikt dieet met gedeelde reden en het ingrediënt dat botst", () => {
    const o = maaltijdOordeel(stoof, metJan());
    expect(o.niveau).toBe("hard");
    expect(o.titel).toBe("Niet geschikt voor Gust");
    expect(o.hard[0]).toMatchObject({ naam: "Gust", reden: "past niet bij vegetarisch" });
    expect(ingredientBotsing("rundvlees", o)).toEqual({
      ernst: "hard",
      namen: ["Gust"],
      tekst: "Niet voor Gust",
    });
    expect(ingredientBotsing("bier", o)).toBeNull();
  });

  it("zacht: 'liever niet' blokkeert niets en ziet er anders uit", () => {
    const o = maaltijdOordeel(kokossoep, metJan());
    expect(o.niveau).toBe("zacht");
    expect(o.hard).toHaveLength(0);
    expect(o.titel).toBe("Liever niet voor Jan");
    expect(etiketVoorEters(oordelenVoor(kokossoep, metJan()))).toBe(
      "Liever niet voor Jan (Jan: liever geen kokos)",
    );
    // Een voorkeur filtert een voorstel niet weg.
    expect(nietGeschikt(kokossoep, metJan())).toBe(false);
    expect(veiligVoorEters([kokossoep], (x) => x, metJan()).veilig).toHaveLength(1);
    expect(ingredientBotsing("kokosmelk", o)?.ernst).toBe("zacht");
  });

  it("privacy: zonder gedeelde reden geen reden, geen ingrediënt, geen markering", () => {
    const o = maaltijdOordeel(pesto, metJan());
    expect(o.niveau).toBe("hard");
    expect(o.titel).toBe("Niet geschikt voor Lotte");
    expect(o.hard[0]!.reden).toBeUndefined();
    expect(o.hard[0]!.ingredienten).toBeUndefined();
    expect(ingredientBotsing("hazelnoten", o)).toBeNull();
    expect(JSON.stringify(o)).not.toMatch(/noten/);
    expect(kookWaarschuwingen(o)).toEqual([
      { ernst: "hard", tekst: "Let op: niet geschikt voor Lotte — Lotte eet mee" },
    ]);
    // De beheerder (Jan) mag de reden wel zien.
    const voorJan = maaltijdOordeel(pesto, metJan({ kijkerId: JAN }));
    expect(voorJan.hard[0]!.reden).toBe("bevat mogelijk noten");
    expect(ingredientBotsing("hazelnoten", voorJan)?.namen).toEqual(["Lotte"]);
  });

  it("meerdere eters: hard wint, zacht blijft erbij; kookstand noemt iedereen", () => {
    const g = { id: "x", title: "Kip met kokos", ingredienten: ["kipfilet", "kokosmelk"] };
    const o = maaltijdOordeel(g, metJan());
    expect(o.niveau).toBe("hard");
    expect(o.hard.map((e) => e.naam)).toEqual(["Gust"]);
    expect(o.zacht.map((e) => e.naam)).toEqual(["Jan"]);
    expect(kookWaarschuwingen(o).map((w) => w.tekst)).toEqual([
      "Let op: past niet bij vegetarisch — Gust eet mee",
      "Liever niet: liever geen kokos — Jan eet mee",
    ]);
  });

  it("wie niet meeëet, telt niet mee", () => {
    expect(maaltijdOordeel(stoof, metJan({ eters: [marie, jan, lotte] })).niveau).toBe("ok");
    expect(beoordeel([]).titel).toBeNull();
  });

  it("serveroordeel (niet leesbaar) is hard, zonder reden", () => {
    const o = maaltijdOordeel(
      soep,
      ctx({ voeding: new Map(), server: { o: new Map([["l", false]]) } }),
    );
    expect(o.niveau).toBe("hard");
    expect(o.hard[0]).toEqual({ lidId: "l", naam: "Lotte", veilig: false, ernst: "hard" });
  });

  it("boodschappen: product botst alleen met gedeelde reden", () => {
    const c = metJan();
    expect(productOordeel("rundvlees", c).titel).toBe("Niet geschikt voor Gust");
    // Lotte deelt niet: "hazelnoten" krijgt geen markering (zou haar allergie verraden).
    expect(productOordeel("hazelnoten", c).niveau).toBe("ok");
    expect(productOordeel("hazelnoten", { ...c, kijkerId: JAN }).niveau).toBe("hard");
    expect(productOordeel("kokosmelk", c).niveau).toBe("zacht");
    expect(productOordeel("melk", c).niveau).toBe("ok");
  });
});
