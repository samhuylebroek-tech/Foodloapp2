import { describe, expect, it } from "vitest";
import { canoniekeNaam, zelfdeProduct } from "@/lib/product-herkenning";
import { berekenAanvulling } from "@/lib/kringloop";
import {
  drieGetallen,
  korteBehoefte,
  naarBasis,
  rekenOm,
  stukgewicht,
  telIngredientenOp,
  toonbaar,
  voorgesteldeVerpakking,
} from "./index";

describe("synoniemen (NL/BE)", () => {
  it.each([
    ["paprika rood", "rode paprika"],
    ["ui", "ajuin"],
    ["uien", "ajuinen"],
    ["room", "slagroom"],
    ["kookroom", "room"],
    ["vloeibare room", "room"],
    ["courgette", "zucchini"],
    ["courgettes", "courgette"],
    ["tomaten", "tomaat"],
    ["patatten", "aardappel"],
    ["hesp", "ham"],
    ["appelsienen", "sinaasappel"],
    ["witlof", "witloof"],
    ["gemengd gehakt", "gehakt"],
    ["paddenstoelen", "champignons"],
  ])("%s = %s", (a, b) => {
    expect(zelfdeProduct(a, b)).toBe(true);
  });

  it.each([
    ["rode ui", "ui"],
    ["zure room", "room"],
    ["amandelmelk", "melk"],
    ["rode paprika", "groene paprika"],
    ["kerstomaat", "tomaat"],
  ])("%s ≠ %s", (a, b) => {
    expect(zelfdeProduct(a, b)).toBe(false);
  });

  it("woordvolgorde doet er niet toe", () => {
    expect(canoniekeNaam("paprika geel")).toBe(canoniekeNaam("gele paprika"));
  });
});

describe("eenheden omrekenen", () => {
  it("gewicht en volume", () => {
    expect(rekenOm(1.5, "kg", "g")).toBe(1500);
    expect(rekenOm(250, "g", "kg")).toBe(0.25);
    expect(rekenOm(2, "dl", "ml")).toBe(200);
    expect(rekenOm(25, "cl", "l")).toBe(0.25);
    expect(rekenOm(3, "el", "ml")).toBe(45);
    expect(rekenOm(2, "kl", "tl")).toBe(2);
    expect(rekenOm(1, "el", "tl")).toBe(3);
  });

  it("stuk ↔ gram met gekend stukgewicht", () => {
    expect(rekenOm(2, "", "g", "ui")).toBe(240);
    expect(rekenOm(2, "stuks", "g", "ajuin")).toBe(240);
    expect(rekenOm(600, "g", "stuk", "paprika")).toBeCloseTo(3.33, 2);
    expect(rekenOm(1, "stuk", "kg", "pompoen")).toBe(1.2);
  });

  it("onbekend = niet omrekenen (nooit gokken)", () => {
    expect(stukgewicht("dragonazijn")).toBeNull();
    expect(rekenOm(2, "stuks", "g", "dragonazijn")).toBeNull();
    expect(rekenOm(100, "g", "ml", "melk")).toBeNull();
    expect(rekenOm(1, "blik", "g", "tomaten")).toBeNull();
    expect(rekenOm(1, "bos", "g", "peterselie")).toBeNull();
  });

  it("zelfde vreemde eenheid blijft gelijk", () => {
    expect(rekenOm(2, "blik", "blik")).toBe(2);
  });

  it("toonbaar", () => {
    expect(toonbaar({ familie: "g", waarde: 1500 })).toEqual({ quantity: 1.5, unit: "kg" });
    expect(toonbaar({ familie: "ml", waarde: 250 })).toEqual({ quantity: 25, unit: "cl" });
    expect(toonbaar({ familie: "ml", waarde: 15 })).toEqual({ quantity: 15, unit: "ml" });
    expect(naarBasis(null, "g")).toBeNull();
  });
});

describe("optellen over recepten", () => {
  it("synoniemen en eenheden samen", () => {
    const o = telIngredientenOp([
      { name: "ui", quantity: 1, unit: "" },
      { name: "ajuin", quantity: 2, unit: "stuks" },
      { name: "uien", quantity: 240, unit: "g" },
      { name: "room", quantity: 20, unit: "cl" },
      { name: "slagroom", quantity: 1, unit: "dl" },
      { name: "peper", quantity: null, unit: "" },
    ]);
    const ui = o.find((x) => x.naam === "ui")!;
    expect(ui.maten).toEqual([{ familie: "g", waarde: 600 }]);
    const room = o.find((x) => x.naam === "room")!;
    expect(room.maten).toEqual([{ familie: "ml", waarde: 300 }]);
    expect(o.find((x) => x.naam === "peper")!.zonderHoeveelheid).toBe(true);
  });

  it("niet omrekenbaar blijft apart", () => {
    const o = telIngredientenOp([
      { name: "peterselie", quantity: 1, unit: "bos" },
      { name: "peterselie", quantity: 10, unit: "g" },
    ]);
    expect(o).toHaveLength(1);
    expect(o[0]!.maten).toEqual([
      { familie: "bos", waarde: 1 },
      { familie: "g", waarde: 10 },
    ]);
  });
});

describe("gangbare verpakking", () => {
  it("kleinste verpakking die volstaat", () => {
    const v = voorgesteldeVerpakking("spaghetti", 350, "g")!;
    expect(v.tekst).toBe("1 pak 500 g; je hebt 350 g nodig");
  });
  it("meer dan de grootste: meerdere", () => {
    expect(voorgesteldeVerpakking("rijst", 1.8, "kg")!.kort).toBe("2 pakken 1 kg");
  });
  it("stuks via stukgewicht", () => {
    expect(voorgesteldeVerpakking("uien", 3, "")!.tekst).toBe("1 net 1 kg; je hebt 3 stuks nodig");
  });
  it("eieren per doos", () => {
    expect(voorgesteldeVerpakking("eieren", 8, "")!.kort).toBe("1 doos van 12");
  });
  it("room in cl", () => {
    expect(voorgesteldeVerpakking("slagroom", 25, "cl")!.kort).toBe("1 brik 50 cl");
  });
  it("onbekend product of eenheid: geen voorstel", () => {
    expect(voorgesteldeVerpakking("dragon", 10, "g")).toBeNull();
    expect(voorgesteldeVerpakking("melk", 2, "blik")).toBeNull();
    expect(voorgesteldeVerpakking("melk", null, "l")).toBeNull();
  });
});

describe("behoefte − voorraad = te kopen", () => {
  const recept = { id: "soep", title: "Pompoensoep", servings: 4 };
  const ingr = [
    { recipe_id: "soep", name: "pompoen", quantity: 2, unit: "kg" },
    { recipe_id: "soep", name: "ui", quantity: 2, unit: "" },
    { recipe_id: "soep", name: "room", quantity: 20, unit: "cl" },
  ];
  const plan = [{ plan_date: "2026-11-20", recipe_id: "soep", personen: 4 }];

  it("geregistreerde pompoen (1 stuk ≈ 1,2 kg) telt af", () => {
    const a = berekenAanvulling({
      plan,
      recepten: [recept],
      ingredienten: ingr,
      voorraad: [{ id: "v1", naam: "pompoen", hoeveelheid: 1, eenheid: "" }],
      lijst: [],
      vanaf: "2026-11-18",
    });
    const p = a.kopen.find((r) => r.naam === "pompoen")!;
    expect(p.nodig).toBe(2);
    expect(p.quantity).toBe(0.8);
    expect(p.inHuisHoeveelheid).toBe(1.2);
    const d = drieGetallen(p);
    expect(d).toMatchObject({ nodig: "2 kg", inHuis: "1,2 kg", teKopen: "0,8 kg" });
    expect(korteBehoefte(d)).toBe("nodig 2 kg · in huis 1,2 kg · te kopen 0,8 kg");
  });

  it("zonder voorraad: alles kopen, met verpakking", () => {
    const a = berekenAanvulling({
      plan,
      recepten: [recept],
      ingredienten: ingr,
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-18",
    });
    const room = a.kopen.find((r) => r.naam === "room")!;
    const d = drieGetallen(room);
    expect(d.inHuis).toBeNull();
    expect(d.teKopen).toBe("20 cl");
    expect(d.verpakking?.kort).toBe("1 brikje 20 cl");
    expect(korteBehoefte(d)).toBe("nodig 20 cl");
  });

  it("onbekende eenheid in voorraad: niet gokken (in huis, niets kopen)", () => {
    const a = berekenAanvulling({
      plan,
      recepten: [recept],
      ingredienten: [{ recipe_id: "soep", name: "peterselie", quantity: 20, unit: "g" }],
      voorraad: [{ id: "v1", naam: "peterselie", hoeveelheid: 1, eenheid: "bos" }],
      lijst: [],
      vanaf: "2026-11-18",
    });
    expect(a.kopen).toHaveLength(0);
    expect(a.inHuis.map((r) => r.naam)).toEqual(["peterselie"]);
  });
});
