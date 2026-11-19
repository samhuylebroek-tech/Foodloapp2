import { describe, expect, it } from "vitest";
import type { Recipe } from "@/lib/types";
import type { DagRegel } from "@/lib/weekmenu-voorstel";
import { kiesViaEngine } from "./laat-kiezen";

const recept = (id: string, title: string, tags: string[], min = 30, category = "hoofdgerecht") =>
  ({
    id,
    title,
    description: "",
    tags,
    category,
    prep_minutes: min,
    cook_minutes: 0,
    image_url: null,
  }) as unknown as Recipe;

const RECEPTEN = [
  recept("stoof", "Stoofvlees", ["vlees"], 170),
  recept("kip", "Kip met rijst", ["vlees"], 25),
  recept("zalm", "Zalm uit de oven", ["vis"], 25),
  recept("soep", "Pompoensoep", ["vegetarisch"], 35, "soep"),
  recept("pasta", "Pasta met tomaat", ["vegetarisch"], 20),
  recept("oats", "Overnight oats", ["vegetarisch"], 5, "ontbijt"),
  recept("mousse", "Chocomousse", ["vegetarisch"], 10, "nagerecht"),
];
const ING: Record<string, string[]> = {
  stoof: ["rundvlees", "bier"],
  kip: ["kipfilet", "rijst"],
  zalm: ["zalmfilet", "krieltjes"],
  soep: ["pompoen", "room"],
  pasta: ["pasta", "passata"],
  oats: ["havermout", "melk"],
  mousse: ["chocolade", "eieren"],
};
const dag = (d: number, extra: Partial<DagRegel> = {}): DagRegel => ({
  datum: `2026-11-${16 + d}`,
  moment: "avondeten",
  maxMinuten: 0,
  soort: null,
  over: false,
  ...extra,
});
const kies = (regels: DagRegel[], extra: Partial<Parameters<typeof kiesViaEngine>[0]> = {}) =>
  kiesViaEngine({
    recepten: RECEPTEN,
    ingredienten: ING,
    regels,
    doelen: { vlees: 0, vis: 0, vega: 0 },
    vermijd: "",
    ...extra,
  });

describe('"Laat Foodlo kiezen" via de engine', () => {
  it("weekdoelen: 1 vis en 2 vegetarisch in drie dagen", () => {
    const uit = kies([dag(0), dag(1), dag(2)], { doelen: { vlees: 0, vis: 1, vega: 2 } });
    const ids = uit.map((u) => u.recept?.id);
    expect(ids.filter((x) => x === "zalm")).toHaveLength(1);
    expect(ids.filter((x) => x === "soep" || x === "pasta")).toHaveLength(2);
  });

  it("eigen wens per dag gaat voor; geen gerecht twee keer", () => {
    const uit = kies([dag(0, { soort: "vis" }), dag(1, { soort: "vlees" }), dag(2)]);
    expect(uit[0]!.recept?.id).toBe("zalm");
    expect(["stoof", "kip"]).toContain(uit[1]!.recept?.id);
    expect(new Set(uit.map((u) => u.recept?.id)).size).toBe(3);
  });

  it("overslaan, vast en eerder getoond", () => {
    const uit = kies([dag(0, { over: true }), dag(1), dag(2)], {
      vast: { "2026-11-17|avondeten": "kip" },
      uitgesloten: { "2026-11-18|avondeten": ["pasta", "soep", "zalm"] },
    });
    expect(uit[0]!.recept).toBeNull();
    expect(uit[1]!.recept?.id).toBe("kip");
    expect(["stoof"]).toContain(uit[2]!.recept?.id);
  });

  it("nooit een ontbijt of nagerecht als avondeten; wel ontbijt bij ontbijt", () => {
    const uit = kies([0, 1, 2, 3, 4, 5].map((d) => dag(d)));
    for (const u of uit) expect(["oats", "mousse"]).not.toContain(u.recept?.id);
    expect(kies([dag(0, { moment: "ontbijt" })])[0]!.recept?.id).toBe("oats");
  });

  it("kooktijd is zacht: lange gerechten lager, niet weg", () => {
    const uit = kies([dag(0, { maxMinuten: 30, soort: "vlees" })]);
    expect(uit[0]!.recept?.id).toBe("kip");
    const enkel = kiesViaEngine({
      recepten: [RECEPTEN[0]!],
      ingredienten: ING,
      regels: [dag(0, { maxMinuten: 20 })],
      doelen: { vlees: 0, vis: 0, vega: 0 },
      vermijd: "",
    });
    expect(enkel[0]!.recept?.id).toBe("stoof");
  });

  it("veiligheid blijft: eigen allergie (vis) en 'liever niet'", () => {
    const uit = kies(
      [0, 1, 2, 3].map((d) => dag(d)),
      {
        allergieen: ["vis"],
        vermijd: "pompoen",
        doelen: { vlees: 0, vis: 2, vega: 2 },
      },
    );
    const ids = uit.map((u) => u.recept?.id);
    expect(ids).not.toContain("zalm");
    expect(ids).not.toContain("soep");
  });
});
