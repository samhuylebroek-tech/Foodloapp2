import { describe, expect, it } from "vitest";
import { lijstBijsturen, type Bijsturing, type LijstRegel } from "./kringloop";

const recepten = [
  { id: "pasta", title: "Pasta", servings: 4 },
  { id: "lasagne", title: "Lasagne", servings: 4 },
  { id: "soep", title: "Soep", servings: 2 },
];
const ingredienten = [
  { recipe_id: "pasta", name: "spaghetti", quantity: 400, unit: "g" },
  { recipe_id: "pasta", name: "tomaten", quantity: 4, unit: "" },
  { recipe_id: "pasta", name: "zout", quantity: null, unit: "" },
  { recipe_id: "lasagne", name: "gehakt", quantity: 0.5, unit: "kg" },
  { recipe_id: "lasagne", name: "tomaten", quantity: 2, unit: "" },
  { recipe_id: "lasagne", name: "melk", quantity: 5, unit: "dl" },
  { recipe_id: "soep", name: "pompoen", quantity: 1, unit: "" },
  { recipe_id: "soep", name: "melk", quantity: 20, unit: "cl" },
];
const vandaag = "2026-11-09";
const maal = (recipe_id: string, plan_date = vandaag, personen: number | null = null) => ({
  plan_date,
  recipe_id,
  personen,
});

/** Past een bijsturing toe zoals de databanklaag dat doet. */
function pasToe(lijst: LijstRegel[], b: Bijsturing): LijstRegel[] {
  const weg = new Set(b.weg.map((w) => w.id));
  let n = 0;
  return [
    ...lijst
      .filter((i) => !weg.has(i.id))
      .map((i) => {
        const w = b.bijwerken.find((x) => x.id === i.id);
        return w ? { ...i, quantity: w.quantity, recipe_id: w.recipe_id } : i;
      }),
    ...b.nieuw.map((r) => ({
      id: `n${++n}-${r.naam}`,
      name: r.naam,
      quantity: r.quantity,
      unit: r.unit,
      checked: false,
      recipe_id: r.recipe_id,
    })),
  ];
}

function stuur(
  plan: ReturnType<typeof maal>[],
  lijst: LijstRegel[],
  toegevoegd: string[],
  weggehaald: string[],
  voorraad: { id: string; naam: string; hoeveelheid: number | null; eenheid: string | null }[] = [],
) {
  return lijstBijsturen({
    plan,
    recepten,
    ingredienten,
    voorraad,
    lijst,
    vanaf: vandaag,
    toegevoegd,
    weggehaald,
  });
}

const regel = (l: LijstRegel[], naam: string) => l.filter((i) => i.name === naam);

describe("lijstBijsturen (WP4)", () => {
  it("gerecht erbij: alleen het tekort komt op de lijst, voorraad en basis tellen mee", () => {
    const b = stuur(
      [maal("pasta")],
      [],
      ["pasta"],
      [],
      [{ id: "v", naam: "spaghetti", hoeveelheid: 150, eenheid: "g" }],
    );
    expect(b.nieuw).toEqual([
      { naam: "spaghetti", quantity: 250, unit: "g", recipe_id: "pasta" },
      { naam: "tomaten", quantity: 4, unit: "", recipe_id: "pasta" },
    ]);
    expect(b.weg).toEqual([]);
  });

  it("tweede gerecht met hetzelfde product: één regel, hoeveelheden en eenheden samengeteld", () => {
    const l1 = pasToe([], stuur([maal("lasagne")], [], ["lasagne"], []));
    const plan = [maal("lasagne"), maal("soep", "2026-11-10")];
    const l2 = pasToe(l1, stuur(plan, l1, ["soep"], []));
    expect(regel(l2, "melk")).toHaveLength(1);
    expect(regel(l2, "melk")[0]!.quantity).toBe(7); // 5 dl + 20 cl = 7 dl
    expect(regel(l2, "melk")[0]!.unit).toBe("dl");
  });

  it("gerecht weg: alleen wat niemand meer nodig heeft verdwijnt; gedeeld product wordt kleiner", () => {
    const plan = [maal("pasta"), maal("lasagne", "2026-11-10")];
    const l1 = pasToe([], stuur(plan, [], ["pasta", "lasagne"], []));
    expect(regel(l1, "tomaten")[0]!.quantity).toBe(6);
    const b = stuur([maal("lasagne", "2026-11-10")], l1, [], ["pasta"]);
    const l2 = pasToe(l1, b);
    expect(regel(l2, "spaghetti")).toHaveLength(0);
    expect(regel(l2, "tomaten")[0]!.quantity).toBe(2);
    // De regel hangt nu aan het gerecht dat ze nog nodig heeft.
    expect(regel(l2, "tomaten")[0]!.recipe_id).toBe("lasagne");
    expect(regel(l2, "gehakt")).toHaveLength(1);
  });

  it("eigen regels van de gebruiker verdwijnen nooit en tellen mee als 'staat al op je lijst'", () => {
    const eigen: LijstRegel[] = [
      { id: "e1", name: "spaghetti", quantity: null, unit: "", checked: false, recipe_id: null },
      { id: "e2", name: "koffie", quantity: 1, unit: "", checked: false, recipe_id: null },
    ];
    const b1 = stuur([maal("pasta")], eigen, ["pasta"], []);
    expect(b1.nieuw.map((n) => n.naam)).toEqual(["tomaten"]); // spaghetti staat er al
    const l1 = pasToe(eigen, b1);
    const b2 = stuur([], l1, [], ["pasta"]);
    const l2 = pasToe(l1, b2);
    expect(l2.map((i) => i.id).sort()).toEqual(["e1", "e2"]);
  });

  it("eigen regel met hoeveelheid blijft onaangeroerd: alleen het tekort komt op een Foodlo-regel", () => {
    const eigen: LijstRegel[] = [
      { id: "e1", name: "melk", quantity: 2, unit: "dl", checked: false, recipe_id: null },
    ];
    const b1 = stuur([maal("lasagne")], eigen, ["lasagne"], []);
    expect(b1.bijwerken.some((w) => w.id === "e1")).toBe(false);
    const l1 = pasToe(eigen, b1);
    const melk1 = regel(l1, "melk");
    expect(melk1).toContainEqual(eigen[0]);
    expect(melk1.find((i) => i.recipe_id === "lasagne")).toMatchObject({ quantity: 3, unit: "dl" });
    // Gerecht weer weg: de Foodlo-regel verdwijnt, de eigen regel blijft exact zoals hij was.
    const l2 = pasToe(l1, stuur([], l1, [], ["lasagne"]));
    expect(regel(l2, "melk")).toEqual([eigen[0]]);
  });

  it("WP5: een in de winkel vervangen regel telt als het oorspronkelijke product (geen dubbel)", () => {
    const l1 = pasToe([], stuur([maal("pasta")], [], ["pasta"], []));
    const vervangen = l1.map((i) =>
      i.name === "tomaten" ? { ...i, name: "Tomaten uit blik (i.p.v. tomaten)" } : i,
    );
    // Lasagne erbij: de vervangen regel wordt bijgewerkt, er komt geen tweede tomatenregel.
    const b = stuur([maal("pasta"), maal("lasagne")], vervangen, ["lasagne"], []);
    const l2 = pasToe(vervangen, b);
    const tomaten = l2.filter((i) => /tomaten/i.test(i.name));
    expect(tomaten).toHaveLength(1);
    expect(tomaten[0]).toMatchObject({ name: "Tomaten uit blik (i.p.v. tomaten)", quantity: 6 });
  });

  it("vervangen (pasta → lasagne): oude producten weg, gedeelde aangepast, nieuwe erbij", () => {
    const l1 = pasToe([], stuur([maal("pasta")], [], ["pasta"], []));
    const b = stuur([maal("lasagne")], l1, ["lasagne"], ["pasta"]);
    const l2 = pasToe(l1, b);
    expect(regel(l2, "spaghetti")).toHaveLength(0);
    expect(regel(l2, "tomaten")).toEqual([
      expect.objectContaining({ quantity: 2, recipe_id: "lasagne" }),
    ]);
    expect(regel(l2, "gehakt")[0]).toEqual(expect.objectContaining({ quantity: 0.5, unit: "kg" }));
  });

  it("meerdere dagen: zelfde gerecht twee keer, één dag weg → helft blijft; geen dubbels", () => {
    const plan = [maal("pasta"), maal("pasta", "2026-11-12")];
    const l1 = pasToe([], stuur(plan, [], ["pasta"], []));
    expect(regel(l1, "spaghetti")).toEqual([expect.objectContaining({ quantity: 800 })]);
    const l2 = pasToe(l1, stuur([maal("pasta", "2026-11-12")], l1, [], ["pasta"]));
    expect(regel(l2, "spaghetti")).toEqual([expect.objectContaining({ quantity: 400 })]);
  });

  it("verplaatst naar een andere dag binnen het venster: lijst blijft gelijk", () => {
    const l1 = pasToe([], stuur([maal("pasta")], [], ["pasta"], []));
    const b = stuur([maal("pasta", "2026-11-11")], l1, ["pasta"], ["pasta"]);
    expect(b).toEqual({ nieuw: [], bijwerken: [], weg: [] });
  });

  it("dubbele Foodlo-regels (bv. twee vensters tegelijk) worden één regel met de juiste hoeveelheid", () => {
    const dubbel: LijstRegel[] = [
      { id: "a", name: "spaghetti", quantity: 400, unit: "g", checked: false, recipe_id: "pasta" },
      { id: "b", name: "spaghetti", quantity: 0.4, unit: "kg", checked: false, recipe_id: "pasta" },
    ];
    const l = pasToe(dubbel, stuur([maal("pasta")], dubbel, ["pasta"], []));
    expect(regel(l, "spaghetti")).toEqual([expect.objectContaining({ id: "a", quantity: 400 })]);
  });

  it("idempotent: nog eens bijsturen op dezelfde stand doet niets", () => {
    const plan = [maal("pasta"), maal("lasagne", "2026-11-10")];
    const l1 = pasToe([], stuur(plan, [], ["pasta", "lasagne"], []));
    expect(stuur(plan, l1, ["pasta", "lasagne"], [])).toEqual({
      nieuw: [],
      bijwerken: [],
      weg: [],
    });
  });

  it("alleen weghalen zet nooit iets bij (ook als de lijst nooit aangevuld werd)", () => {
    const lijst: LijstRegel[] = [
      { id: "t", name: "tomaten", quantity: 1, unit: "", checked: false, recipe_id: "lasagne" },
    ];
    const b = stuur([maal("lasagne")], lijst, [], ["pasta"]);
    expect(b.nieuw).toEqual([]);
    expect(b.bijwerken.filter((w) => (w.quantity ?? 0) > 1)).toEqual([]);
  });

  it("afgevinkte regels (in je kar) blijven onaangeroerd", () => {
    const lijst: LijstRegel[] = [
      { id: "k", name: "spaghetti", quantity: 400, unit: "g", checked: true, recipe_id: "pasta" },
    ];
    const b = stuur([], lijst, [], ["pasta"]);
    expect(b.weg).toEqual([]);
  });

  it("'gehakt' (ook een bijwoord) wordt herkend op de lijst: geen tweede regel", () => {
    const lijst: LijstRegel[] = [
      { id: "g", name: "gehakt", quantity: 500, unit: "g", checked: false, recipe_id: "lasagne" },
    ];
    const b = stuur([maal("lasagne")], lijst, ["lasagne"], []);
    expect(b.nieuw.some((n) => n.naam === "gehakt")).toBe(false);
    expect(b.weg).toEqual([]);
  });

  it("porties: 8 personen voor een recept van 4 → dubbele hoeveelheid", () => {
    const b = stuur([maal("pasta", vandaag, 8)], [], ["pasta"], []);
    expect(b.nieuw.find((n) => n.naam === "spaghetti")?.quantity).toBe(800);
  });
});

describe("telbare dingen", () => {
  it("geschaald naar personen: stuks naar boven afgerond (geen 1,5 tomaat), gram exact", () => {
    // 6 personen voor een recept van 4 → factor 1,5: 4 tomaten → 6; 400 g → 600 g.
    // 3 personen → factor 0,75: 4 tomaten → 3; 400 g → 300 g.
    const b = lijstBijsturen({
      plan: [{ plan_date: "2026-11-09", recipe_id: "pasta", personen: 3 }],
      recepten,
      ingredienten,
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-09",
      toegevoegd: ["pasta"],
      weggehaald: [],
    });
    expect(b.nieuw).toEqual([
      expect.objectContaining({ naam: "spaghetti", quantity: 300 }),
      expect.objectContaining({ naam: "tomaten", quantity: 3 }),
    ]);
    const c = lijstBijsturen({
      plan: [{ plan_date: "2026-11-09", recipe_id: "lasagne", personen: 3 }],
      recepten,
      ingredienten,
      voorraad: [],
      lijst: [],
      vanaf: "2026-11-09",
      toegevoegd: ["lasagne"],
      weggehaald: [],
    });
    // 2 tomaten × 0,75 = 1,5 → 2
    expect(c.nieuw.find((n) => n.naam === "tomaten")?.quantity).toBe(2);
  });
});
