import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bepaalContext, komendeFeestdag, paaszondag } from "./context";
import { vatSamen, type Geschiedenis } from "./geschiedenis";
import { herstelNietNu, nietNuLijst, zetNietNu, NIET_NU_DAGEN } from "./niet-nu";
import { beveelAan, toegelaten, type Invoer, type Kandidaat } from "./voorstel";

// Woensdag 11 november 2026, 16 u.
const WOENSDAG = new Date(2026, 10, 11, 16, 0);
const leeg: Geschiedenis = { laatst: {}, komend: new Set(), minutenPerWeekdag: {} };
const k = (id: string, extra: Partial<Kandidaat> = {}): Kandidaat => ({
  id,
  title: id,
  minuten: 40,
  category: "hoofdgerecht",
  tags: [],
  ingredienten: [],
  ...extra,
});
const invoer = (kandidaten: Kandidaat[], extra: Partial<Invoer> = {}): Invoer => ({
  kandidaten,
  context: bepaalContext(WOENSDAG),
  voorraad: [],
  geschiedenis: leeg,
  voorkeur: { maxMinuten: 0, soort: null, vermijd: "" },
  ...extra,
});
const ids = (i: Invoer) => beveelAan(i).map((a) => a.id);
const redenen = (i: Invoer, id: string) =>
  beveelAan(i)
    .find((a) => a.id === id)
    ?.redenen.map((r) => r.tekst) ?? [];

describe("Context Engine", () => {
  it("weekdag telt vanaf maandag = 0, seizoen november = winter", () => {
    const c = bepaalContext(WOENSDAG);
    expect(c.weekdag).toBe(2);
    expect(c.uur).toBe(16);
    expect(c.datum).toBe("2026-11-11");
    expect(c.seizoen.id).toBe("winter");
    expect(c.weer).toBeNull();
  });

  it("Pasen klopt voor bekende jaren", () => {
    expect(paaszondag(2026).toDateString()).toBe(new Date(2026, 3, 5).toDateString());
    expect(paaszondag(2027).toDateString()).toBe(new Date(2027, 2, 28).toDateString());
  });

  it("feestdag pas 10 dagen vooraf, ook over de jaargrens", () => {
    expect(komendeFeestdag(new Date(2026, 10, 20))).toBeNull();
    expect(komendeFeestdag(new Date(2026, 10, 26))?.id).toBe("sinterklaas");
    expect(komendeFeestdag(new Date(2026, 11, 6))).toMatchObject({ id: "sinterklaas", over: 0 });
    expect(komendeFeestdag(new Date(2026, 11, 20))).toMatchObject({ id: "kerstmis", over: 5 });
    expect(komendeFeestdag(new Date(2026, 11, 28))?.id).toBe("oudejaar");
    expect(komendeFeestdag(new Date(2027, 0, 5))).toBeNull();
  });
});

describe("Cooking History Engine", () => {
  const plan = [
    // Drie woensdagen met snelle gerechten, één maandag.
    { recipe_id: "snel", plan_date: "2026-10-21" },
    { recipe_id: "snel", plan_date: "2026-10-28" },
    { recipe_id: "wok", plan_date: "2026-11-04" },
    { recipe_id: "stoof", plan_date: "2026-11-09" },
    { recipe_id: "stoof", plan_date: "2026-11-14" },
    { recipe_id: null, plan_date: "2026-11-01" },
  ];
  const g = vatSamen(plan, { snel: 20, wok: 25, stoof: 120 }, "2026-11-11");

  it("laatste datum in het verleden, toekomst apart", () => {
    expect(g.laatst).toEqual({ snel: "2026-10-28", wok: "2026-11-04", stoof: "2026-11-09" });
    expect([...g.komend]).toEqual(["stoof"]);
  });

  it("gewone kooktijd alleen met minstens 3 keer op die weekdag", () => {
    expect(g.minutenPerWeekdag).toEqual({ 2: 20 });
  });
});

describe("Meal Intelligence: harde regels", () => {
  it("allergeen wordt nooit voorgesteld", () => {
    const i = invoer([k("pesto", { ingredienten: ["walnoten", "basilicum"] })], {
      allergieen: ["noten"],
      voorraad: ["basilicum"],
    });
    expect(ids(i)).toEqual([]);
  });

  it("'liever niet' sluit uit", () => {
    const i = invoer([k("Champignonsoep", { ingredienten: ["champignons"] })], {
      voorkeur: { maxMinuten: 0, soort: null, vermijd: "geen champignons" },
      voorraad: ["champignons"],
    });
    expect(ids(i)).toEqual([]);
  });

  it("dieet uit de kennismaking: vegetarisch zonder vlees of vis, pescotarisch met vis", () => {
    const kip = k("Kip curry", { ingredienten: ["kipfilet"] });
    const zalm = k("Zalm uit de oven", { ingredienten: ["zalm"] });
    const v = (dieet: "vegetarisch" | "pescotarisch") => ({
      voorkeur: { maxMinuten: 0, soort: null, vermijd: "", dieet },
    });
    expect(toegelaten(kip, v("vegetarisch"))).toBe(false);
    expect(toegelaten(zalm, v("vegetarisch"))).toBe(false);
    expect(toegelaten(zalm, v("pescotarisch"))).toBe(true);
    expect(toegelaten(kip, v("pescotarisch"))).toBe(false);
  });

  it("'Niet nu' en geen maaltijd (dessert) worden niet voorgesteld", () => {
    const i = invoer(
      [k("a", { ingredienten: ["ui"] }), k("taart", { category: "dessert", ingredienten: ["ui"] })],
      { voorraad: ["ui"], nietNu: ["a"] },
    );
    expect(ids(i)).toEqual([]);
  });

  it("zonder reden geen voorstel", () => {
    expect(ids(invoer([k("los")]))).toEqual([]);
  });
});

describe("Meal Intelligence: redenen per factor", () => {
  it("voorraad: meer in huis wint, met reden", () => {
    const i = invoer(
      [
        k("Spinaziesoep", { ingredienten: ["spinazie", "ui", "bouillon"] }),
        k("Pasta", { ingredienten: ["pasta", "room", "spek", "ui"] }),
      ],
      { voorraad: ["spinazie", "ui", "bouillon", "ui"] },
    );
    const uit = beveelAan(i);
    expect(uit[0]?.id).toBe("Spinaziesoep");
    expect(uit[0]?.ontbreekt).toEqual([]);
    expect(uit[0]?.redenen[0]?.tekst).toMatch(/^Gebruikt je spinazie, ui en 1 andere|^Gebruikt je/);
  });

  it("gewoonte: op woensdag kook je meestal snel → lange gerechten zakken", () => {
    const g: Geschiedenis = { ...leeg, minutenPerWeekdag: { 2: 25 } };
    const i = invoer(
      [
        k("Wok", { minuten: 20, ingredienten: ["rijst"] }),
        k("Stoofvlees", { minuten: 150, ingredienten: ["rijst"] }),
      ],
      { geschiedenis: g, voorraad: ["rijst"] },
    );
    expect(ids(i)[0]).toBe("Wok");
    expect(redenen(i, "Wok")).toContain("Op woensdag kook je meestal snel (20 min)");
  });

  it("geen stereotype: zonder eigen gewoonte geen 'druk'-reden", () => {
    const i = invoer([k("Wok", { minuten: 20, ingredienten: ["rijst"] })], { voorraad: ["rijst"] });
    expect(redenen(i, "Wok").join(" ")).not.toMatch(/meestal/);
  });

  it("weer: koud → warm gerecht met temperatuur; zonder weer geen weerreden", () => {
    const koud = invoer([k("Pompoensoep", { category: "soep", ingredienten: ["ui"] })], {
      context: bepaalContext(WOENSDAG, { temp: 4, regen: true }),
      voorraad: ["ui"],
    });
    expect(redenen(koud, "Pompoensoep").join(" | ")).toMatch(
      /Warm eten voor een koude dag \(4 °C\)/,
    );
    const zonder = invoer([k("Pompoensoep", { category: "soep", ingredienten: ["ui"] })], {
      voorraad: ["ui"],
    });
    expect(redenen(zonder, "Pompoensoep").join(" ")).not.toMatch(/°C/);
  });

  it("weer: hitte → fris boven oven", () => {
    const i = invoer(
      [
        k("Ovenschotel", { ingredienten: ["kaas"] }),
        k("Griekse salade", { category: "salade", ingredienten: ["kaas"] }),
      ],
      {
        context: bepaalContext(new Date(2026, 6, 15, 17), { temp: 29, regen: false }),
        voorraad: ["kaas"],
      },
    );
    expect(ids(i)[0]).toBe("Griekse salade");
  });

  it("seizoen en feestdag geven een reden", () => {
    const i = invoer([k("Witloof in de oven", { ingredienten: ["witloof"] })], { voorraad: [] });
    expect(redenen(i, "Witloof in de oven")).toContain("Past bij het seizoen: soep en stoofpot");
    const kerst = invoer([k("Kalkoen met kerstsaus")], {
      context: bepaalContext(new Date(2026, 11, 20, 16)),
    });
    expect(redenen(kerst, "Kalkoen met kerstsaus")).toContain("Over 5 dagen is het Kerstmis");
  });

  it("variatie: onlangs gepland zakt; komend gepland zakt", () => {
    const g: Geschiedenis = { ...leeg, laatst: { a: "2026-11-09" }, komend: new Set(["b"]) };
    const kand = ["a", "b", "c"].map((id) => k(id, { ingredienten: ["ui"] }));
    expect(ids(invoer(kand, { geschiedenis: g, voorraad: ["ui"] }))).toEqual(["c", "b", "a"]);
  });

  it("sterren: lang niet gemaakt met 5 sterren komt terug", () => {
    const g: Geschiedenis = { ...leeg, laatst: { stoof: "2026-08-01" } };
    const i = invoer([k("stoof"), k("ander", { ingredienten: ["ui"] })], {
      geschiedenis: g,
      sterren: { stoof: 5 },
      voorraad: ["ui"],
    });
    expect(redenen(i, "stoof")).toContain("Lang niet gemaakt, je gaf het 5 sterren");
  });

  it("weinig sterren zakt, favoriet stijgt", () => {
    const kand = ["laag", "fav"].map((id) => k(id, { ingredienten: ["ui"] }));
    const i = invoer(kand, { sterren: { laag: 1 }, favorieten: ["fav"], voorraad: ["ui"] });
    expect(ids(i)).toEqual(["fav", "laag"]);
    expect(redenen(i, "fav")).toContain("Een van je favorieten");
  });

  it("soort van vandaag uit de weekmenu-instelling", () => {
    const i = invoer(
      [
        k("Zalm", { ingredienten: ["zalm", "citroen"] }),
        k("Kip", { ingredienten: ["kip", "citroen"] }),
      ],
      { voorkeur: { maxMinuten: 0, soort: "vis", vermijd: "" }, voorraad: ["citroen"] },
    );
    expect(ids(i)[0]).toBe("Zalm");
    expect(redenen(i, "Zalm")).toContain("Je koos vis voor woensdag");
  });

  it("nooit meer dan 2 redenen, en hooguit max voorstellen", () => {
    const kand = Array.from({ length: 6 }, (_, n) =>
      k(`soep ${n}`, { category: "soep", minuten: 20, ingredienten: ["ui", "pompoen"] }),
    );
    const uit = beveelAan(
      invoer(kand, {
        context: bepaalContext(new Date(2026, 10, 11, 18), { temp: 3, regen: true }),
        voorraad: ["ui", "pompoen"],
        favorieten: ["soep 0"],
        sterren: { "soep 0": 5 },
      }),
    );
    expect(uit).toHaveLength(3);
    for (const a of uit) expect(a.redenen.length).toBeLessThanOrEqual(2);
  });

  it("deterministisch: zelfde invoer, zelfde uitkomst", () => {
    const kand = ["b", "a", "c"].map((id) => k(id, { ingredienten: ["ui"] }));
    const i = invoer(kand, { voorraad: ["ui"] });
    expect(ids(i)).toEqual(["a", "b", "c"]);
    expect(ids(i)).toEqual(ids(i));
  });
});

describe("Niet nu (op het toestel)", () => {
  const opslag = new Map<string, string>();
  beforeEach(() => {
    opslag.clear();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (s: string) => opslag.get(s) ?? null,
        setItem: (s: string, v: string) => void opslag.set(s, v),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("7 dagen geldig, per gebruiker, en terug te zetten", () => {
    const t = Date.UTC(2026, 10, 11);
    zetNietNu("u1", "r1", t);
    expect(nietNuLijst("u1", t + 86400000)).toEqual(["r1"]);
    expect(nietNuLijst("u2", t)).toEqual([]);
    expect(nietNuLijst("u1", t + NIET_NU_DAGEN * 86400000)).toEqual([]);
    zetNietNu("u1", "r2", t);
    herstelNietNu("u1", "r2");
    expect(nietNuLijst("u1", t)).toEqual([]);
  });

  it("kapotte opslag breekt niets", () => {
    opslag.set("foodlo:niet-nu:u1", "{kapot");
    expect(nietNuLijst("u1")).toEqual([]);
    expect(nietNuLijst(null)).toEqual([]);
  });
});

describe("Meal Intelligence: één gerecht beoordelen (weekvoorstel)", () => {
  it("geeft redenen voor een gekozen dag, met de dag van die datum", async () => {
    const { beoordeel } = await import("./voorstel");
    const vrijdag = bepaalContext(new Date(2026, 10, 13, 18));
    const a = beoordeel(k("Zalm", { minuten: 20, ingredienten: ["zalm", "citroen"] }), {
      ...invoer([]),
      context: vrijdag,
      voorraad: ["citroen"],
      voorkeur: { maxMinuten: 30, soort: "vis", vermijd: "" },
    });
    expect(a.redenen.map((r) => r.tekst)).toEqual(["Gebruikt je citroen", "Klaar in 20 min"]);
  });
});
