import { describe, expect, it } from "vitest";
import { seizoen, themas } from "./themas";
import type { InspiratieRecept } from "./inspiratie";

const r = (
  id: string,
  title: string,
  min: number,
  tags: string[] = [],
  category = "hoofdgerecht",
) =>
  ({
    id,
    title,
    description: "",
    image_url: null,
    servings: 4,
    prep_minutes: min,
    cook_minutes: 0,
    difficulty: "makkelijk",
    category,
    tags,
    instructions: [],
  }) satisfies InspiratieRecept;

describe("themas (Ontdek)", () => {
  const lijst = [
    r("1", "Romige pompoensoep", 35, ["vegetarisch"], "soep"),
    r("2", "Vlaamse stoverij", 180, ["vlees"]),
    r("3", "Pasta pesto", 20, ["vegetarisch"]),
    r("4", "Omelet met kruiden", 10, ["vegetarisch"]),
    r("5", "Zalm uit de oven", 25, ["vis"]),
    r("6", "Ovenschotel witloof", 120, ["vlees"]),
  ];
  it("seizoen volgt de maand", () => {
    expect(seizoen(10).id).toBe("winter");
    expect(seizoen(0).id).toBe("winter");
    expect(seizoen(3).id).toBe("lente");
    expect(seizoen(6).id).toBe("zomer");
    expect(seizoen(8).id).toBe("herfst");
  });
  it("bouwt thema's met minstens 2 recepten, elk met de juiste recepten", () => {
    const t = themas(lijst, 10);
    const per = Object.fromEntries(t.map((x) => [x.id, x.recepten.map((y) => y.id).sort()]));
    expect(per["winter"]).toEqual(["1", "2", "6"]);
    expect(per["snel"]).toEqual(["3", "4", "5"]);
    expect(per["weekend"]).toEqual(["2", "6"]);
    expect(t.every((x) => x.recepten.length >= 2)).toBe(true);
  });
  it("Nu in het seizoen: concrete producten van bij ons, per maand", () => {
    const nov = themas(lijst, 10).find((x) => x.id === "van-bij-ons");
    expect(nov?.recepten.map((y) => y.id).sort()).toEqual(["1", "6"]);
    expect(nov?.uitleg).toMatch(/^Van bij ons: witloof, pompoen/);
    // In mei geen pompoen of witloof: het thema verdwijnt (minder dan 2 recepten).
    expect(themas(lijst, 4).find((x) => x.id === "van-bij-ons")).toBeUndefined();
  });
  it("lege catalogus: geen thema's (de pagina toont dan de eigen keuken)", () => {
    expect(themas([], 10)).toEqual([]);
  });
});
