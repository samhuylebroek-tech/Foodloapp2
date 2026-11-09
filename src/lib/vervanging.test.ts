import { describe, expect, it } from "vitest";
import { berekenAanvulling, verbruik, voorraadNaKoop } from "./kringloop";
import { canoniekeNaam, vervangNaam, vervanging, zelfdeProduct } from "./product-herkenning";
import { zitInVoorraad } from "./voorraad-match";

describe("WP5 — vervangen in de winkel", () => {
  it("vervangNaam bewaart het oorspronkelijke product, ook bij een tweede vervanging", () => {
    expect(vervangNaam("Diepvriesspinazie", "verse spinazie")).toBe(
      "Diepvriesspinazie (i.p.v. verse spinazie)",
    );
    expect(vervangNaam("Spinazie in blik", "Diepvriesspinazie (i.p.v. verse spinazie)")).toBe(
      "Spinazie in blik (i.p.v. verse spinazie)",
    );
    // Eigenlijk hetzelfde product ("diepvries" is een bijwoord): geen marker nodig.
    expect(vervangNaam("diepvries spinazie", "spinazie")).toBe("diepvries spinazie");
    // Terug naar het origineel: marker valt weg.
    expect(vervangNaam("spinazie", "Margarine (i.p.v. spinazie)")).toBe("spinazie");
  });

  it("vervanging leest de marker, ook in de lange vorm", () => {
    expect(vervanging("Margarine (i.p.v. boter)")).toEqual({ naam: "Margarine", voor: "boter" });
    expect(vervanging("Margarine (in plaats van boter)")).toEqual({
      naam: "Margarine",
      voor: "boter",
    });
    expect(vervanging("Boter")).toEqual({ naam: "Boter", voor: null });
    expect(canoniekeNaam("Margarine (i.p.v. boter)")).toBe(canoniekeNaam("margarine"));
  });

  it("telt als het eigen én het oorspronkelijke product, maar niet als iets anders", () => {
    expect(zelfdeProduct("Margarine (i.p.v. boter)", "boter")).toBe(true);
    expect(zelfdeProduct("boter", "Margarine (i.p.v. boter)")).toBe(true);
    expect(zelfdeProduct("Margarine (i.p.v. boter)", "margarine")).toBe(true);
    expect(zelfdeProduct("Margarine (i.p.v. boter)", "melk")).toBe(false);
    expect(zitInVoorraad("boter", ["Margarine (i.p.v. boter)"])).toBe(true);
    expect(zitInVoorraad("melk", ["Margarine (i.p.v. boter)"])).toBe(false);
  });

  it("na het winkelen: maaltijd ziet het vervangen product als in huis, koken verbruikt het", () => {
    const plan = [{ plan_date: "2026-11-09", recipe_id: "r", personen: null }];
    const recepten = [{ id: "r", title: "Cake", servings: 4 }];
    const ingredienten = [{ recipe_id: "r", name: "boter", quantity: 200, unit: "g" }];
    const gekocht = [{ name: "Margarine (i.p.v. boter)", quantity: 250, unit: "g" }];
    const naKoop = voorraadNaKoop(gekocht, []);
    expect(naKoop.nieuw).toEqual([
      { naam: "Margarine (i.p.v. boter)", hoeveelheid: 250, eenheid: "g" },
    ]);
    const voorraad = [{ id: "v1", ...naKoop.nieuw[0]! }];
    const a = berekenAanvulling({
      plan,
      recepten,
      ingredienten,
      voorraad,
      lijst: [],
      vanaf: "2026-11-09",
    });
    expect(a.kopen).toHaveLength(0);
    expect(a.inHuis.map((r) => r.naam)).toEqual(["boter"]);
    const v = verbruik(ingredienten, voorraad);
    expect(v.bijwerken).toEqual([
      { id: "v1", naam: "Margarine (i.p.v. boter)", hoeveelheid: 50, oud: 250 },
    ]);
  });

  it("andere eenheid (300 g → 1 zak): telt als aanwezig, geen dubbel aankopen", () => {
    const plan = [{ plan_date: "2026-11-09", recipe_id: "r", personen: null }];
    const a = berekenAanvulling({
      plan,
      recepten: [{ id: "r", title: "Stoemp", servings: 4 }],
      ingredienten: [{ recipe_id: "r", name: "spinazie", quantity: 300, unit: "g" }],
      voorraad: [
        { id: "v", naam: "Diepvriesspinazie (i.p.v. spinazie)", hoeveelheid: 1, eenheid: "zak" },
      ],
      lijst: [],
      vanaf: "2026-11-09",
    });
    expect(a.kopen).toHaveLength(0);
  });
});

describe("vervangVoorstellen", () => {
  it("alleen voorstellen die kloppen", async () => {
    const { vervangVoorstellen } = await import("./vervangen");
    expect(vervangVoorstellen("verse spinazie")).toEqual(["Diepvries spinazie"]);
    expect(vervangVoorstellen("tomaten")).toEqual(["Tomaten uit blik"]);
    expect(vervangVoorstellen("erwten")).toEqual(["Diepvries erwten", "Erwten uit blik"]);
    expect(vervangVoorstellen("citroen")).toEqual([]);
    expect(vervangVoorstellen("Margarine (i.p.v. boter)")).toEqual([]);
  });
});
