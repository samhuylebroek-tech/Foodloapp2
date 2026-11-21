import { describe, expect, it } from "vitest";
import {
  afstand,
  dagenIn,
  herkenOpdracht,
  omschrijf,
  vindRecept,
  type Opdracht,
} from "./opdrachten";

// Maandag 16 november 2026.
const VANDAAG = "2026-11-16";
const CTX = {
  vandaag: VANDAAG,
  namen: ["Marie", "Jan", "Lotte", "Gust"],
  recepten: [
    { id: "stoof", title: "Stoofvlees met frietjes" },
    { id: "bolo", title: "Spaghetti bolognese" },
    { id: "soep", title: "Romige pompoensoep" },
  ],
};
const MA = "2026-11-16";
const DI = "2026-11-17";
const WO = "2026-11-18";
const DO = "2026-11-19";
const VR = "2026-11-20";
const ZA = "2026-11-21";
const ZO = "2026-11-22";

const herken = (zin: string) => herkenOpdracht(zin, CTX);
const opdracht = (zin: string): Opdracht | null => {
  const h = herken(zin);
  return h.ok ? h.opdracht : null;
};

describe("opdrachten herkennen (zonder AI)", () => {
  const gevallen: [string, Opdracht][] = [
    // goedkoper
    ["Maak mijn week goedkoper", { soort: "goedkoper" }],
    ["maak m'n week goedkoper aub", { soort: "goedkoper" }],
    ["Kan het wat goedkoper deze week?", { soort: "goedkoper" }],
    ["maak mijn week goedkooper", { soort: "goedkoper" }],
    ["mijn weekmenu is te duur", { soort: "goedkoper" }],
    ["ik wil besparen op mijn boodschappen", { soort: "goedkoper" }],
    ["minder geld uitgeven deze week", { soort: "goedkoper" }],
    // vervangen
    ["Vervang woensdag", { soort: "vervang", datum: WO }],
    ["vervang woensag", { soort: "vervang", datum: WO }],
    ["iets anders voor woensdag", { soort: "vervang", datum: WO }],
    ["kan je donderdag veranderen", { soort: "vervang", datum: DO }],
    ["vervang woensdag door iets vegetarisch", { soort: "vervang", datum: WO, gewenst: "vega" }],
    ["vrijdag liever vis", { soort: "vervang", datum: VR, gewenst: "vis" }],
    ["vervang morgen", { soort: "vervang", datum: DI }],
    ["vervang woensdag met Gust", { soort: "vervang", datum: WO, metEter: "Gust" }],
    // weinig tijd
    ["Ik heb morgen 15 minuten", { soort: "weinig-tijd", datum: DI, minuten: 15 }],
    ["ik heb morgn maar 20 min", { soort: "weinig-tijd", datum: DI, minuten: 20 }],
    ["morgen weinig tijd", { soort: "weinig-tijd", datum: DI, minuten: 30 }],
    ["donderdag moet het snel gaan", { soort: "weinig-tijd", datum: DO, minuten: 30 }],
    ["vandaag een kwartiertje", { soort: "weinig-tijd", datum: MA, minuten: 15 }],
    ["overmorgen een half uur", { soort: "weinig-tijd", datum: WO, minuten: 30 }],
    ["vanavond iets rap", { soort: "weinig-tijd", datum: MA, minuten: 30 }],
    // mee-eters
    ["Gust eet zaterdag mee", { soort: "eter", datum: ZA, naam: "Gust", mee: true }],
    ["zaterdag eet gust mee", { soort: "eter", datum: ZA, naam: "Gust", mee: true }],
    ["Gust komt zaterdag eten", { soort: "eter", datum: ZA, naam: "Gust", mee: true }],
    ["Jan eet vrijdag niet mee", { soort: "eter", datum: VR, naam: "Jan", mee: false }],
    ["gsut eet zatedag mee", { soort: "eter", datum: ZA, naam: "Gust", mee: true }],
    // niet thuis
    ["Niemand thuis vrijdag", { soort: "niet-thuis", datum: VR }],
    ["vrijdag zijn we niet thuis", { soort: "niet-thuis", datum: VR }],
    ["vrijdag gaan we uit eten", { soort: "niet-thuis", datum: VR }],
    ["schrap donderdag", { soort: "niet-thuis", datum: DO }],
    ["zondag niet koken", { soort: "niet-thuis", datum: ZO }],
    // op de lijst
    [
      "Zet de ingrediënten van stoofvlees op de lijst",
      { soort: "op-lijst", zoek: "stoofvlees", receptId: "stoof" },
    ],
    [
      "zet de ingredienten voor de spaghetti op mijn boodschappenlijst",
      { soort: "op-lijst", zoek: "spaghetti", receptId: "bolo" },
    ],
    [
      "zet de boodschappen voor pompoensoep op de lijst",
      { soort: "op-lijst", zoek: "pompoensoep", receptId: "soep" },
    ],
    [
      "zet de ingredienten van lasagne op de lijst",
      { soort: "op-lijst", zoek: "lasagne", receptId: undefined },
    ],
    // wat met
    ["Wat kan ik maken met pompoen?", { soort: "wat-met", ingredient: "pompoen" }],
    ["wat kan ik koken met courgette", { soort: "wat-met", ingredient: "courgette" }],
    ["recepten met prei", { soort: "wat-met", ingredient: "prei" }],
    ["ik heb nog pompoen over", { soort: "wat-met", ingredient: "pompoen" }],
    ["wat doe ik met de rest van de spinazie", { soort: "wat-met", ingredient: "rest spinazie" }],
    // verplaatsen
    ["Verplaats donderdag naar vrijdag", { soort: "verplaats", van: DO, naar: VR }],
    ["verplaats dondrdag naar vrydag", { soort: "verplaats", van: DO, naar: VR }],
    ["schuif woensdag naar zaterdag", { soort: "verplaats", van: WO, naar: ZA }],
    ["wissel dinsdag en donderdag", { soort: "verplaats", van: DI, naar: DO }],
    ["donderdag naar volgende maandag", { soort: "verplaats", van: DO, naar: "2026-11-23" }],
  ];
  it(`herkent ${gevallen.length} zinnen (varianten en typfouten)`, () => {
    expect(gevallen.length).toBeGreaterThanOrEqual(40);
    const mis = gevallen
      .map(([zin, verwacht]) => ({ zin, verwacht: schoon(verwacht), kreeg: opdracht(zin) }))
      .filter((x) => JSON.stringify(x.kreeg && schoon(x.kreeg)) !== JSON.stringify(x.verwacht));
    expect(mis).toEqual([]);
  });

  const nietHerkend = [
    "",
    "   ",
    "hoe laat is het",
    "maak een cake",
    "ik heb honger",
    "wat is het weer morgen",
    "vervang",
    "zet op de lijst",
    "kun je zorgen voor wat rust",
    "dank je wel",
    "verplaats woensdag naar woensdag",
    "hallo foodlo",
  ];
  it.each(nietHerkend)("herkent '%s' niet (nooit gokken bij een wijziging)", (zin) => {
    const h = herken(zin);
    expect(h.ok).toBe(false);
    if (!h.ok) {
      expect(h.reden.length).toBeGreaterThan(5);
      expect(h.voorbeelden.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("een naam die niet in het gezin zit, is geen mee-eter", () => {
    expect(opdracht("Piet eet zaterdag mee")?.soort).not.toBe("eter");
  });

  it("korte afkortingen alleen als ze duidelijk een dag zijn", () => {
    expect(dagenIn(["verplaats", "do", "naar", "vr"], VANDAAG).map((d) => d.datum)).toEqual([
      DO,
      VR,
    ]);
    expect(dagenIn(["wat", "do", "ik"], VANDAAG)).toEqual([]);
  });

  it("een weekdag is de eerstvolgende (vandaag telt mee)", () => {
    expect(dagenIn(["maandag"], VANDAAG)[0]?.datum).toBe(MA);
    expect(dagenIn(["volgende", "maandag"], VANDAAG)[0]?.datum).toBe("2026-11-23");
    expect(dagenIn(["zondag"], "2026-11-18")[0]?.datum).toBe(ZO);
  });

  it("afstand en recept zoeken", () => {
    expect(afstand("woensag", "woensdag")).toBe(1);
    expect(afstand("abc", "xyzxyz", 2)).toBe(3);
    expect(vindRecept("bolognese", CTX.recepten)?.id).toBe("bolo");
    expect(vindRecept("taart", CTX.recepten)).toBeNull();
  });

  it("omschrijving in gewone taal", () => {
    const dag = (d: string) => (d === WO ? "woensdag" : d);
    expect(omschrijf({ soort: "vervang", datum: WO, gewenst: "vega" }, dag)).toBe(
      "Een ander gerecht voor woensdag (vegetarisch)",
    );
    expect(omschrijf({ soort: "goedkoper" }, dag)).toBe("Je week goedkoper maken");
  });
});

function schoon(o: Opdracht) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
