import { describe, expect, it } from "vitest";
import {
  berekenAanvulling,
  gebruiktUitVoorraad,
  korteDag,
  lijstWijzigingen,
  verbruik,
  voorraadNaKoop,
} from "./kringloop";

const recepten = [
  { id: "r1", title: "Stoofvlees", servings: 4 },
  { id: "r2", title: "Soep", servings: 2 },
];
const ingredienten = [
  { recipe_id: "r1", name: "rundvlees", quantity: 1000, unit: "g" },
  { recipe_id: "r1", name: "uien", quantity: 3, unit: "" },
  { recipe_id: "r1", name: "zout", quantity: null, unit: "" },
  { recipe_id: "r1", name: "donker bier", quantity: 50, unit: "cl" },
  { recipe_id: "r2", name: "ui", quantity: 1, unit: "" },
  { recipe_id: "r2", name: "pompoen", quantity: 1, unit: "" },
];

describe("berekenAanvulling", () => {
  it("telt alleen komende maaltijden, schaalt porties en voegt gelijke producten samen (K1)", () => {
    const a = berekenAanvulling({
      plan: [
        { plan_date: "2026-11-08", recipe_id: "r1", personen: 4 }, // voorbij
        { plan_date: "2026-11-10", recipe_id: "r1", personen: 2 },
        { plan_date: "2026-11-11", recipe_id: "r2", personen: 4 },
      ],
      recepten,
      ingredienten,
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-09",
    });
    expect(a.aantalGerechten).toBe(2);
    const vlees = a.kopen.find((r) => r.naam === "rundvlees");
    expect(vlees?.quantity).toBe(500);
    const ui = a.kopen.find((r) => /^ui/.test(r.naam));
    expect(ui?.quantity).toBe(1.5 + 2); // 3 × 2/4 + 1 × 4/2
    expect(ui?.voor.map((v) => v.titel)).toEqual(["Stoofvlees", "Soep"]);
  });

  it("zet voorraad apart en voegt niet opnieuw toe wat al op de lijst staat (K2)", () => {
    const a = berekenAanvulling({
      plan: [{ plan_date: "2026-11-10", recipe_id: "r1", personen: 4 }],
      recepten,
      ingredienten,
      voorraad: ["uien"],
      lijst: [
        { name: "donker bier", checked: false },
        { name: "rundvlees", checked: true }, // al gekocht: telt niet als "op de lijst"
      ],
      vanaf: "2026-11-09",
    });
    expect(a.inHuis.map((r) => r.naam)).toEqual(["uien"]);
    expect(a.opLijst.map((r) => r.naam)).toEqual(["donker bier"]);
    expect(a.kopen.map((r) => r.naam)).toEqual(["rundvlees"]);
  });

  it("stelt nooit basis zoals zout voor (K3) en meldt maaltijden zonder recept", () => {
    const a = berekenAanvulling({
      plan: [
        { plan_date: "2026-11-10", recipe_id: "r1", personen: null },
        { plan_date: "2026-11-10", recipe_id: null, personen: null, custom_title: "Pizza" },
        {
          plan_date: "2026-11-11",
          recipe_id: null,
          personen: null,
          custom_title: "Uit eten",
          soort: "uit",
        },
      ],
      recepten,
      ingredienten,
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-09",
    });
    expect([...a.kopen, ...a.inHuis].some((r) => r.naam === "zout")).toBe(false);
    expect(a.zonderRecept).toEqual(["Pizza"]);
  });
});

describe("voorraadNaKoop", () => {
  it("telt op bij hetzelfde product (ook g bij kg), anders een nieuwe regel; basis niet", () => {
    const r = voorraadNaKoop(
      [
        { name: "Melk", quantity: 1, unit: "l" },
        { name: "melk", quantity: 1, unit: "l" },
        { name: "bloem", quantity: 500, unit: "g" },
        { name: "zout", quantity: 1, unit: "" },
        { name: "eieren", quantity: 6, unit: "" },
      ],
      [
        { id: "v1", naam: "melk", hoeveelheid: 1, eenheid: "l" },
        { id: "v2", naam: "bloem", hoeveelheid: 1, eenheid: "kg" },
      ],
    );
    // 500 g bloem telt nu op bij de bestaande 1 kg (zelfde familie), geen tweede regel.
    expect(r.bijwerken).toEqual([
      { id: "v1", hoeveelheid: 3 },
      { id: "v2", hoeveelheid: 1.5 },
    ]);
    expect(r.nieuw).toEqual([{ naam: "eieren", hoeveelheid: 6, eenheid: "" }]);
  });
});

describe("gebruiktUitVoorraad", () => {
  it("vindt voorraadproducten die in het recept voorkomen", () => {
    const v = [
      { id: "a", naam: "uien", hoeveelheid: 4, eenheid: "" },
      { id: "b", naam: "pompoen", hoeveelheid: 1, eenheid: "" },
      { id: "c", naam: "zout", hoeveelheid: null, eenheid: "" },
    ];
    expect(
      gebruiktUitVoorraad(["ui", "rundvlees (stoofvlees)", "zout"], v).map((x) => x.id),
    ).toEqual(["a"]);
  });
});

describe("korteDag", () => {
  it("vandaag, morgen of een korte weekdag", () => {
    expect(korteDag("2026-11-09", "2026-11-09")).toBe("vandaag");
    expect(korteDag("2026-11-10", "2026-11-09")).toBe("morgen");
    expect(korteDag("2026-11-11", "2026-11-09")).toBe("wo");
  });
});

describe("hoeveelheidsbewust aanvullen (randgevallen)", () => {
  const basis = {
    recepten: [
      { id: "a", title: "Pannenkoeken", servings: 4 },
      { id: "b", title: "Wafels", servings: 4 },
    ],
    ingredienten: [
      { recipe_id: "a", name: "bloem", quantity: 250, unit: "g" },
      { recipe_id: "a", name: "melk", quantity: 5, unit: "dl" },
      { recipe_id: "b", name: "bloem", quantity: 0.25, unit: "kg" },
      { recipe_id: "b", name: "olijfolie", quantity: 2, unit: "el" },
    ],
    plan: [
      { plan_date: "2026-11-10", recipe_id: "a", personen: 4 },
      { plan_date: "2026-11-11", recipe_id: "b", personen: 4 },
    ],
    vanaf: "2026-11-09",
  };

  it("telt overlappende ingrediënten over eenheden heen op (g + kg)", () => {
    const a = berekenAanvulling({ ...basis, voorraad: [], lijst: [] });
    const bloem = a.kopen.find((r) => r.naam === "bloem");
    expect(bloem?.quantity).toBe(500);
    expect(bloem?.unit).toBe("g");
    expect(bloem?.voor.map((v) => v.titel)).toEqual(["Pannenkoeken", "Wafels"]);
  });

  it("gedeeltelijke voorraad: alleen het tekort kopen, met uitleg", () => {
    const a = berekenAanvulling({
      ...basis,
      voorraad: [{ id: "v", naam: "bloem", hoeveelheid: 200, eenheid: "g" }],
      lijst: [],
    });
    const bloem = a.kopen.find((r) => r.naam === "bloem");
    expect(bloem?.quantity).toBe(300);
    expect(bloem?.inHuisDeels).toBe("200 g");
  });

  it("genoeg in huis (andere eenheid): niets kopen", () => {
    const a = berekenAanvulling({
      ...basis,
      voorraad: [
        { id: "v", naam: "bloem", hoeveelheid: 1, eenheid: "kg" },
        { id: "o", naam: "olijfolie", hoeveelheid: 1, eenheid: "l" },
      ],
      lijst: [],
    });
    expect(a.inHuis.map((r) => r.naam).sort()).toEqual(["bloem", "olijfolie"]);
  });

  it("deels al op de lijst: alleen het tekort, en dubbel aanvullen voegt niets meer toe", () => {
    const lijst = [{ id: "l1", name: "melk", checked: false, quantity: 25, unit: "cl" }];
    const a = berekenAanvulling({ ...basis, voorraad: [], lijst });
    const melk = a.kopen.find((r) => r.naam === "melk");
    expect(melk?.quantity).toBe(2.5); // 5 dl nodig − 25 cl op de lijst = 2,5 dl
    expect(melk?.unit).toBe("dl");
    // Tweede keer, nadat het tekort bijgeteld is: alles gedekt.
    const b = berekenAanvulling({
      ...basis,
      voorraad: [],
      lijst: [{ id: "l1", name: "melk", checked: false, quantity: 50, unit: "cl" }],
    });
    expect(b.kopen.some((r) => r.naam === "melk")).toBe(false);
    expect(b.opLijst.some((r) => r.naam === "melk")).toBe(true);
  });

  it("bijtellen bij een open lijstregel in plaats van een tweede regel", () => {
    const lijst = [{ id: "l1", name: "melk", checked: false, quantity: 25, unit: "cl" }];
    const a = berekenAanvulling({ ...basis, voorraad: [], lijst });
    const w = lijstWijzigingen(a.kopen, lijst);
    expect(w.bijtellen).toEqual([{ id: "l1", quantity: 50, oud: 25 }]);
    expect(w.nieuw.map((r) => r.naam).sort()).toEqual(["bloem", "olijfolie"]);
  });

  it("gerecht niet meer gepland: zijn open lijstregels zijn 'niet meer nodig'", () => {
    const a = berekenAanvulling({
      ...basis,
      voorraad: [],
      lijst: [
        { id: "x", name: "spinazie", checked: false, recipe_id: "weg" },
        { id: "y", name: "brood", checked: false, recipe_id: null },
        { id: "z", name: "kip", checked: true, recipe_id: "weg" },
      ],
    });
    expect(a.nietMeerNodig).toEqual([{ id: "x", naam: "spinazie" }]);
  });
});

describe("verbruik na het koken", () => {
  const voorraad = [
    { id: "r", naam: "rundvlees", hoeveelheid: 1, eenheid: "kg" },
    { id: "u", naam: "uien", hoeveelheid: 4, eenheid: "" },
    { id: "o", naam: "olijfolie", hoeveelheid: 1, eenheid: "l" },
    { id: "k", naam: "kaas", hoeveelheid: null, eenheid: "" },
    { id: "p", naam: "peterselie", hoeveelheid: 1, eenheid: "bos" },
  ];
  it("trekt af in dezelfde familie, zet op wat op is, laat onzekere dingen staan", () => {
    const r = verbruik(
      [
        { name: "rundvlees (stoofvlees)", quantity: 1000, unit: "g" },
        { name: "ui", quantity: 3, unit: "" },
        { name: "olijfolie", quantity: 2, unit: "el" },
        { name: "geraspte kaas", quantity: 100, unit: "g" },
        { name: "peterselie", quantity: 2, unit: "takjes" },
        { name: "zout", quantity: 1, unit: "snuf" },
      ],
      voorraad,
    );
    expect(r.op.map((v) => v.id)).toEqual(["r"]);
    expect(r.bijwerken).toEqual([
      { id: "u", naam: "uien", hoeveelheid: 1, oud: 4 },
      { id: "o", naam: "olijfolie", hoeveelheid: 0.97, oud: 1 },
    ]);
  });
  it("schaalt mee met het aantal personen", () => {
    const r = verbruik([{ name: "rundvlees", quantity: 1000, unit: "g" }], voorraad, 0.5);
    expect(r.bijwerken).toEqual([{ id: "r", naam: "rundvlees", hoeveelheid: 0.5, oud: 1 }]);
  });
});

describe("voorraadNaKoop over eenheden", () => {
  it("telt 500 g op bij 1 kg", () => {
    const r = voorraadNaKoop(
      [{ name: "bloem", quantity: 500, unit: "g" }],
      [{ id: "b", naam: "bloem", hoeveelheid: 1, eenheid: "kg" }],
    );
    expect(r.bijwerken).toEqual([{ id: "b", hoeveelheid: 1.5 }]);
  });
});

describe("toonbare eenheden", () => {
  it("houdt de eenheid van het recept als die overal dezelfde is (1 tl, niet 5 ml)", () => {
    const a = berekenAanvulling({
      plan: [{ plan_date: "2026-11-10", recipe_id: "s", personen: 2 }],
      recepten: [{ id: "s", title: "Soep", servings: 2 }],
      ingredienten: [{ recipe_id: "s", name: "gember", quantity: 1, unit: "tl" }],
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-09",
    });
    expect(a.kopen[0]).toMatchObject({ naam: "gember", quantity: 1, unit: "tl" });
  });
});
