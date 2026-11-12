import { describe, expect, it } from "vitest";
import {
  avondGrens,
  etenstijd,
  hoofdStap,
  huidigeMaaltijd,
  opsomming,
  signalen,
  tijdsplan,
  type MaaltijdVandaag,
  type VandaagInvoer,
} from "./vandaag";

const om = (u: number, m = 0) => new Date(2026, 10, 9, u, m);
const recept = (id: string, minuten = 60, stappen = 5) => ({
  id,
  title: id,
  servings: 4,
  prep_minutes: minuten / 2,
  cook_minutes: minuten / 2,
  stappen,
});
const maal = (meal_type: string, r: ReturnType<typeof recept> | null, titel?: string) =>
  ({
    id: `${meal_type}-${r?.id ?? titel}`,
    meal_type,
    recept: r,
    custom_title: titel ?? null,
  }) satisfies MaaltijdVandaag;

const basis = (over: Partial<VandaagInvoer> = {}): VandaagInvoer => ({
  nu: om(16),
  vandaag: [maal("avondeten", recept("stoofvlees", 120))],
  morgen: [],
  ontbreektVandaag: [],
  nogKopenVandaag: [],
  ontbreektMorgen: [],
  voortgang: {},
  vrijeDagen: 0,
  aanvullen: 0,
  teKopen: 0,
  heeftRecepten: true,
  ...over,
});

describe("hoofdStap (WP3)", () => {
  it("alles in huis en nog vroeg: koken met 'begin om' (etenstijd − kooktijd)", () => {
    const s = hoofdStap(basis({ nu: om(14) }));
    expect(s).toMatchObject({ soort: "koken", beginOm: "16:30" });
  });

  it("het is tijd (of te laat): koken zonder 'begin om'", () => {
    expect(hoofdStap(basis({ nu: om(16, 20) }))).toMatchObject({ soort: "koken", beginOm: null });
    expect(hoofdStap(basis({ nu: om(18) }))).toMatchObject({ soort: "koken", beginOm: null });
  });

  it("ontbreekt er iets dat nog niet op de lijst staat: dat eerst (aanvullen)", () => {
    const s = hoofdStap(basis({ ontbreektVandaag: ["melk"], nogKopenVandaag: ["ui"] }));
    expect(s).toMatchObject({ soort: "aanvullen", ontbreekt: ["melk"] });
  });

  it("staat alles op de lijst maar nog niet gekocht: winkelen", () => {
    expect(hoofdStap(basis({ nogKopenVandaag: ["ui"] }))).toMatchObject({
      soort: "winkelen",
      nogKopen: ["ui"],
    });
  });

  it("aan het koken (stap bewaard): hervatten gaat voor alles, ook 's avonds laat", () => {
    const s = hoofdStap(
      basis({ nu: om(22), voortgang: { stoofvlees: 2 }, ontbreektVandaag: ["melk"] }),
    );
    expect(s).toMatchObject({ soort: "hervatten", stap: 2 });
  });

  it("stap 0 of voorbij de laatste stap telt niet als hervatten", () => {
    expect(hoofdStap(basis({ voortgang: { stoofvlees: 0 } })).soort).toBe("koken");
    expect(hoofdStap(basis({ voortgang: { stoofvlees: 5 } })).soort).toBe("koken");
  });

  it("niets gepland: kiezen; zonder recepten: eerste recept", () => {
    expect(hoofdStap(basis({ vandaag: [] })).soort).toBe("kiezen");
    expect(hoofdStap(basis({ vandaag: [], heeftRecepten: false })).soort).toBe("eerste-recept");
  });

  it("gepland zonder recept", () => {
    const s = hoofdStap(basis({ vandaag: [maal("avondeten", null, "Frietjes")] }));
    expect(s).toMatchObject({ soort: "zonder-recept" });
  });

  it("'s avonds laat: kijk naar morgen (avondeten met recept), met wat er ontbreekt", () => {
    const s = hoofdStap(
      basis({
        nu: om(21, 30),
        morgen: [maal("ontbijt", recept("pap")), maal("avondeten", recept("zalm"))],
        ontbreektMorgen: ["dille"],
      }),
    );
    expect(s).toMatchObject({ soort: "morgen", ontbreekt: ["dille"] });
    expect(s.soort === "morgen" && s.maaltijd?.recept?.id).toBe("zalm");
  });

  it("'s avonds laat en morgen nog niets: morgen (leeg) om te plannen", () => {
    expect(hoofdStap(basis({ nu: om(22) }))).toMatchObject({ soort: "morgen", maaltijd: null });
  });
});

describe("huidigeMaaltijd", () => {
  const dag = [
    maal("ontbijt", recept("pap", 10)),
    maal("middageten", recept("soep", 30)),
    maal("avondeten", recept("pasta", 30)),
  ];
  it("de eerstvolgende die nog niet voorbij is", () => {
    expect(huidigeMaaltijd(dag, om(7))?.recept?.id).toBe("pap");
    expect(huidigeMaaltijd(dag, om(11))?.recept?.id).toBe("soep");
    expect(huidigeMaaltijd(dag, om(14))?.recept?.id).toBe("pasta");
  });
  it("alles voorbij: de laatste van de dag", () => {
    expect(huidigeMaaltijd(dag, om(20, 30))?.recept?.id).toBe("pasta");
  });
  it("met recept gaat voor zonder recept op hetzelfde moment", () => {
    const m = [maal("avondeten", null, "Restjes"), maal("avondeten", recept("pasta"))];
    expect(huidigeMaaltijd(m, om(15))?.recept?.id).toBe("pasta");
  });
});

describe("signalen", () => {
  it("hooguit drie, en nooit wat de hoofdstap al zegt", () => {
    const i = basis({ aanvullen: 5, vrijeDagen: 3, teKopen: 9, nogKopenVandaag: ["ui"] });
    const s = signalen(i, hoofdStap(i));
    expect(s.map((x) => x.soort)).toEqual(["aanvullen", "week-vrij"]); // geen 'lijst' bij winkelen
  });
  it("niets aan de hand: geen signalen", () => {
    const i = basis();
    expect(signalen(i, hoofdStap(i))).toEqual([]);
  });
});

describe("opsomming", () => {
  it("leest als gewone taal", () => {
    expect(opsomming(["melk"])).toBe("melk");
    expect(opsomming(["melk", "ui"])).toBe("melk en ui");
    expect(opsomming(["melk", "ui", "dille"])).toBe("melk, ui en dille");
    expect(opsomming(["melk", "ui", "dille", "peper"])).toBe("melk, ui en 2 andere");
  });
});

describe("eigen etenstijden", () => {
  const laat = { avondeten: "20:00" };
  it("'begin om' volgt je eigen avondeten", () => {
    expect(hoofdStap(basis({ nu: om(14), etenstijden: laat }))).toMatchObject({
      soort: "koken",
      beginOm: "18:00",
    });
  });
  it("na 21 u nog vandaag als je laat eet; pas 2 uur na je avondeten naar morgen", () => {
    expect(hoofdStap(basis({ nu: om(21, 30), etenstijden: laat })).soort).toBe("koken");
    expect(hoofdStap(basis({ nu: om(22, 5), etenstijden: laat })).soort).toBe("morgen");
    // Vroeg eten verschuift de grens niet naar vóór 21 u.
    expect(
      hoofdStap(basis({ nu: om(20, 30), etenstijden: { avondeten: "17:30" } })).soort,
    ).not.toBe("morgen");
  });
  it("ongeldige tijd: standaard; 'alles in 1 blok' volgt je avondeten", () => {
    expect(etenstijd("avondeten", { avondeten: "25:99" })).toBe("18:30");
    expect(etenstijd("maaltijd", laat)).toBe("20:00");
    expect(etenstijd("ontbijt", laat)).toBe("08:00");
    expect(avondGrens()).toBe(21 * 60);
    expect(avondGrens({ avondeten: "19:45" })).toBe(21 * 60 + 45);
  });
});

// Review 2026-11-12, punt 8: Vandaag zegt wanneer je moet beginnen, ook als er nog iets ontbreekt.
describe("tijdsplan", () => {
  const stoof = recept("stoofvlees", 170);
  it("ruim op tijd: begin om, duur en aan tafel", () => {
    expect(tijdsplan("avondeten", stoof, om(14), { avondeten: "18:30" })).toEqual({
      soort: "later",
      beginOm: "15:40",
      aanTafel: "18:30",
      duurMin: 170,
    });
  });
  it("minder dan een kwartier voor de start: begin nu, nog op tijd", () => {
    expect(tijdsplan("avondeten", stoof, om(15, 30), { avondeten: "18:30" })).toEqual({
      soort: "nu",
      aanTafel: "18:30",
      duurMin: 170,
      laat: false,
    });
  });
  it("te laat begonnen: eerlijk zeggen wanneer je dan eet", () => {
    expect(tijdsplan("avondeten", stoof, om(17), { avondeten: "18:30" })).toEqual({
      soort: "nu",
      aanTafel: "19:50",
      duurMin: 170,
      laat: true,
    });
  });
  it("gokt niet: zonder kooktijd of ruim na het eten geen plan", () => {
    expect(tijdsplan("avondeten", recept("x", 0), om(14), { avondeten: "18:30" })).toBeNull();
    expect(tijdsplan("avondeten", stoof, om(20), { avondeten: "18:30" })).toBeNull();
  });
  it("zit ook in de hoofdstap als er nog iets ontbreekt", () => {
    const stap = hoofdStap(
      basis({ nu: om(14), vandaag: [maal("avondeten", stoof)], ontbreektVandaag: ["boter"] }),
    );
    expect(stap.soort).toBe("aanvullen");
    expect(stap.soort === "aanvullen" && stap.plan?.soort).toBe("later");
  });
});
