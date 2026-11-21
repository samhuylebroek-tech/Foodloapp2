// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { aantalVoor, euroCent, koppelLijst, mandjeTotaal } from "./mandje";
import { LokaleSupermarkt, TestSupermarktProvider, type ProductVoorstel } from "./provider";

const r = (id: string, name: string, quantity: number | null, unit = "") => ({
  id,
  name,
  quantity,
  unit,
});

describe("supermarktstroom in testmodus", () => {
  it("koppelt de demolijst; wat de winkel niet kent, staat apart", async () => {
    const k = await koppelLijst(
      [
        r("1", "melk", 1, "l"),
        r("2", "brood", 1, "stuk(s)"),
        r("3", "uien", 3),
        r("4", "citroen", 1),
      ],
      new TestSupermarktProvider(),
    );
    expect(k.gevonden.map((g) => g.regel.name)).toEqual(["melk", "brood", "uien"]);
    expect(k.nietGevonden.map((g) => g.name)).toEqual(["citroen"]);
    // Twee keuzes voor brood: huismerk met prijs, bakkersbrood zonder prijs van de winkel.
    const brood = k.gevonden[1]!.voorstellen;
    expect(brood.map((p) => [p.merk, p.prijsCent])).toEqual([
      ["Huismerk", 239],
      ["Bakkerij in de winkel", null],
    ]);
    expect(brood.every((p) => p.label === "testgegevens")).toBe(true);
  });

  it("een provider die faalt of niets kent, zet alles bij 'niet gevonden' (nooit stil weg)", async () => {
    const kapot = { productVoorstellen: async () => Promise.reject(new Error("weg")) };
    expect((await koppelLijst([r("1", "melk", 1)], kapot)).nietGevonden).toHaveLength(1);
    const lokaal = await koppelLijst([r("1", "melk", 1)], new LokaleSupermarkt());
    expect(lokaal.gevonden).toEqual([]);
  });

  it("aantal verpakkingen alleen als de inhoud als getal gekend is", () => {
    const p = (maat?: ProductVoorstel["maat"]): ProductVoorstel => ({
      naam: "x",
      prijsCent: 100,
      inhoud: "",
      label: "testgegevens",
      ...(maat ? { maat } : {}),
    });
    expect(aantalVoor(r("1", "stoofvlees", 1000, "g"), p({ quantity: 500, unit: "g" }))).toBe(2);
    expect(aantalVoor(r("1", "bier", 50, "cl"), p({ quantity: 33, unit: "cl" }))).toBe(2);
    expect(aantalVoor(r("1", "melk", 1.5, "l"), p({ quantity: 1, unit: "l" }))).toBe(2);
    expect(aantalVoor(r("1", "uien", 3), p({ quantity: 1, unit: "kg" }))).toBe(1);
    expect(aantalVoor(r("1", "melk", null), p({ quantity: 1, unit: "l" }))).toBe(1);
    expect(aantalVoor(r("1", "brood", 1), p())).toBe(1);
  });

  it("totaal telt alleen echte (test)prijzen; zonder prijs apart", () => {
    const met: ProductVoorstel = { naam: "a", prijsCent: 239, inhoud: "", label: "testgegevens" };
    const zonder: ProductVoorstel = {
      naam: "b",
      prijsCent: null,
      inhoud: "",
      label: "testgegevens",
    };
    const t = mandjeTotaal([
      { lijstNaam: "brood", product: met, aantal: 2 },
      { lijstNaam: "brood 2", product: zonder, aantal: 1 },
    ]);
    expect(t).toEqual({ totaalCent: 478, zonderPrijs: 1, stuks: 3 });
    expect(euroCent(478)).toBe("€ 4,78");
  });

  it("mandje doorsturen: testmodus, vast kenmerk, geen netwerk; lokaal kan het niet", async () => {
    const t = new TestSupermarktProvider();
    const p = (await t.productVoorstellen("melk"))[0]!;
    const a = await t.stuurMandje([{ lijstNaam: "melk", product: p, aantal: 1 }]);
    const b = await t.stuurMandje([{ lijstNaam: "melk", product: p, aantal: 1 }]);
    expect(a.test).toBe(true);
    expect(a.referentie).toMatch(/^TEST-\d{6}$/);
    expect(a).toEqual(b);
    await expect(t.stuurMandje([])).rejects.toThrow();
    expect(new LokaleSupermarkt().kanMandje).toBe(false);
    await expect(new LokaleSupermarkt().stuurMandje()).rejects.toThrow();
  });
});
