import { describe, expect, it } from "vitest";
import { CATEGORIE_VOLGORDE } from "@/lib/categorie";
import {
  herstelStappen,
  kostZin,
  maakLijstSlimmer,
  samenvatting,
  stappenVoor,
  type LijstRij,
} from "./lijst-slimmer";
import { ketenVan, volgordeVoorWinkel } from "./supermarkt/indeling";

const rij = (
  id: string,
  name: string,
  quantity: number | null,
  unit = "",
  extra = {},
): LijstRij => ({
  id,
  name,
  quantity,
  unit,
  checked: false,
  ...extra,
});
const V = [...CATEGORIE_VOLGORDE];

describe("boodschappen-agent: dubbels samenvoegen", () => {
  it("voegt synoniemen en eenheden samen via de ingrediënt-kern", () => {
    const v = maakLijstSlimmer({
      items: [
        rij("a", "melk", 1, "l"),
        rij("b", "melk", 50, "cl"),
        rij("c", "uien", 3),
        rij("d", "ajuin", 2),
      ],
      volgorde: V,
    });
    const samen = v.verschillen.filter((x) => x.soort === "samenvoegen");
    expect(samen).toHaveLength(2);
    const melk = samen.find((x) => x.soort === "samenvoegen" && x.houd.id === "a")!;
    expect(melk.soort === "samenvoegen" && [melk.quantity, melk.unit]).toEqual([1.5, "l"]);
    const ui = samen.find((x) => x.soort === "samenvoegen" && x.houd.id === "c")!;
    expect(ui.soort === "samenvoegen" && ui.quantity).toBe(5);
    expect(ui.voor).toContain("+");
  });

  it("gokt nooit: gewicht + volume, of met en zonder hoeveelheid, blijft staan", () => {
    const v = maakLijstSlimmer({
      items: [
        rij("a", "suiker", 500, "g"),
        rij("b", "suiker", 2, "dl"),
        rij("c", "peper", null),
        rij("d", "peper", 1, "pot"),
      ],
      volgorde: V,
    });
    expect(v.verschillen.filter((x) => x.soort === "samenvoegen")).toHaveLength(0);
  });

  it("twee verschillende gerechten blijven apart; afgevinkte rijen tellen niet", () => {
    const v = maakLijstSlimmer({
      items: [
        rij("a", "wortel", 2, "", { recipe_id: "r1" }),
        rij("b", "wortel", 3, "", { recipe_id: "r2" }),
        { ...rij("c", "tomaat", 2), checked: true },
        rij("d", "tomaat", 1),
      ],
      volgorde: V,
    });
    expect(v.verschillen.filter((x) => x.soort === "samenvoegen")).toHaveLength(0);
  });

  it("houdt de rij van het gerecht; op een gezinslijst als kijker niets samenvoegen", () => {
    const items = [rij("a", "rijst", 200, "g"), rij("b", "rijst", 300, "g", { recipe_id: "r1" })];
    const v = maakLijstSlimmer({ items, volgorde: V });
    const s = v.verschillen[0]!;
    expect(s.soort === "samenvoegen" && s.houd.id).toBe("b");
    expect(
      maakLijstSlimmer({ items, volgorde: V, magVerwijderen: false }).verschillen,
    ).toHaveLength(0);
  });
});

describe("boodschappen-agent: goedkoper, vergeten, volgorde", () => {
  it("stelt een goedkoper alternatief voor met de richtprijzen uit budget.ts", () => {
    const v = maakLijstSlimmer({ items: [rij("p", "parmezaan", 200, "g")], volgorde: V });
    const g = v.verschillen.find((x) => x.soort === "goedkoper")!;
    expect(g.soort === "goedkoper" && g.naam).toBe("Grana Padano");
    // 0,2 kg × (25 − 17) = € 1,60
    expect(g.soort === "goedkoper" && g.besparing).toBe(1.6);
    expect(v.kostNa).toBeLessThan(v.kostNu);
    expect(kostZin(v.kostNu, v.kostNa)).toMatch(/goedkoper.*richtprijzen/);
  });

  it("geen alternatief dat niet veilig is of zonder hoeveelheid (geen besparing te berekenen)", () => {
    const veilig = (n: string) => !/grana/i.test(n);
    expect(
      maakLijstSlimmer({ items: [rij("p", "parmezaan", 200, "g")], volgorde: V, veilig })
        .verschillen,
    ).toHaveLength(0);
    expect(
      maakLijstSlimmer({ items: [rij("p", "parmezaan", null)], volgorde: V }).verschillen,
    ).toHaveLength(0);
    expect(
      maakLijstSlimmer({ items: [rij("p", "diepvriesspinazie", 450, "g")], volgorde: V })
        .verschillen,
    ).toHaveLength(0);
  });

  it("vergeten basisproducten: alleen uit je eigen geschiedenis, niet op de lijst of in voorraad", () => {
    const v = maakLijstSlimmer({
      items: [rij("m", "melk", 1, "l")],
      basis: [
        { name: "Melk", quantity: 1, unit: "l", reden: "Vast product" },
        { name: "eieren", quantity: 6, unit: "", reden: "Koop je vaak" },
        { name: "wc-papier", quantity: 1, unit: "pak", reden: "Vast product" },
        { name: "pindakaas", quantity: 1, unit: "pot", reden: "Koop je vaak" },
      ],
      voorraad: ["eieren"],
      veilig: (n) => !/pinda/.test(n),
      volgorde: V,
    });
    const b = v.verschillen
      .filter((x) => x.soort === "basis")
      .map((x) => x.soort === "basis" && x.name);
    expect(b).toEqual(["wc-papier"]);
  });

  it("afdelingsvolgorde voor de gekozen winkel; 'Al in huis?' en 'Overige' blijven op hun plek", () => {
    expect(ketenVan("Colruyt Gent")).toBe("Colruyt");
    expect(ketenVan("Bakker")).toBeNull();
    const naar = volgordeVoorWinkel("Aldi", V)!;
    expect(naar[0]).toBe("brood-bakkerij");
    expect(naar.indexOf("voorraadkast")).toBe(V.indexOf("voorraadkast"));
    expect(naar.at(-1)).toBe("overige");
    const v = maakLijstSlimmer({ items: [], volgorde: V, winkel: "Aldi" });
    expect(v.verschillen.map((x) => x.soort)).toEqual(["volgorde"]);
    // Al in die volgorde: geen verschil.
    expect(
      maakLijstSlimmer({ items: [], volgorde: naar, winkel: "Aldi" }).verschillen,
    ).toHaveLength(0);
    expect(maakLijstSlimmer({ items: [], volgorde: V, winkel: "Bakker" }).verschillen).toHaveLength(
      0,
    );
  });
});

describe("boodschappen-agent: uitvoeren en één keer ongedaan maken", () => {
  it("stappen en herstel zijn elkaars omgekeerde", () => {
    const items = [
      rij("a", "melk", 1, "l"),
      rij("b", "melk", 50, "cl", { note: "halfvol" }),
      rij("p", "parmezaan", 200, "g"),
    ];
    const v = maakLijstSlimmer({
      items,
      basis: [{ name: "brood", quantity: 1, unit: "stuk", reden: "Vast product" }],
      volgorde: V,
      winkel: "Lidl",
    });
    expect(v.verschillen.map((x) => x.soort).sort()).toEqual([
      "basis",
      "goedkoper",
      "samenvoegen",
      "volgorde",
    ]);
    const s = stappenVoor(v.verschillen);
    expect(s.weghalen.map((r) => r.id)).toEqual(["b"]);
    expect(s.bijwerken).toEqual([
      { id: "a", velden: { quantity: 1.5, unit: "l" } },
      { id: "p", velden: { name: "Grana Padano" } },
    ]);
    expect(s.toevoegen).toEqual([{ name: "brood", quantity: 1, unit: "stuk" }]);
    const h = herstelStappen(v.verschillen, V);
    expect(h.terugzetten).toEqual([
      { id: "a", velden: { name: "melk", quantity: 1, unit: "l" } },
      { id: "p", velden: { name: "parmezaan", quantity: 200, unit: "g" } },
    ]);
    expect(h.opnieuw[0]!.note).toBe("halfvol");
    expect(h.toegevoegd).toEqual(["brood"]);
    expect(h.volgorde).toEqual(V);
    expect(samenvatting(v.verschillen)).toMatch(
      /1 dubbel samengevoegd, 1 goedkoper, 1 vergeten product erbij/,
    );
  });

  it("een lege of al nette lijst geeft geen verschillen", () => {
    const v = maakLijstSlimmer({ items: [rij("a", "brood", 1)], volgorde: V });
    expect(v.verschillen).toEqual([]);
    expect(samenvatting([])).toBe("Niets veranderd.");
  });
});
