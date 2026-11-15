import { describe, expect, it } from "vitest";
import { inSeizoen } from "@/lib/intelligentie/seizoen-producten";
import { filterSeizoen, seizoenIn, seizoenUitleg } from "./lokaal";

const NOV = 10;
const JUL = 6;
const ideeen = [
  { id: "a", title: "Romige pompoensoep", tags: [] },
  { id: "b", title: "Pasta pesto", tags: [] },
  { id: "c", title: "Stoemp", tags: ["Belgisch"] },
  { id: "d", title: "Shakshuka", tags: [] },
];
const ingr = new Map([
  ["b", ["pasta", "courgette", "paprika"]],
  ["c", ["aardappelen", "prei", "spekjes"]],
  ["d", ["eieren", "tomaten", "paprika"]],
]);

describe("lokaal en seizoen (België)", () => {
  it("november: pompoen (titel) en prei (ingrediënt) tellen; courgette en tomaat niet", () => {
    expect(filterSeizoen(ideeen, ingr, NOV).map((r) => r.id)).toEqual(["a", "c"]);
    expect(seizoenIn(ideeen[2]!, ingr.get("c")!, NOV)).toEqual(["prei"]);
  });

  it("juli: courgette en tomaten wel, pompoen niet", () => {
    expect(filterSeizoen(ideeen, ingr, JUL).map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("zonder ingrediënten telt alleen de titel", () => {
    expect(filterSeizoen(ideeen, undefined, NOV).map((r) => r.id)).toEqual(["a"]);
  });

  it("elke maand heeft seizoensproducten en een uitleg in gewone taal", () => {
    for (let m = 0; m < 12; m++) {
      expect(inSeizoen(m).length).toBeGreaterThan(2);
      expect(seizoenUitleg(m)).toMatch(/van bij ons: /);
    }
    expect(seizoenUitleg(NOV, 3)).toBe(
      "In november van bij ons: witloof, pompoen, spruitjes en meer.",
    );
  });

  it("geen valse treffers: tomatenpuree en appelazijn zijn geen verse seizoensproducten", () => {
    expect(seizoenIn({ title: "Saus" }, ["tomatenpuree", "appelazijn"], JUL)).toEqual([]);
  });
});
