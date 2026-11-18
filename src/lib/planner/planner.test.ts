import { describe, expect, it } from "vitest";
import type { HuishoudenLid, LidVoeding } from "@/lib/gezin-veiligheid";
import { LEGE_VOEDING } from "@/lib/persoonlijke-voeding";
import type { EtersContext } from "@/lib/voorstel-eters";
import {
  APPARATEN,
  herkenApparatuur,
  kanMaken,
  moeilijkheidVan,
  ontbrekend,
  vereistenVoorRecept,
  vereisteTekst,
} from "./apparatuur";
import {
  alternatief,
  bekendeKost,
  filterVoorDag,
  maakGoedkoper,
  stelMenuSamen,
  vervangDag,
  type PlanContext,
  type PlanDag,
  type PlanKandidaat,
} from "./engine";
import {
  apparatuurVan,
  ervaringVan,
  inHuisVolgensNiveau,
  leesProfiel,
  LEEG_PROFIEL,
  naarRij,
} from "./profiel";

// ---------------------------------------------------------------- gezin Peeters

const MARIE = "11111111-1111-4111-8111-111111111111";
const lid = (id: string, naam: string): HuishoudenLid => ({
  id,
  group_id: "g",
  naam,
  user_id: id === "m" ? MARIE : null,
  rol: "volwassene",
  beheerder_id: MARIE,
});
const voeding = (lidId: string, v: Partial<LidVoeding>): LidVoeding => ({
  ...LEGE_VOEDING,
  lid_id: lidId,
  delen_met_gezin: true,
  toestemming_door: MARIE,
  toestemming_soort: "beheerder",
  toestemming_op: "2026-11-14T10:00:00Z",
  ...v,
});
const MARIE_LID = lid("m", "Marie");
const JAN = lid("j", "Jan");
const LOTTE = lid("l", "Lotte");
const GUST = lid("g", "Gust");
const VOEDING = new Map<string, LidVoeding>([
  ["l", voeding("l", { allergieen: ["noten"], delen_met_gezin: false })],
  ["g", voeding("g", { dieet: "vegetarisch" })],
]);
const eters = (...wie: HuishoudenLid[]): EtersContext => ({
  eters: wie,
  voeding: VOEDING,
  kijkerId: MARIE,
});

const r = (
  id: string,
  title: string,
  minuten: number,
  regels: [string, number | null, string][],
  extra: Partial<PlanKandidaat> = {},
): PlanKandidaat => ({
  id,
  title,
  minuten,
  category: "hoofdgerecht",
  tags: [],
  ingredienten: regels.map(([n]) => n),
  regels: regels.map(([name, quantity, unit]) => ({ name, quantity, unit })),
  servings: 4,
  vereist: [],
  moeilijkheid: "makkelijk",
  ...extra,
});

const RECEPTEN: PlanKandidaat[] = [
  r("stoof", "Stoofvlees met frietjes", 170, [
    ["rundvlees", 1, "kg"],
    ["uien", 3, ""],
    ["bier", 50, "cl"],
  ]),
  r("bolo", "Spaghetti bolognese", 60, [
    ["spaghetti", 400, "g"],
    ["rundergehakt", 500, "g"],
    ["passata", 70, "cl"],
  ]),
  r("kip", "Kip met rijst", 25, [
    ["kipfilet", 600, "g"],
    ["rijst", 300, "g"],
    ["paprika", 2, ""],
  ]),
  r(
    "pompoen",
    "Pompoensoep",
    35,
    [
      ["pompoen", 1, "kg"],
      ["ui", 1, ""],
      ["room", 20, "cl"],
    ],
    { category: "soep", tags: ["vegetarisch"] },
  ),
  r(
    "omelet",
    "Omelet met spinazie",
    15,
    [
      ["eieren", 8, ""],
      ["spinazie", 300, "g"],
    ],
    { tags: ["vegetarisch"] },
  ),
  r(
    "pasta",
    "Pasta met tomaat",
    20,
    [
      ["pasta", 400, "g"],
      ["passata", 50, "cl"],
    ],
    { tags: ["vegetarisch"] },
  ),
  r(
    "noten",
    "Pasta met pesto en pijnboompitten",
    20,
    [
      ["pasta", 400, "g"],
      ["hazelnoten", 50, "g"],
    ],
    { tags: ["vegetarisch"] },
  ),
  r("frietjes", "Krokante frietjes uit de airfryer", 25, [["aardappelen", 1, "kg"]], {
    tags: ["vegetarisch"],
    vereist: [["airfryer"]],
  }),
  r(
    "zalm",
    "Zalm uit de oven",
    25,
    [
      ["zalmfilet", 4, "stuk(s)"],
      ["krieltjes", 800, "g"],
    ],
    { vereist: [["oven"]] },
  ),
  r(
    "lasagne",
    "Groentelasagne",
    75,
    [
      ["lasagnebladen", 250, "g"],
      ["courgette", 2, ""],
      ["passata", 70, "cl"],
    ],
    { tags: ["vegetarisch", "feest"], vereist: [["oven"]], moeilijkheid: "moeilijk" },
  ),
];

// Maandag 16 t/m zondag 22 november 2026.
const WEEK = ["16", "17", "18", "19", "20", "21", "22"].map((d) => `2026-11-${d}`);
const allen = eters(MARIE_LID, JAN, LOTTE);
const metGust = eters(MARIE_LID, JAN, LOTTE, GUST);

function peeters(extra: Partial<PlanContext> = {}): PlanContext {
  const dagen: PlanDag[] = WEEK.map((datum, i) => ({
    datum,
    moment: "avondeten",
    eters: i === 2 || i === 6 ? metGust : allen,
    personen: i === 2 || i === 6 ? 4 : 3,
    maxMinuten: i < 5 ? 0 : 0,
    chips: i === 0 ? ["weinig-tijd"] : i === 1 ? ["niet-thuis"] : i === 4 ? ["feestelijk"] : [],
  }));
  return {
    dagen,
    kandidaten: RECEPTEN,
    apparatuur: ["oven", "kookplaat"],
    budget: 120,
    seed: 1,
    ...extra,
  };
}

const VLEES = new Set(["stoof", "bolo", "kip"]);

describe("planning-engine: scenario gezin Peeters", () => {
  const menu = stelMenuSamen(peeters());
  const op = (i: number) => menu.dagen[i]!;

  it("niets op dinsdag (niemand thuis)", () => {
    expect(op(1).status).toBe("niet-thuis");
    expect(op(1).keuze).toBeUndefined();
  });
  it("geen vlees of vis op woensdag en zondag (Gust eet vegetarisch mee)", () => {
    for (const i of [2, 6]) {
      expect(op(i).status).toBe("gekozen");
      expect(VLEES.has(op(i).keuze!.id)).toBe(false);
      expect(op(i).keuze!.id).not.toBe("zalm");
    }
  });
  it("maandag (weinig tijd) hooguit 30 minuten", () => {
    expect(op(0).keuze!.minuten).toBeGreaterThan(0);
    expect(op(0).keuze!.minuten).toBeLessThanOrEqual(30);
  });
  it("Lotte: nooit noten, ook al zegt de app niet waarom", () => {
    for (const d of menu.dagen) expect(d.keuze?.id).not.toBe("noten");
  });
  it("geen airfryer-recept zonder airfryer", () => {
    for (const d of menu.dagen) expect(d.keuze?.id).not.toBe("frietjes");
    const metAirfryer = stelMenuSamen(
      peeters({ apparatuur: ["oven", "kookplaat", "airfryer"], budget: null }),
    );
    expect(metAirfryer.dagen.some((d) => d.keuze?.id === "frietjes")).toBe(true);
  });
  it("geen gerecht twee keer in de week", () => {
    const ids = menu.dagen.map((d) => d.keuze?.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("porties uit het aantal eters en kost per dag en week", () => {
    expect(op(2).keuze!.personen).toBe(4);
    expect(op(0).keuze!.personen).toBe(3);
    const som = menu.dagen.reduce((s, d) => s + (bekendeKost(d.keuze?.kost) ?? 0), 0);
    expect(menu.kost.totaal).toBeCloseTo(som, 2);
    expect(menu.budget?.bedrag).toBe(120);
  });
  it("elke keuze heeft minstens één reden", () => {
    for (const d of menu.dagen.filter((x) => x.keuze))
      expect(d.keuze!.redenen.length).toBeGreaterThan(0);
  });
  it("deterministisch: dezelfde seed geeft hetzelfde menu", () => {
    const a = stelMenuSamen(peeters({ seed: 7 })).dagen.map((d) => d.keuze?.id);
    const b = stelMenuSamen(peeters({ seed: 7 })).dagen.map((d) => d.keuze?.id);
    expect(a).toEqual(b);
  });
});

describe("planning-engine: filters", () => {
  const dag: PlanDag = { datum: "2026-11-16", moment: "avondeten" };
  it("tijd per dag is hard; onbekende tijd telt niet als snel", () => {
    const { over } = filterVoorDag(
      { dagen: [], kandidaten: [...RECEPTEN, r("x", "Onbekend", 0, [["ui", 1, ""]])] },
      { ...dag, maxMinuten: 20 },
    );
    expect(over.every((k) => k.minuten > 0 && k.minuten <= 20)).toBe(true);
  });
  it("beginner: geen moeilijke recepten, tenzij versoepeld", () => {
    const ctx: PlanContext = { dagen: [], kandidaten: RECEPTEN, kookervaring: "beginner" };
    expect(filterVoorDag(ctx, dag).over.map((k) => k.id)).not.toContain("lasagne");
    expect(filterVoorDag({ ...ctx, versoepel: ["ervaring"] }, dag).over.map((k) => k.id)).toContain(
      "lasagne",
    );
  });
  it("ontbijt bij ontbijt, geen ontbijt als avondeten", () => {
    const oats = r("oats", "Overnight oats", 5, [["havermout", 50, "g"]], { category: "ontbijt" });
    const ctx: PlanContext = { dagen: [], kandidaten: [...RECEPTEN, oats] };
    expect(filterVoorDag(ctx, { ...dag, moment: "ontbijt" }).over.map((k) => k.id)).toEqual([
      "oats",
    ]);
    expect(filterVoorDag(ctx, dag).over.map((k) => k.id)).not.toContain("oats");
  });
  it("lege kandidaten: zegt welke filter het krapst is, versoepelen helpt", () => {
    const ctx: PlanContext = {
      dagen: [{ ...dag, maxMinuten: 10 }],
      kandidaten: RECEPTEN.filter((k) => k.minuten > 10),
    };
    const m = stelMenuSamen(ctx);
    expect(m.dagen[0]!.status).toBe("leeg");
    expect(m.dagen[0]!.krapste).toBe("tijd");
    expect(stelMenuSamen({ ...ctx, versoepel: ["tijd"] }).dagen[0]!.status).toBe("gekozen");
  });
  it("allergie en dieet worden nooit versoepeld", () => {
    const ctx: PlanContext = {
      dagen: [{ ...dag, eters: eters(GUST) }],
      kandidaten: RECEPTEN.filter((k) => VLEES.has(k.id)),
      versoepel: ["apparatuur", "tijd", "ervaring", "herhaling", "eters", "veiligheid"],
    };
    const m = stelMenuSamen(ctx);
    expect(m.dagen[0]!.status).toBe("leeg");
    expect(m.dagen[0]!.krapste).toBe("eters");
    const eigen = stelMenuSamen({
      dagen: [dag],
      kandidaten: [RECEPTEN[6]!],
      allergieen: ["noten"],
      versoepel: ["veiligheid"] as never,
    });
    expect(eigen.dagen[0]!.krapste).toBe("veiligheid");
  });
  it("wat al gepland staat, komt niet terug", () => {
    const m = stelMenuSamen({
      dagen: [dag],
      kandidaten: RECEPTEN.slice(0, 2),
      alGepland: new Set(["stoof"]),
    });
    expect(m.dagen[0]!.keuze!.id).toBe("bolo");
  });
});

describe("planning-engine: variatie, overlap en budget", () => {
  it("variatie: niet twee dagen na elkaar hetzelfde hoofdingrediënt", () => {
    const gelijk = [
      r("p1", "Pasta A", 20, [
        ["pasta", 400, "g"],
        ["passata", 50, "cl"],
      ]),
      r("p2", "Pasta B", 20, [
        ["pasta", 400, "g"],
        ["room", 20, "cl"],
      ]),
      r("s1", "Soep", 25, [
        ["wortel", 4, ""],
        ["prei", 1, ""],
      ]),
    ];
    const m = stelMenuSamen({
      dagen: [{ datum: "2026-11-16" }, { datum: "2026-11-17" }],
      kandidaten: gelijk,
    });
    const [a, b] = m.dagen.map((d) => d.keuze!.id);
    expect(a!.startsWith("p") && b!.startsWith("p")).toBe(false);
  });
  it("budget stuurt: met een klein budget kiest de engine goedkoper", () => {
    const duur = r("duur", "Biefstuk", 20, [["biefstuk", 800, "g"]]);
    const goedkoop = r("goed", "Linzensoep", 30, [
      ["linzen", 300, "g"],
      ["wortel", 2, ""],
    ]);
    const ctx = (budget: number | null): PlanContext => ({
      dagen: [{ datum: "2026-11-16", personen: 4 }],
      kandidaten: [duur, goedkoop],
      sterren: { duur: 5 },
      budget,
    });
    expect(stelMenuSamen(ctx(null)).dagen[0]!.keuze!.id).toBe("duur");
    expect(stelMenuSamen(ctx(30)).dagen[0]!.keuze!.id).toBe("goed");
  });
  it("prijs onbekend telt niet als € 0", () => {
    const onbekend = r("o", "Iets exotisch", 20, [["drakenfruit", 2, ""]]);
    const m = stelMenuSamen({
      dagen: [{ datum: "2026-11-16" }],
      kandidaten: [onbekend],
      budget: 50,
    });
    expect(m.kost.nietGeschat).toBe(1);
    expect(m.kost.geschat).toBe(0);
    expect(bekendeKost(m.dagen[0]!.keuze!.kost)).toBeNull();
  });
  it("meerdere weken: budget telt per 7 dagen", () => {
    const dagen = Array.from({ length: 14 }, (_, i) => ({
      datum: `2026-11-${String(16 + i).padStart(2, "0")}`,
    }));
    const m = stelMenuSamen({ dagen, kandidaten: RECEPTEN, budget: 100 });
    expect(m.budget?.bedrag).toBe(200);
    // Herhaling na een week mag (de lijst is te kort voor 14 verschillende).
    expect(m.dagen.filter((d) => d.keuze).length).toBeGreaterThan(RECEPTEN.length);
  });
});

describe("planning-engine: alternatieven", () => {
  const ctx = peeters({ budget: null });
  const menu = stelMenuSamen(ctx);
  const woensdag = 2;
  it("Goedkoper is echt goedkoper (donderdag)", () => {
    const huidig = menu.dagen[3]!.keuze!;
    const alt = alternatief(ctx, menu, 3, "goedkoper")!;
    expect(alt).toBeTruthy();
    expect(bekendeKost(alt.kost)!).toBeLessThan(bekendeKost(huidig.kost)!);
  });
  it("alternatieven op woensdag blijven veilig voor Gust en Lotte", () => {
    for (const soort of ["goedkoper", "sneller", "past-beter"] as const) {
      const alt = alternatief(ctx, menu, woensdag, soort);
      if (alt)
        expect(VLEES.has(alt.id) || ["zalm", "noten", "frietjes"].includes(alt.id)).toBe(false);
    }
    // De andere vegetarische gerechten staan al op andere dagen: geen herhaling binnen 7 dagen.
    expect(alternatief(ctx, menu, woensdag, "past-beter")).toBeNull();
    // Niets goedkoper dan de goedkoopste veilige keuze: dan eerlijk geen alternatief.
    expect(alternatief(ctx, menu, woensdag, "goedkoper")).toBeNull();
  });
  it("Sneller is sneller", () => {
    const huidig = menu.dagen[3]!.keuze!;
    const alt = alternatief(ctx, menu, 3, "sneller");
    expect(alt).toBeNull(); // zalm (25 min) en kip (25 min): niet sneller
    const vr = alternatief(ctx, menu, 4, "sneller")!;
    expect(vr.minuten).toBeLessThan(menu.dagen[4]!.keuze!.minuten);
    void huidig;
  });
  it("Past beter geeft een ander gerecht; vervangDag rekent de totalen opnieuw", () => {
    const alt = alternatief(ctx, menu, 3, "past-beter")!;
    expect(alt.id).not.toBe(menu.dagen[3]!.keuze!.id);
    const nieuw = vervangDag(menu, 3, alt, null);
    expect(nieuw.dagen[3]!.keuze!.id).toBe(alt.id);
    const som = nieuw.dagen.reduce((s, d) => s + (bekendeKost(d.keuze?.kost) ?? 0), 0);
    expect(nieuw.kost.totaal).toBeCloseTo(som, 2);
  });
  it("Maak mijn week goedkoper: alleen echte besparingen, nooit duurder", () => {
    const { menu: goedkoper, wissels } = maakGoedkoper(ctx, menu);
    expect(goedkoper.kost.totaal).toBeLessThanOrEqual(menu.kost.totaal);
    for (const w of wissels) expect(w.besparing).toBeGreaterThan(0);
    for (const i of [2, 6]) expect(VLEES.has(goedkoper.dagen[i]!.keuze!.id)).toBe(false);
  });
});

describe("apparatuur en vereisten", () => {
  it("herkent airfryer, slowcooker en oven uit de stappen", () => {
    expect(
      herkenApparatuur({
        title: "Frietjes",
        stappen: ["Bak 15 min in de airfryer op 180 graden."],
      }),
    ).toEqual([["airfryer"]]);
    expect(
      herkenApparatuur({ title: "Stoofpot", stappen: ["Zet 8 uur in de slowcooker."] }),
    ).toEqual([["slowcooker"]]);
    expect(
      herkenApparatuur({ title: "Zalm", stappen: ["Verwarm de oven voor op 200 graden."] }),
    ).toEqual([["oven"]]);
    expect(herkenApparatuur({ title: "Soep", stappen: ["Mix fijn."] })).toEqual([]);
    expect(
      herkenApparatuur({ title: "Broccoli", stappen: ["Stoom 6 min in de stoomoven."] }),
    ).toEqual([["stoomoven"]]);
  });
  it("'airfryer of oven' = één van beide", () => {
    const v = herkenApparatuur({
      title: "Kip",
      stappen: ["Bak in de airfryer of de oven 20 min."],
    });
    expect(v).toEqual([["airfryer", "oven"]]);
    expect(kanMaken(v, ["oven", "kookplaat"])).toBe(true);
    expect(kanMaken(v, ["kookplaat"])).toBe(false);
    expect(vereisteTekst(v[0]!)).toBe("airfryer of oven");
    expect(ontbrekend([["airfryer"]], ["oven"])).toEqual([["airfryer"]]);
  });
  it("wat je zelf kiest in de editor wint", () => {
    expect(vereistenVoorRecept([["oven"]], ["airfryer", "kookplaat"])).toEqual([["airfryer"]]);
    expect(vereistenVoorRecept([["oven"]], null)).toEqual([["oven"]]);
    expect(vereistenVoorRecept([["oven"]], [])).toEqual([]);
  });
  it("moeilijkheid uit het veld of geschat", () => {
    expect(moeilijkheidVan({ difficulty: "Moeilijk" })).toBe("moeilijk");
    expect(moeilijkheidVan({ stappen: Array(11).fill("x") })).toBe("moeilijk");
    expect(moeilijkheidVan({ minuten: 70 })).toBe("gemiddeld");
    expect(moeilijkheidVan({})).toBe("makkelijk");
  });
  it("tien toestellen om uit te kiezen", () => {
    expect(APPARATEN).toHaveLength(10);
  });
});

describe("planprofiel", () => {
  it("zonder keuze: oven + kookplaat aangenomen", () => {
    expect(apparatuurVan(LEEG_PROFIEL)).toEqual(["oven", "kookplaat"]);
    expect(apparatuurVan({ apparatuur: [] })).toEqual([]);
  });
  it("kookervaring uit het profiel, anders uit de kennismaking", () => {
    expect(ervaringVan({ kookervaring: null }, "nieuw")).toBe("beginner");
    expect(ervaringVan({ kookervaring: "ervaren" }, "nieuw")).toBe("ervaren");
    expect(ervaringVan({ kookervaring: null })).toBeNull();
  });
  it("voorraadniveau: onbekend = niets in huis; basis = alleen je gekozen producten", () => {
    expect(inHuisVolgensNiveau(null, ["melk"], ["bloem"])).toEqual([]);
    expect(inHuisVolgensNiveau("geen", ["melk"], ["bloem"])).toEqual([]);
    expect(inHuisVolgensNiveau("basis", ["melk"], ["bloem"])).toEqual(["bloem"]);
    expect(inHuisVolgensNiveau("volledig", ["melk"], ["bloem"])).toEqual(["melk"]);
  });
  it("leesProfiel laat ongeldige waarden vallen", () => {
    const p = leesProfiel({
      apparatuur: ["oven", "raket", "airfryer", "oven"],
      kookervaring: "chef",
      voorraadniveau: "basis",
      basisvoorraad: [" Bloem ", "x", 3, "bloem"],
      weekbudget: "120",
    });
    expect(p).toEqual({
      apparatuur: ["oven", "airfryer"],
      kookervaring: null,
      voorraadniveau: "basis",
      basisvoorraad: ["bloem"],
      weekbudget: 120,
    });
    expect(leesProfiel(null)).toEqual(LEEG_PROFIEL);
    expect(leesProfiel({ weekbudget: -5 }).weekbudget).toBeNull();
    expect(Object.keys(naarRij(p)).sort()).toEqual(
      ["apparatuur", "basisvoorraad", "kookervaring", "voorraadniveau", "weekbudget"].sort(),
    );
  });
});
