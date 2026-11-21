import { describe, expect, it } from "vitest";
import { geslotenUit } from "./makers-db";
import { rechtenUitMakerAbonnementen } from "./betalen/maker-abonnement";

const MAKER = { id: "c1", naam: "Kok Lisa", user_id: "lisa" };
const bronnen = new Map([
  ["exclusief", { maker: MAKER, publicatie: { exclusief: true } }],
  ["openbaar", { maker: MAKER, publicatie: { exclusief: false } }],
]);
const ids = ["exclusief", "openbaar", "eigen"];

describe("BUG-180: exclusief recept in het weekmenu na opzeggen", () => {
  it("zonder (lopend) abonnement: alleen het exclusieve recept is gesloten, met de makernaam", () => {
    const g = geslotenUit({
      ids,
      eigenaarVan: new Map(),
      bronnen,
      eigenaren: ["ik"],
      ik: "ik",
      rechten: [],
    });
    expect([...g.entries()]).toEqual([["exclusief", { maker: "Kok Lisa" }]]);
  });
  it("met een lopend abonnement: niets gesloten", () => {
    const rechten = rechtenUitMakerAbonnementen([
      { creator_id: "c1", status: "actief", periode_einde: "2999-01-01T00:00:00Z" },
    ]);
    expect(
      geslotenUit({ ids, eigenaarVan: new Map(), bronnen, eigenaren: [], ik: "ik", rechten }).size,
    ).toBe(0);
  });
  it("opgezegd of verlopen telt als geen abonnement", () => {
    const rechten = rechtenUitMakerAbonnementen([
      { creator_id: "c1", status: "actief", periode_einde: "2020-01-01T00:00:00Z" },
      { creator_id: "c1", status: "opgezegd", periode_einde: "2999-01-01T00:00:00Z" },
    ]);
    expect(
      geslotenUit({ ids, eigenaarVan: new Map(), bronnen, eigenaren: [], ik: "ik", rechten }).has(
        "exclusief",
      ),
    ).toBe(true);
  });
  it("de maker zelf, of een gezinslid van de maker, ziet het altijd", () => {
    expect(
      geslotenUit({ ids, eigenaarVan: new Map(), bronnen, eigenaren: [], ik: "lisa", rechten: [] })
        .size,
    ).toBe(0);
    expect(
      geslotenUit({
        ids,
        eigenaarVan: new Map([["exclusief", "lisa"]]),
        bronnen,
        eigenaren: ["lisa"],
        ik: "ik",
        rechten: [],
      }).size,
    ).toBe(0);
  });
});
