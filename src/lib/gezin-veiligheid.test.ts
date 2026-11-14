import { describe, expect, it } from "vitest";
import {
  initialen,
  lidSamenvatting,
  magRedenZien,
  magVoorkeurenBeheren,
  oordeelVoorEters,
  oordeelVoorLid,
  personenVoor,
  waarschuwingTekst,
  type HuishoudenLid,
  type LidVoeding,
} from "./gezin-veiligheid";
import {
  normaliseerVoeding,
  teVermijdenAllergenen,
  voegSamen,
  voegTermToe,
  heeftVoeding,
  toestemmingDatum,
  LEGE_VOEDING,
} from "./persoonlijke-voeding";

const MARIE = "11111111-1111-4111-8111-111111111111";
const JAN = "22222222-2222-4222-8222-222222222222";

const lid = (id: string, naam: string, extra: Partial<HuishoudenLid> = {}): HuishoudenLid => ({
  id,
  group_id: "g",
  naam,
  user_id: null,
  rol: "kind",
  beheerder_id: JAN,
  ...extra,
});
const voeding = (lidId: string, v: Partial<LidVoeding>): LidVoeding => ({
  ...LEGE_VOEDING,
  lid_id: lidId,
  delen_met_gezin: false,
  toestemming_door: JAN,
  toestemming_soort: "beheerder",
  toestemming_op: "2026-11-14T10:00:00Z",
  ...v,
});

const pesto = {
  title: "Pasta met pesto",
  ingredienten: ["spaghetti", "basilicum", "pijnboompitten", "hazelnoten", "parmezaan"],
};
const stoof = { title: "Stoofvlees", ingredienten: ["rundvlees", "uien", "bier"] };
const soep = { title: "Pompoensoep", ingredienten: ["pompoen", "ui", "kokosmelk"] };

describe("persoonlijke voeding: normaliseren", () => {
  it("houdt alleen vaste codes en korte termen", () => {
    const v = normaliseerVoeding({
      allergieen: ["noten", "noten", "kanker", 3 as unknown as string],
      intoleranties: ["lactose", "iets"],
      dieet: "vegetarisch",
      uitsluitingen: ["  bloemkool  ", "BLOEMKOOL", "x".repeat(80), ""],
    });
    expect(v.allergieen).toEqual(["noten"]);
    expect(v.intoleranties).toEqual(["lactose"]);
    expect(v.dieet).toBe("vegetarisch");
    expect(v.uitsluitingen).toEqual(["bloemkool", "x".repeat(40)]);
  });
  it("ongeldig dieet wordt null, lege invoer is leeg", () => {
    expect(normaliseerVoeding({ dieet: "carnivoor" as never }).dieet).toBeNull();
    expect(normaliseerVoeding(null)).toEqual(LEGE_VOEDING);
    expect(heeftVoeding(LEGE_VOEDING)).toBe(false);
    expect(heeftVoeding({ ...LEGE_VOEDING, dieet: "alles" })).toBe(false);
    expect(heeftVoeding({ ...LEGE_VOEDING, allergieen: ["sesam"] })).toBe(true);
  });
  it("maximaal 20 termen, geen dubbels", () => {
    let l: string[] = [];
    for (let i = 0; i < 25; i++) l = voegTermToe(l, `term ${i}`);
    expect(l).toHaveLength(20);
    expect(voegTermToe(["Prei"], "prei")).toEqual(["Prei"]);
  });
  it("intoleranties tellen mee als te vermijden allergeen", () => {
    expect(
      teVermijdenAllergenen({ allergieen: ["noten"], intoleranties: ["lactose", "fructose"] }),
    ).toEqual(["noten", "melk"]);
  });
  it("toestel en account samen: strengste kant, toestel blijft terugval", () => {
    expect(voegSamen({ allergieen: ["sesam"], dieet: "alles" }, null)).toEqual({
      allergieen: ["sesam"],
      dieet: "alles",
    });
    const s = voegSamen(
      { allergieen: ["sesam"], dieet: "alles" },
      { ...LEGE_VOEDING, allergieen: ["noten"], intoleranties: ["gluten"], dieet: "vegetarisch" },
    );
    expect(s.allergieen.sort()).toEqual(["gluten", "noten", "sesam"]);
    expect(s.dieet).toBe("vegetarisch");
  });
  it("toestemmingsdatum in Belgische notatie", () => {
    expect(toestemmingDatum("2026-11-14T10:00:00Z")).toBe("14/11/2026");
    expect(toestemmingDatum(null)).toBe("");
  });
});

describe("veiligheid per lid", () => {
  it("notenallergie: pesto met hazelnoten is niet veilig", () => {
    const o = oordeelVoorLid(pesto, { ...LEGE_VOEDING, allergieen: ["noten"] });
    expect(o.veilig).toBe(false);
    expect(o.reden).toContain("noten");
    expect(oordeelVoorLid(soep, { ...LEGE_VOEDING, allergieen: ["noten"] }).veilig).toBe(true);
  });
  it("vegetarisch: stoofvlees niet veilig, soep wel", () => {
    const veg = { ...LEGE_VOEDING, dieet: "vegetarisch" as const };
    expect(oordeelVoorLid(stoof, veg).veilig).toBe(false);
    expect(oordeelVoorLid(soep, veg).veilig).toBe(true);
  });
  it("liever niet: term in de ingrediënten", () => {
    const o = oordeelVoorLid(soep, { ...LEGE_VOEDING, uitsluitingen: ["kokos"] });
    expect(o).toEqual({ veilig: false, reden: "liever geen kokos" });
  });
  it("zonder ingrediënten en met allergie: niet te controleren", () => {
    const o = oordeelVoorLid(
      { title: "Iets", ingredienten: [] },
      { ...LEGE_VOEDING, allergieen: ["noten"] },
    );
    expect(o.veilig).toBeNull();
  });
});

describe("zichtbaarheid", () => {
  const lotte = lid("l", "Lotte");
  const gust = lid("g2", "Gust", { rol: "volwassene", beheerder_id: MARIE });
  const vLotte = voeding("l", { allergieen: ["noten"], delen_met_gezin: false });
  const vGust = voeding("g2", {
    dieet: "vegetarisch",
    delen_met_gezin: true,
    toestemming_door: MARIE,
  });

  it("beheerder en lid zelf zien de reden; anderen alleen als gedeeld", () => {
    expect(magRedenZien(lotte, vLotte, JAN)).toBe(true);
    expect(magRedenZien(lotte, vLotte, MARIE)).toBe(false);
    expect(magRedenZien(gust, vGust, JAN)).toBe(true);
    const jan = lid("j", "Jan", { user_id: JAN, beheerder_id: null, rol: "volwassene" });
    expect(magRedenZien(jan, voeding("j", {}), JAN)).toBe(true);
    expect(magRedenZien(jan, voeding("j", {}), MARIE)).toBe(false);
    expect(magRedenZien(lotte, vLotte, null)).toBe(false);
  });
  it("beheren: alleen lid zelf (account) of beheerder (zonder account)", () => {
    expect(magVoorkeurenBeheren(lotte, JAN)).toBe(true);
    expect(magVoorkeurenBeheren(lotte, MARIE)).toBe(false);
    const jan = lid("j", "Jan", { user_id: JAN, beheerder_id: MARIE });
    expect(magVoorkeurenBeheren(jan, MARIE)).toBe(false);
    expect(magVoorkeurenBeheren(jan, JAN)).toBe(true);
  });
  it("oordeel voor mee-eters: Marie ziet 'niet veilig voor Lotte' zonder reden", () => {
    const map = new Map([
      ["l", vLotte],
      ["g2", vGust],
    ]);
    const o = oordeelVoorEters(pesto, [lotte, gust], map, MARIE);
    expect(o[0]).toEqual({ lidId: "l", naam: "Lotte", veilig: false });
    expect(o[1]!.veilig).toBe(true);
    expect(waarschuwingTekst(o)).toBe("Niet veilig voor Lotte");
    const viaJan = oordeelVoorEters(pesto, [lotte], map, JAN);
    expect(viaJan[0]!.reden).toContain("noten");
  });
  it("gedeeld lid: reden zichtbaar voor iedereen in het gezin", () => {
    const o = oordeelVoorEters(stoof, [gust], new Map([["g2", vGust]]), JAN);
    expect(o[0]).toMatchObject({ veilig: false, reden: expect.stringContaining("vegetarisch") });
  });
  it("niet leesbaar: het serveroordeel telt, zonder reden", () => {
    const o = oordeelVoorEters(pesto, [lotte], new Map(), MARIE, new Map([["l", false]]));
    expect(o).toEqual([{ lidId: "l", naam: "Lotte", veilig: false }]);
    expect(oordeelVoorEters(pesto, [lotte], new Map(), MARIE)[0]!.veilig).toBe(true);
  });
  it("waarschuwing voor meerdere namen", () => {
    expect(
      waarschuwingTekst([
        { lidId: "a", naam: "Lotte", veilig: false },
        { lidId: "b", naam: "Gust", veilig: false },
        { lidId: "c", naam: "Jan", veilig: false },
      ]),
    ).toBe("Niet veilig voor Lotte, Gust en Jan");
    expect(waarschuwingTekst([{ lidId: "a", naam: "Jan", veilig: true }])).toBeNull();
  });
  it("lidkaart toont geen allergie aan wie ze niet mag zien", () => {
    expect(lidSamenvatting(lotte, vLotte, MARIE)).toBe("Voorkeuren ingevuld (niet gedeeld)");
    expect(lidSamenvatting(lotte, vLotte, JAN)).toBe("Noten");
    expect(lidSamenvatting(gust, vGust, JAN)).toBe("Vegetarisch");
    expect(lidSamenvatting(lotte, null, JAN)).toBe("Nog geen voorkeuren");
  });
});

describe("porties en initialen", () => {
  it("personen volgen mee-eters plus gasten, tussen 1 en 50", () => {
    expect(personenVoor(3, 0)).toBe(3);
    expect(personenVoor(3, 2)).toBe(5);
    expect(personenVoor(0, 0)).toBe(1);
    expect(personenVoor(40, 20)).toBe(50);
    expect(personenVoor(-2, 1)).toBe(1);
  });
  it("initialen", () => {
    expect(initialen("Lotte")).toBe("L");
    expect(initialen("Jan Peeters")).toBe("JP");
    expect(initialen("  ")).toBe("?");
  });
});
