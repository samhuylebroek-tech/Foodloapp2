import { describe, expect, it } from "vitest";
import { voorAI } from "@/lib/ai/privacy";
import type { HuishoudenLid, LidVoeding } from "@/lib/gezin-veiligheid";
import { LEGE_VOEDING } from "@/lib/persoonlijke-voeding";
import type { PlanKandidaat } from "@/lib/planner/engine";
import {
  dagNaam,
  maakActieVoorstel,
  nieuweRecepten,
  onveiligInVoorstel,
  type AssistentContext,
  type MenuRij,
  type Voorstel,
} from "./acties";
import { herkenOpdracht, type Opdracht } from "./opdrachten";
import { bereidVoorAI } from "./herkenner";

// Maandag 16 november 2026; gezin Peeters (Marie kijkt).
const VANDAAG = "2026-11-16";
const MARIE = "11111111-1111-4111-8111-111111111111";
const JAN_ID = "22222222-2222-4222-8222-222222222222";
const lid = (id: string, naam: string, extra: Partial<HuishoudenLid> = {}): HuishoudenLid => ({
  id,
  group_id: "g",
  naam,
  user_id: id === "m" ? MARIE : null,
  rol: "volwassene",
  beheerder_id: MARIE,
  ...extra,
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
const LEDEN = [
  lid("m", "Marie"),
  lid("j", "Jan", { user_id: JAN_ID, beheerder_id: JAN_ID }),
  // Lotte wordt door Jan beheerd en deelt haar allergie niet: Marie ziet alleen "niet geschikt".
  lid("l", "Lotte", { rol: "kind", beheerder_id: JAN_ID }),
  lid("g", "Gust"),
];
const VOEDING = new Map<string, LidVoeding>([
  ["l", voeding("l", { allergieen: ["noten"], delen_met_gezin: false, toestemming_door: JAN_ID })],
  ["g", voeding("g", { dieet: "vegetarisch" })],
]);

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

const KANDIDATEN: PlanKandidaat[] = [
  r("stoof", "Stoofvlees met frietjes", 170, [
    ["rundvlees", 1.2, "kg"],
    ["uien", 3, ""],
    ["bier", 50, "cl"],
  ]),
  r("bolo", "Spaghetti bolognese", 60, [
    ["spaghetti", 400, "g"],
    ["rundergehakt", 500, "g"],
    ["passata", 70, "cl"],
  ]),
  r("zalm", "Zalm met krieltjes", 25, [
    ["zalmfilet", 4, "stuk(s)"],
    ["krieltjes", 800, "g"],
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
    {
      category: "soep",
      tags: ["vegetarisch"],
    },
  ),
  r(
    "omelet",
    "Omelet met spinazie",
    15,
    [
      ["eieren", 8, ""],
      ["spinazie", 300, "g"],
    ],
    {
      tags: ["vegetarisch"],
    },
  ),
  r(
    "pasta",
    "Pasta met tomaat",
    20,
    [
      ["pasta", 400, "g"],
      ["passata", 50, "cl"],
    ],
    {
      tags: ["vegetarisch"],
    },
  ),
  r(
    "pesto",
    "Pasta pesto genovese",
    12,
    [
      ["pasta", 400, "g"],
      ["hazelnoten", 50, "g"],
    ],
    {
      tags: ["vegetarisch"],
    },
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
    {
      tags: ["vegetarisch"],
    },
  ),
];

const titel = (id: string | null) => KANDIDATEN.find((k) => k.id === id)?.title ?? "";
const rij = (
  n: number,
  datum: string,
  recipeId: string,
  eterIds: string[] | null = null,
  moment = "avondeten",
): MenuRij => ({
  id: `plan-${n}`,
  datum,
  moment,
  recipeId,
  titel: titel(recipeId),
  personen: eterIds?.length ?? 4,
  eterIds,
});

function context(
  extra: Partial<AssistentContext> = {},
  plan: Partial<AssistentContext["plan"]> = {},
): AssistentContext {
  return {
    vandaag: VANDAAG,
    rijen: [
      rij(1, "2026-11-16", "zalm", ["m", "j"]),
      rij(2, "2026-11-17", "pasta"),
      rij(3, "2026-11-18", "lasagne"),
      rij(4, "2026-11-19", "stoof", ["m", "j"]),
      rij(5, "2026-11-21", "bolo", ["m", "j"]),
    ],
    plan: { kandidaten: KANDIDATEN, apparatuur: ["oven", "kookplaat"], budget: 120, ...plan },
    leden: LEDEN,
    voeding: VOEDING,
    kijkerId: MARIE,
    inHuis: ["uien", "ui"],
    standaardPersonen: 2,
    hoofdMoment: "avondeten",
    ...extra,
  };
}

const NAMEN = LEDEN.map((l) => l.naam);
const voorstelVoor = (zin: string, ctx = context()): Voorstel => {
  const h = herkenOpdracht(zin, { vandaag: VANDAAG, namen: NAMEN, recepten: KANDIDATEN });
  if (!h.ok) throw new Error(`niet herkend: ${zin}`);
  return maakActieVoorstel(h.opdracht, ctx);
};
const VLEES_OF_VIS = new Set(["stoof", "bolo", "zalm"]);

describe("actie → voorstel → verschillen", () => {
  it("maak mijn week goedkoper: wissels met oud → nieuw, kost omlaag, alleen veilige gerechten", () => {
    const v = voorstelVoor("maak mijn week goedkoper");
    expect(v.leeg).toBeUndefined();
    expect(v.menu.length).toBeGreaterThan(0);
    expect(v.stappen.every((s) => s.soort === "vervang")).toBe(true);
    expect(v.kost!.verschil).toBeLessThan(0);
    for (const m of v.menu) {
      expect(m.van).not.toBe(m.naar);
      expect(m.uitleg).toMatch(/goedkoper/);
    }
    expect(onveiligInVoorstel(v, context())).toEqual([]);
  });

  it("vervang woensdag (hele gezin, ook Gust): vegetarisch en zonder noten voor Lotte", () => {
    const v = voorstelVoor("vervang woensdag");
    expect(v.stappen).toHaveLength(1);
    const s = v.stappen[0]!;
    expect(s.soort).toBe("vervang");
    if (s.soort !== "vervang") return;
    expect(s.planId).toBe("plan-3");
    expect(VLEES_OF_VIS.has(s.recipeId)).toBe(false);
    expect(s.recipeId).not.toBe("pesto");
    expect(s.recipeId).not.toBe("lasagne");
    expect(v.menu[0]).toMatchObject({ datum: "2026-11-18", van: "Groentelasagne" });
    expect(v.eters[0]!.namen).toEqual(["Marie", "Jan", "Lotte", "Gust"]);
    expect(v.menu[0]!.uitleg).toMatch(/past voor iedereen die meeëet/i);
  });

  it("vervang woensdag met Gust (niet standaard mee): Gust komt erbij en het gerecht is vegetarisch", () => {
    const ctx = context({
      rijen: [rij(3, "2026-11-18", "bolo", ["m", "j"])],
    });
    const v = voorstelVoor("vervang woensdag met Gust", ctx);
    const eters = v.stappen.find((s) => s.soort === "eters");
    const vervang = v.stappen.find((s) => s.soort === "vervang");
    expect(eters).toMatchObject({ lidIds: ["m", "j", "g"], personen: { nu: 3, voorheen: 2 } });
    expect(vervang && vervang.soort === "vervang" && VLEES_OF_VIS.has(vervang.recipeId)).toBe(
      false,
    );
    expect(onveiligInVoorstel(v, ctx)).toEqual([]);
  });

  it("ik heb morgen 15 minuten: een gerecht dat binnen 15 minuten klaar is", () => {
    const v = voorstelVoor("ik heb morgen 15 minuten");
    const s = v.stappen[0];
    expect(s?.soort).toBe("vervang");
    const k = KANDIDATEN.find((x) => s && s.soort === "vervang" && x.id === s.recipeId)!;
    expect(k.minuten).toBeLessThanOrEqual(15);
    // Pesto met hazelnoten is sneller, maar niet veilig voor Lotte: omelet.
    expect(k.id).toBe("omelet");
    expect(v.menu[0]!.uitleg).toMatch(/Klaar in 15 min/);
  });

  it("weinig tijd en het gerecht past al: niets te doen", () => {
    const v = voorstelVoor("vandaag 30 minuten");
    expect(v.leeg).toMatch(/klaar in 25 minuten/);
    expect(v.stappen).toEqual([]);
  });

  it("Gust eet zaterdag mee: Gust erbij, porties +1 en een vegetarisch gerecht i.p.v. bolognese", () => {
    const v = voorstelVoor("Gust eet zaterdag mee");
    expect(v.stappen[0]).toMatchObject({
      soort: "eters",
      planId: "plan-5",
      lidIds: ["m", "j", "g"],
    });
    const s = v.stappen[1];
    expect(s?.soort).toBe("vervang");
    expect(s && s.soort === "vervang" && VLEES_OF_VIS.has(s.recipeId)).toBe(false);
    expect(v.menu[0]!.uitleg).toMatch(
      /Niet geschikt voor Gust \(Gust: past niet bij vegetarisch\)/,
    );
    expect(v.eters[0]!.namen).toEqual(["Marie", "Jan", "Gust"]);
  });

  it("Jan eet vrijdag niet mee zonder maaltijd: uitleg, geen stappen", () => {
    const v = voorstelVoor("Jan eet vrijdag niet mee");
    expect(v.stappen).toEqual([]);
    expect(v.leeg).toMatch(/nog niets gepland/);
  });

  it("niemand thuis donderdag: maaltijd eraf, wat niemand meer nodig heeft van de lijst", () => {
    const v = voorstelVoor("niemand thuis donderdag");
    expect(v.stappen).toEqual([{ soort: "weg", planId: "plan-4" }]);
    expect(v.menu[0]).toMatchObject({ van: "Stoofvlees met frietjes", naar: null });
    expect(v.lijst.eraf).toContain("rundvlees");
    // Uien zijn in huis: geen lijstwijziging.
    expect(v.lijst.eraf).not.toContain("uien");
    expect(v.kost!.verschil).toBeLessThan(0);
  });

  it("verplaats donderdag naar woensdag: twee maaltijden wisselen, lijst blijft gelijk", () => {
    const v = voorstelVoor("verplaats donderdag naar woensdag");
    expect(v.stappen).toEqual([
      { soort: "verplaats", planId: "plan-4", datum: "2026-11-18", moment: "avondeten" },
      { soort: "verplaats", planId: "plan-3", datum: "2026-11-19", moment: "avondeten" },
    ]);
    expect(v.lijst).toEqual({ erbij: [], eraf: [] });
  });

  it("verplaats naar een vrije dag: één stap", () => {
    const v = voorstelVoor("verplaats donderdag naar vrijdag");
    expect(v.stappen).toEqual([
      { soort: "verplaats", planId: "plan-4", datum: "2026-11-20", moment: "avondeten" },
    ]);
  });

  it("zet de ingrediënten van stoofvlees op de lijst: wat je niet in huis hebt", () => {
    const v = voorstelVoor("zet de ingredienten van stoofvlees op de lijst");
    expect(v.stappen).toEqual([{ soort: "lijst", recipeId: "stoof", personen: 2 }]);
    expect(v.lijst.erbij).toEqual(expect.arrayContaining(["rundvlees", "bier"]));
    expect(v.lijst.erbij).not.toContain("uien");
  });

  it("wat kan ik maken met pompoen: ideeën, geen wijziging", () => {
    const v = voorstelVoor("wat kan ik maken met pompoen");
    expect(v.stappen).toEqual([]);
    expect(v.ideeen?.map((i) => i.id)).toEqual(["pompoen"]);
  });

  it("vervang een dag zonder maaltijd: een nieuw gerecht erbij", () => {
    const v = voorstelVoor("vervang vrijdag");
    expect(v.stappen[0]).toMatchObject({
      soort: "erbij",
      datum: "2026-11-20",
      moment: "avondeten",
    });
    expect(v.menu[0]!.van).toBeNull();
  });

  it("een dag in het verleden: niets", () => {
    const ctx = context({ vandaag: "2026-11-18" });
    const v = maakActieVoorstel({ soort: "vervang", datum: "2026-11-17" }, ctx);
    expect(v.stappen).toEqual([]);
  });

  it("'Nee' verandert niets: een voorstel maken wijzigt de context niet", () => {
    const ctx = context();
    const voor = JSON.stringify({ ...ctx, voeding: [...ctx.voeding] });
    for (const zin of [
      "maak mijn week goedkoper",
      "vervang woensdag",
      "niemand thuis donderdag",
      "Gust eet zaterdag mee",
    ])
      voorstelVoor(zin, ctx);
    expect(JSON.stringify({ ...ctx, voeding: [...ctx.voeding] })).toBe(voor);
  });

  it("dagnamen", () => {
    expect(dagNaam("2026-11-16", VANDAAG)).toBe("vandaag");
    expect(dagNaam("2026-11-17", VANDAAG)).toBe("morgen");
    expect(dagNaam("2026-11-18", VANDAAG)).toBe("woensdag");
    expect(dagNaam("2026-11-25", VANDAAG)).toBe("woensdag 25/11");
  });
});

describe("veiligheid bij elke actie", () => {
  const opdrachten: Opdracht[] = [
    { soort: "goedkoper" },
    { soort: "vervang", datum: "2026-11-17" },
    { soort: "vervang", datum: "2026-11-18", gewenst: "vis" },
    { soort: "vervang", datum: "2026-11-20" },
    { soort: "weinig-tijd", datum: "2026-11-17", minuten: 15 },
    { soort: "weinig-tijd", datum: "2026-11-19", minuten: 30 },
    { soort: "eter", datum: "2026-11-21", naam: "Gust", mee: true },
    { soort: "eter", datum: "2026-11-19", naam: "Lotte", mee: true },
    { soort: "wat-met", ingredient: "pasta" },
  ];

  it("je eigen allergie (eieren): nooit een gerecht met ei, bij geen enkele actie", () => {
    const ctx = context({}, { allergieen: ["eieren"] });
    for (const o of opdrachten) {
      const v = maakActieVoorstel(o, ctx);
      expect(nieuweRecepten(v)).not.toContain("omelet");
      expect(v.ideeen?.map((i) => i.id) ?? []).not.toContain("omelet");
      expect(onveiligInVoorstel(v, ctx)).toEqual([]);
    }
  });

  it("Lotte (notenallergie, niet gedeeld): nooit het pestogerecht, bij geen enkele actie", () => {
    const ctx = context();
    for (const o of opdrachten) {
      const v = maakActieVoorstel(o, ctx);
      expect(nieuweRecepten(v)).not.toContain("pesto");
      expect(v.ideeen?.map((i) => i.id) ?? []).not.toContain("pesto");
    }
  });

  it("vis gevraagd maar Gust eet mee: geen vis, wel een eerlijke melding", () => {
    const v = maakActieVoorstel(
      { soort: "vervang", datum: "2026-11-18", gewenst: "vis" },
      context(),
    );
    expect(nieuweRecepten(v)).not.toContain("zalm");
    expect(v.waarschuwingen.join(" ")).toMatch(/Geen vis gerecht dat voor iedereen past/);
  });

  it("de laatste controle houdt een onveilig voorstel tegen (ook als het van elders komt)", () => {
    const ctx = context();
    const vals: Voorstel = {
      ...maakActieVoorstel({ soort: "vervang", datum: "2026-11-18" }, ctx),
      stappen: [{ soort: "vervang", planId: "plan-3", recipeId: "pesto" }],
    };
    expect(onveiligInVoorstel(vals, ctx)).toEqual(["Pasta pesto genovese"]);
    const vlees: Voorstel = {
      ...vals,
      stappen: [{ soort: "vervang", planId: "plan-3", recipeId: "stoof" }],
    };
    expect(onveiligInVoorstel(vlees, ctx)).toEqual(["Stoofvlees met frietjes"]);
    const eigen = context({}, { allergieen: ["vis"] });
    const lijst: Voorstel = {
      ...vals,
      stappen: [{ soort: "lijst", recipeId: "zalm", personen: 2 }],
    };
    expect(onveiligInVoorstel(lijst, eigen)).toEqual(["Zalm met krieltjes"]);
  });
});

describe("privacy", () => {
  it("de reden van Lotte (niet gedeeld) staat nergens in een voorstel", () => {
    const ctx = context({ rijen: [rij(1, "2026-11-19", "pesto", ["m", "j"])] });
    const zinnen = [
      "Lotte eet donderdag mee",
      "vervang donderdag",
      "maak mijn week goedkoper",
      "zet de ingredienten van pasta pesto op de lijst",
    ];
    for (const zin of zinnen) {
      // Alle uitlegteksten (titels van je eigen recepten mogen "hazelnoten" bevatten).
      const v = voorstelVoor(zin, ctx);
      const tekst = JSON.stringify([
        v.titel,
        v.leeg,
        v.waarschuwingen,
        v.menu.map((m) => m.uitleg),
        v.ideeen?.map((i) => i.reden),
      ]).toLowerCase();
      expect(tekst, zin).not.toMatch(/noot|noten|allerg/);
    }
    const v = voorstelVoor("Lotte eet donderdag mee", ctx);
    expect(v.menu[0]!.uitleg).toMatch(/^Niet geschikt voor Lotte · /);
  });

  it("de gedeelde reden van Gust mag wel (hij deelt die met het gezin)", () => {
    const v = voorstelVoor("Gust eet zaterdag mee");
    expect(v.menu[0]!.uitleg).toMatch(/vegetarisch/);
  });

  it("wat naar een AI zou gaan: geen allergieën, dieet of namen met redenen", () => {
    const a = bereidVoorAI("Lotte heeft een notenallergie, vervang woensdag", NAMEN);
    expect(a).not.toMatch(/noten|allergie/i);
    expect(a).toMatch(/vervang woensdag/);
    // Namen van gezinsleden worden vervangen door een neutraal woord.
    expect(a).not.toMatch(/Lotte/);
    expect(voorAI("Gust is vegetarisch; iets met pompoen").tekst).toBe("iets met pompoen");
  });
});
