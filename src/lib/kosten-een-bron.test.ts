/**
 * P2 "één kostenbron": de planner-engine, de budgetkaart (schatWeek) en de lijst (schatLijst)
 * geven hetzelfde getal voor hetzelfde weekmenu.
 */
import { describe, expect, it } from "vitest";
import { bekendeKost, kostMaaltijd, schatLijst, schatWeek } from "@/lib/budget";
import { berekenAanvulling } from "@/lib/kringloop";
import { kostVoor, type PlanKandidaat } from "@/lib/planner/engine";

const pasta = [
  { name: "spaghetti", quantity: 400, unit: "g" },
  { name: "gehakt", quantity: 500, unit: "g" },
  { name: "passata", quantity: 500, unit: "g" },
  { name: "zout", quantity: null, unit: "" },
];
const soep = [
  { name: "pompoen", quantity: 1, unit: "kg" },
  { name: "room", quantity: 20, unit: "cl" },
];
const raar = [
  { name: "dragonazijn", quantity: 1, unit: "fles" },
  { name: "yuzu", quantity: 2, unit: "" },
  { name: "room", quantity: 10, unit: "cl" },
];

describe("één kostenbron", () => {
  const plan = [
    { recipe_id: "pasta", personen: 2, servings: 4 },
    { recipe_id: "soep", personen: 4, servings: 4 },
  ];
  const perRecept = { pasta, soep };

  it("engine (kostVoor) = budgetkaart (schatWeek)", () => {
    const kandidaat = (id: string, regels: typeof pasta, servings: number) =>
      ({ id, title: id, regels, servings }) as unknown as PlanKandidaat;
    const engine =
      bekendeKost(kostVoor(kandidaat("pasta", pasta, 4), 2))! +
      bekendeKost(kostVoor(kandidaat("soep", soep, 4), 4))!;
    const kaart = schatWeek(plan, perRecept).totaal;
    expect(kaart).toBeGreaterThan(0);
    expect(Math.round(engine * 100) / 100).toBe(kaart);
  });

  it("lijst (schatLijst) = budgetkaart zonder voorraad (alles in g/ml)", () => {
    const a = berekenAanvulling({
      plan: plan.map((p, i) => ({ ...p, plan_date: `2026-11-2${i}` })),
      recepten: [
        { id: "pasta", title: "Pasta", servings: 4 },
        { id: "soep", title: "Soep", servings: 4 },
      ],
      ingredienten: [
        ...pasta.map((x) => ({ ...x, recipe_id: "pasta" })),
        ...soep.map((x) => ({ ...x, recipe_id: "soep" })),
      ],
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-18",
    });
    const lijst = schatLijst(
      a.kopen.map((r) => ({ name: r.naam, quantity: r.quantity ?? r.nodig, unit: r.unit })),
    );
    expect(lijst.zonderPrijs).toBe(0);
    expect(lijst.totaal).toBeCloseTo(schatWeek(plan, perRecept).totaal, 1);
  });

  it("prijs onbekend telt nooit als € 0", () => {
    const k = kostMaaltijd(raar, 2, 2);
    expect(k!.dekking).toBeLessThan(0.5);
    expect(bekendeKost(k)).toBeNull();
    const w = schatWeek([{ recipe_id: "raar", personen: 2, servings: 2 }], { raar });
    expect(w).toEqual({ totaal: 0, maaltijden: 1, nietGeschat: 1 });
    const l = schatLijst([
      { name: "yuzu", quantity: 2, unit: "" },
      { name: "melk", quantity: null, unit: "l" },
      { name: "melk", quantity: 1, unit: "l" },
      { name: "zout", quantity: 1, unit: "snuf" },
      { name: "boter", quantity: 250, unit: "g", checked: true },
    ]);
    expect(l.zonderPrijs).toBe(2);
    expect(l.geschat).toBe(1);
    expect(l.totaal).toBeCloseTo(1.15, 2);
  });

  it("onbekend aantal porties = zoals geschreven (niet × personen)", () => {
    const met = kostMaaltijd(soep, null, 4)!.totaal;
    const zonder = kostMaaltijd(soep, 4, 4)!.totaal;
    expect(met).toBe(zonder);
    expect(schatWeek([{ recipe_id: "soep", personen: 4, servings: null }], { soep }).totaal).toBe(
      zonder,
    );
  });

  it("geen ingrediënten: niet te schatten", () => {
    expect(kostMaaltijd([], 4, 4)).toBeNull();
    expect(kostMaaltijd(undefined, 4, 4)).toBeNull();
  });
});
