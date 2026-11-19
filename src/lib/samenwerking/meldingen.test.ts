import { describe, expect, it } from "vitest";
import { oordeelVoorEters, type HuishoudenLid, type LidVoeding } from "@/lib/gezin-veiligheid";
import {
  aantalOngelezen,
  conflictMeldingTekst,
  leesMeldingInstellingen,
  menuMeldingTekst,
  meldingAan,
  restjeTekst,
  schoonMeldingTekst,
  tellerTekst,
  toegewezenTekst,
  veiligeLink,
  wanneerTekst,
  winkelenKlaarTekst,
  zetMeldingSoort,
  zichtbareMeldingen,
  type AppMelding,
} from "./meldingen";

const m = (id: string, soort: AppMelding["soort"], op: string, gelezen = false): AppMelding => ({
  id,
  soort,
  tekst: id,
  link: null,
  gelezen,
  op,
  bron: "gezin",
});
const lijst = [
  m("a", "menu", "2026-11-18T10:00:00Z"),
  m("b", "toegewezen", "2026-11-18T11:00:00Z"),
  m("c", "conflict", "2026-11-18T09:00:00Z", true),
  m("d", "restje", "2026-11-18T12:00:00Z"),
];

describe("instellingen per soort", () => {
  it("standaard staat alles aan; onbekende soorten en dubbels vallen weg", () => {
    expect(leesMeldingInstellingen(null)).toEqual({ uit: [] });
    expect(leesMeldingInstellingen({ uit: ["menu", "raket", "menu", 3] })).toEqual({
      uit: ["menu"],
    });
  });
  it("aan/uit zetten", () => {
    const uit = zetMeldingSoort({ uit: [] }, "menu", false);
    expect(meldingAan(uit, "menu")).toBe(false);
    expect(meldingAan(zetMeldingSoort(uit, "menu", true), "menu")).toBe(true);
  });
  it("soort uit → niet in de lijst en niet in de teller", () => {
    expect(zichtbareMeldingen(lijst, { uit: [] }).map((x) => x.id)).toEqual(["d", "b", "a", "c"]);
    expect(aantalOngelezen(lijst, { uit: [] })).toBe(3);
    const inst = { uit: ["menu", "restje"] as AppMelding["soort"][] };
    expect(zichtbareMeldingen(lijst, inst).map((x) => x.id)).toEqual(["b", "c"]);
    expect(aantalOngelezen(lijst, inst)).toBe(1);
  });
  it("teller: hooguit 9+", () => {
    expect(tellerTekst(3)).toBe("3");
    expect(tellerTekst(12)).toBe("9+");
  });
});

describe("privacy in meldingteksten", () => {
  const lotte: HuishoudenLid = {
    id: "l3",
    group_id: "g",
    naam: "Lotte",
    user_id: null,
    rol: "kind",
    beheerder_id: "jan",
  };
  const voeding = new Map<string, LidVoeding>([
    [
      "l3",
      {
        lid_id: "l3",
        allergieen: ["noten"],
        intoleranties: [],
        dieet: null,
        uitsluitingen: [],
        delen_met_gezin: false,
        toestemming_door: "jan",
        toestemming_soort: "beheerder",
        toestemming_op: "2026-10-02",
      },
    ],
  ]);
  it("een menumelding noemt wie niet veilig eet, nooit waarom (ook niet voor de beheerder)", () => {
    // Jan beheert Lotte en ziet de reden zelf wel, maar een melding gaat naar het hele gezin.
    const oordelen = oordeelVoorEters(
      { title: "Pesto met pijnboompitten", ingredienten: ["pasta", "walnoten"] },
      [lotte],
      voeding,
      "jan",
    );
    expect(oordelen[0]?.reden).toMatch(/noten/);
    const tekst = menuMeldingTekst({
      wie: "Jan",
      datum: "2026-11-18",
      titel: "Pesto",
      wat: "erbij",
      oordelen,
    });
    expect(tekst).toBe("Jan zette Pesto op woensdag. Let op: niet veilig voor Lotte");
    expect(tekst).not.toMatch(/noot|noten|allergi|bevat/i);
  });
  it("tweede slot: een reden in vrije tekst wordt weggehaald", () => {
    expect(schoonMeldingTekst("Niet veilig voor Lotte: bevat mogelijk noten")).toBe(
      "Niet veilig voor Lotte",
    );
    expect(schoonMeldingTekst("Gust (past niet bij vegetarisch) eet mee")).toBe("Gust eet mee");
    expect(schoonMeldingTekst("Lotte is allergisch voor pinda's")).toBe("Lotte is");
    // Een product dat ook een allergeen is, is geen gezondheidsgegeven.
    expect(toegewezenTekst({ wie: "Marie", product: "noten" })).toBe(
      "Marie vraagt of jij noten haalt",
    );
  });
  it("andere teksten", () => {
    expect(
      menuMeldingTekst({
        wie: "Jan Peeters",
        datum: "2026-11-18",
        titel: "Lasagne",
        wat: "anders",
      }),
    ).toBe("Jan veranderde woensdag in Lasagne");
    expect(winkelenKlaarTekst({ wie: "Jan", aantal: 1 })).toBe(
      "Jan is klaar met winkelen (1 ding gekocht)",
    );
    expect(
      conflictMeldingTekst({
        wie: "Marie",
        datum: "2026-11-18",
        mijnTitel: "Stoofvlees",
        jouwTitel: "Lasagne",
      }),
    ).toBe("Marie zette woensdag toch op Stoofvlees (jij had Lasagne gekozen)");
    expect(restjeTekst({ titel: "Soep", laatsteDag: true })).toBe(
      "Restje Soep: eet het vandaag nog op",
    );
  });
});

describe("links en tijd", () => {
  it("alleen interne links", () => {
    expect(veiligeLink("/planner")).toBe("/planner");
    expect(veiligeLink("/boodschappen?lijst=gezin")).toBe("/boodschappen?lijst=gezin");
    expect(veiligeLink("https://boef.example")).toBeNull();
    expect(veiligeLink("//boef.example")).toBeNull();
    expect(veiligeLink("javascript:alert(1)")).toBeNull();
    expect(veiligeLink(3)).toBeNull();
  });
  it("wanneer", () => {
    const nu = Date.parse("2026-11-18T12:00:00");
    expect(wanneerTekst(new Date(nu - 20_000).toISOString(), nu)).toBe("net");
    expect(wanneerTekst(new Date(nu - 5 * 60_000).toISOString(), nu)).toBe("5 min geleden");
    expect(wanneerTekst(new Date(nu - 26 * 3_600_000).toISOString(), nu)).toBe("gisteren");
    expect(wanneerTekst("geen datum", nu)).toBe("");
  });
});
