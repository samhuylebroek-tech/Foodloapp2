import { describe, expect, it } from "vitest";
import { gewijzigdePosities, herschik, verzamelingLink, volgendePositie } from "./collecties";

describe("verzamelingen herschikken", () => {
  it("omhoog, omlaag en begrensd", () => {
    expect(herschik(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(herschik(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(herschik(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(herschik(["a", "b", "c"], 2, 9)).toEqual(["a", "b", "c"]);
    expect(herschik(["a"], 5, 0)).toEqual(["a"]);
  });
  it("alleen veranderde posities worden bewaard", () => {
    const oud = [
      { recipe_id: "a", positie: 0 },
      { recipe_id: "b", positie: 1 },
      { recipe_id: "c", positie: 2 },
    ];
    expect(gewijzigdePosities(oud, ["b", "a", "c"])).toEqual([
      { recipe_id: "b", positie: 0 },
      { recipe_id: "a", positie: 1 },
    ]);
    expect(gewijzigdePosities(oud, ["a", "b", "c"])).toEqual([]);
  });
  it("volgende positie en link", () => {
    expect(volgendePositie([])).toBe(0);
    expect(volgendePositie([{ positie: 0 }, { positie: 4 }])).toBe(5);
    expect(verzamelingLink("https://app.foodloapp.com/", "x")).toBe(
      "https://app.foodloapp.com/verzamelingen/x",
    );
  });
});
