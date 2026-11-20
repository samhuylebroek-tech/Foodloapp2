import { describe, expect, it } from "vitest";
import { valideerReactie, zichtbareBijdragen } from "./makers";
import { isCommunityFotoPad } from "./community-foto";

const IK = "11111111-1111-4111-8111-111111111111";
const JAN = "22222222-2222-4222-8222-222222222222";
const GUST = "9a9a9a9a-0000-4000-8000-000000000003";

describe("zichtbareBijdragen", () => {
  const rijen = [
    { id: "1", user_id: JAN, verborgen: false },
    { id: "2", user_id: GUST, verborgen: true },
    { id: "3", user_id: IK, verborgen: true },
    { id: "4", user_id: GUST, verborgen: false },
  ];
  it("zonder blokkades: alles behalve wat het team verborg (eigen blijft zichtbaar)", () => {
    const r = zichtbareBijdragen(rijen, IK, new Set());
    expect(r.zichtbaar.map((b) => b.id)).toEqual(["1", "3", "4"]);
    expect(r.weggelaten).toBe(0);
  });
  it("geblokkeerde mensen weg, met een teller (verborgen telt niet mee)", () => {
    const r = zichtbareBijdragen(rijen, IK, new Set([GUST]));
    expect(r.zichtbaar.map((b) => b.id)).toEqual(["1", "3"]);
    expect(r.weggelaten).toBe(1);
  });
  it("niet aangemeld: niets verborgens", () => {
    expect(zichtbareBijdragen(rijen, null, new Set()).zichtbaar.map((b) => b.id)).toEqual([
      "1",
      "4",
    ]);
  });
});

describe("valideerReactie", () => {
  it("kort en niet leeg", () => {
    expect(valideerReactie("Lekker!")).toBeNull();
    expect(valideerReactie(" a ")).toBe("Schrijf een korte reactie of vraag.");
    expect(valideerReactie("x".repeat(281))).toBe("Houd het kort: hoogstens 280 tekens.");
  });
});

describe("isCommunityFotoPad", () => {
  const goed = `${IK}/0b1c2d3e-0000-4000-8000-000000000001.jpg`;
  it("alleen een pad in je eigen map", () => {
    expect(isCommunityFotoPad(goed)).toBe(true);
    expect(isCommunityFotoPad(goed, IK)).toBe(true);
    expect(isCommunityFotoPad(goed, JAN)).toBe(false);
  });
  it("geen externe links, geen andere mappen, geen trucjes", () => {
    for (const fout of [
      "https://evil.example/x.jpg",
      `../${goed}`,
      `${IK}/../x.jpg`,
      `${IK}/x.svg`,
      "demo/pompoensoep.jpg",
      null,
      42,
    ])
      expect(isCommunityFotoPad(fout)).toBe(false);
  });
});
