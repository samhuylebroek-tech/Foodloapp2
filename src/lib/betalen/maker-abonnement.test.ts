import { describe, expect, it } from "vitest";
import {
  abonneesSamenvatting,
  btwTekst,
  magExclusiefZien,
  makerRecht,
  nieuwePeriode,
  opzegBerekening,
  prijsTekst,
  rechtenUitMakerAbonnementen,
  valideerMakerPlan,
  voornaamVan,
} from "./maker-abonnement";

const nu = new Date("2026-11-20T12:00:00Z");

describe("rechten uit makerabonnementen", () => {
  it("alleen actief en binnen de periode", () => {
    const r = rechtenUitMakerAbonnementen(
      [
        { creator_id: "a", status: "actief", periode_einde: "2026-12-10T00:00:00Z" },
        { creator_id: "b", status: "opgezegd", periode_einde: "2026-12-10T00:00:00Z" },
        { creator_id: "c", status: "actief", periode_einde: "2026-11-01T00:00:00Z" },
      ],
      nu,
    );
    expect(r).toEqual([{ recht: "maker:a", geldig_tot: "2026-12-10T00:00:00Z" }]);
  });
});

describe("magExclusiefZien", () => {
  const fan = (rechten: string[]) => ({
    id: "fan",
    entitlements: rechten.map((recht) => ({ recht, geldig_tot: null })),
  });
  it("niet-exclusief: altijd; maker zelf: altijd", () => {
    expect(
      magExclusiefZien({ exclusief: false, creatorId: "a", isMaker: false, gebruiker: null }),
    ).toBe(true);
    expect(
      magExclusiefZien({ exclusief: true, creatorId: "a", isMaker: true, gebruiker: null }),
    ).toBe(true);
  });
  it("exclusief: alleen met het recht van díe maker", () => {
    const basis = { exclusief: true, creatorId: "a", isMaker: false };
    expect(magExclusiefZien({ ...basis, gebruiker: null })).toBe(false);
    expect(magExclusiefZien({ ...basis, gebruiker: fan([]) })).toBe(false);
    expect(magExclusiefZien({ ...basis, gebruiker: fan([makerRecht("b")]) })).toBe(false);
    expect(magExclusiefZien({ ...basis, gebruiker: fan([makerRecht("a")]) })).toBe(true);
    expect(magExclusiefZien({ ...basis, gebruiker: fan(["premium.weekmenu_extra"]) })).toBe(false);
  });
  it("een verlopen recht geeft geen toegang", () => {
    expect(
      magExclusiefZien({
        exclusief: true,
        creatorId: "a",
        isMaker: false,
        gebruiker: { id: "f", entitlements: [{ recht: "maker:a", geldig_tot: "2026-11-19" }] },
        nu,
      }),
    ).toBe(false);
  });
});

describe("valideerMakerPlan", () => {
  it("prijs en voordelen netjes", () => {
    expect(
      valideerMakerPlan("3,99", "- Elke week een nieuw recept\n\n• Weekmenu\nWeekmenu"),
    ).toEqual({
      prijs_cent: 399,
      voordelen: ["Elke week een nieuw recept", "Weekmenu"],
    });
  });
  it("uitleg bij fouten", () => {
    expect(valideerMakerPlan("0,50", "x")).toHaveProperty("fout");
    expect(valideerMakerPlan("60", "x")).toHaveProperty("fout");
    expect(valideerMakerPlan("4", "  \n ")).toEqual({
      fout: "Schrijf minstens één voordeel voor je abonnees.",
    });
    expect(valideerMakerPlan("4", "a\nb\nc\nd\ne\nf")).toHaveProperty("fout");
    expect(valideerMakerPlan("4", "x".repeat(81))).toHaveProperty("fout");
  });
});

describe("teksten", () => {
  it("prijs en btw in Belgische notatie", () => {
    expect(prijsTekst(399).replace(/\s/g, " ")).toBe("€ 3,99 per maand");
    expect(btwTekst(399).replace(/\s/g, " ")).toBe("Inclusief € 0,69 btw (21 %)");
  });
  it("voornaam, nooit de volledige naam", () => {
    expect(voornaamVan("Jan Peeters")).toBe("Jan");
    expect(voornaamVan("  ")).toBe("Een fan");
    expect(voornaamVan(null)).toBe("Een fan");
  });
});

describe("periode en opzeggen", () => {
  it("nieuwe periode = 30 dagen", () => {
    expect(nieuwePeriode(nu)).toEqual({
      start_op: "2026-11-20T12:00:00.000Z",
      periode_einde: "2026-12-20T12:00:00.000Z",
    });
  });
  it("binnen 14 dagen: alles terug", () => {
    const a = { ...nieuwePeriode(nu), prijs_cent: 399 };
    const r = opzegBerekening(a, new Date("2026-11-25T12:00:00Z"));
    expect(r.terugCent).toBe(399);
    expect(r.uitleg).toContain("alles terug");
  });
  it("na 14 dagen: ongebruikte dagen", () => {
    const a = { ...nieuwePeriode(nu), prijs_cent: 300 };
    // 20 dagen gebruikt → 10 dagen over → 1/3 van 300.
    expect(opzegBerekening(a, new Date("2026-12-10T12:00:00Z")).terugCent).toBe(100);
  });
  it("na de periode: niets", () => {
    const a = { ...nieuwePeriode(nu), prijs_cent: 300 };
    expect(opzegBerekening(a, new Date("2027-01-01T00:00:00Z")).terugCent).toBe(0);
  });
});

describe("abonneesSamenvatting", () => {
  it("schatting van het makerdeel, geen betaalgegevens", () => {
    expect(abonneesSamenvatting(0, { prijs_cent: 399 })).toEqual({
      aantal: 0,
      schattingMakerCent: 0,
    });
    const een = abonneesSamenvatting(1, { prijs_cent: 399 }).schattingMakerCent;
    expect(een).toBeGreaterThan(0);
    expect(een).toBeLessThan(399);
    expect(abonneesSamenvatting(3, { prijs_cent: 399 }).schattingMakerCent).toBe(een * 3);
    expect(abonneesSamenvatting(2, null).schattingMakerCent).toBe(0);
  });
});
