import { describe, expect, it } from "vitest";
import { berekenAanvulling, gebruiktUitVoorraad, korteDag, voorraadNaKoop } from "./kringloop";

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
  it("telt op bij hetzelfde product en eenheid, anders een nieuwe regel; basis niet", () => {
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
    expect(r.bijwerken).toEqual([{ id: "v1", hoeveelheid: 3 }]);
    expect(r.nieuw).toEqual([
      { naam: "bloem", hoeveelheid: 500, eenheid: "g" },
      { naam: "eieren", hoeveelheid: 6, eenheid: "" },
    ]);
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
