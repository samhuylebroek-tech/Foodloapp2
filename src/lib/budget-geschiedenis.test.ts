import { describe, expect, it } from "vitest";
import {
  isAnders,
  leesWeek,
  MAX_WEKEN,
  oordeelWeek,
  vorigeWeken,
  zetWeek,
  type BudgetWeek,
} from "./budget-geschiedenis";

const w = (week: string, geschat: number, budget: number | null = 120): BudgetWeek => ({
  week,
  budget,
  geschat,
  niet_geschat: 0,
  maaltijden: 5,
});

describe("budgetgeschiedenis", () => {
  it("leest geldige rijen (ook numeric als tekst) en weigert rommel", () => {
    expect(
      leesWeek({ week: "2026-11-16", budget: "120.00", geschat: "104.555", maaltijden: 6 }),
    ).toEqual({ week: "2026-11-16", budget: 120, geschat: 104.56, niet_geschat: 0, maaltijden: 6 });
    expect(leesWeek({ week: "gisteren", geschat: 1 })).toBeNull();
    expect(leesWeek({ week: "2026-11-16", geschat: -1 })).toBeNull();
    expect(leesWeek(null)).toBeNull();
    expect(leesWeek({ week: "2026-11-16", geschat: 10, budget: 0 })!.budget).toBeNull();
  });

  it("zetWeek: vervangt dezelfde week, nieuwste eerst, begrensd", () => {
    let l: BudgetWeek[] = [];
    for (let i = 1; i <= 15; i++) l = zetWeek(l, w(`2026-0${(i % 9) + 1}-0${(i % 7) + 1}`, i));
    expect(l.length).toBeLessThanOrEqual(MAX_WEKEN);
    const een = zetWeek([w("2026-11-09", 100), w("2026-11-16", 90)], w("2026-11-16", 95));
    expect(een.map((x) => [x.week, x.geschat])).toEqual([
      ["2026-11-16", 95],
      ["2026-11-09", 100],
    ]);
  });

  it("isAnders: geen nutteloze schrijfacties", () => {
    expect(isAnders(w("2026-11-16", 90), w("2026-11-16", 90))).toBe(false);
    expect(isAnders(w("2026-11-16", 90), w("2026-11-16", 91))).toBe(true);
    expect(isAnders(undefined, { ...w("2026-11-16", 0), maaltijden: 0 })).toBe(false);
    expect(isAnders(undefined, w("2026-11-16", 10))).toBe(true);
  });

  it("vorigeWeken: alleen eerdere weken met maaltijden", () => {
    const l = [w("2026-11-16", 90), w("2026-11-09", 130), { ...w("2026-11-02", 0), maaltijden: 0 }];
    expect(vorigeWeken(l, "2026-11-16").map((x) => x.week)).toEqual(["2026-11-09"]);
    expect(oordeelWeek(w("2026-11-09", 130))).toBe("boven");
    expect(oordeelWeek(w("2026-11-09", 100))).toBe("onder");
    expect(oordeelWeek(w("2026-11-09", 100, null))).toBeNull();
  });
});
