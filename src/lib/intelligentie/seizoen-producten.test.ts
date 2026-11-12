import { describe, expect, it } from "vitest";
import { inSeizoen, seizoensProductenIn } from "./seizoen-producten";

const NOVEMBER = 10;
const MEI = 4;

describe("seizoenslijst België", () => {
  it("november: witloof, pompoen en spruitjes; geen asperges of aardbeien", () => {
    const lijst = inSeizoen(NOVEMBER);
    expect(lijst).toEqual(expect.arrayContaining(["witloof", "pompoen", "spruitjes", "prei"]));
    expect(lijst).not.toContain("asperges");
    expect(lijst).not.toContain("aardbeien");
  });
  it("mei: asperges, rabarber en aardbeien; geen pompoen", () => {
    const lijst = inSeizoen(MEI);
    expect(lijst).toEqual(expect.arrayContaining(["asperges", "rabarber", "aardbeien"]));
    expect(lijst).not.toContain("pompoen");
  });
  it("herkent producten in ingrediëntregels en titels", () => {
    expect(seizoensProductenIn(["2 stronken witloof", "hesp", "kaas"], NOVEMBER)).toEqual([
      "witloof",
    ]);
    expect(seizoensProductenIn(["Romige pompoensoep"], NOVEMBER)).toEqual(["pompoen"]);
    expect(seizoensProductenIn(["groene asperges"], NOVEMBER)).toEqual([]);
    expect(seizoensProductenIn(["groene asperges"], MEI)).toEqual(["asperges"]);
  });
  it("geen vals seizoen: appelazijn, tomatenpuree, blik, bloemkool ≠ kool", () => {
    expect(seizoensProductenIn(["appelazijn", "tomatenpuree", "tomaten uit blik"], 8)).toEqual([]);
    expect(seizoensProductenIn(["bloemkool"], 0)).toEqual([]);
  });
  it("korte woorden alleen als heel woord", () => {
    expect(seizoensProductenIn(["slagroom", "kerstomaatjes"], 6)).toEqual(["tomaten"]);
    expect(seizoensProductenIn(["1 krop sla", "verse erwten"], 6)).toEqual(["erwten", "sla"]);
  });
});
