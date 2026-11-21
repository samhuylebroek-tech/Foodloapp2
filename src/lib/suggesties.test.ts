import { describe, expect, it } from "vitest";
import {
  budgetSignaal,
  isAan,
  kiesKaart,
  leesSuggesties,
  MAX_VERBORGEN,
  STANDAARD_SUGGESTIES,
  SUGGESTIE_SOORTEN,
  variatieSignaal,
  verberg,
  VOLGORDE,
  zetSoort,
} from "./suggesties";

describe("instellingen suggesties", () => {
  it("standaard staat alles aan; zeven soorten met uitleg", () => {
    expect(SUGGESTIE_SOORTEN.map((s) => s.id)).toEqual([
      "restjes",
      "over-datum",
      "budget",
      "weer",
      "variatie",
      "seizoen",
      "boodschappen",
    ]);
    for (const s of SUGGESTIE_SOORTEN) {
      expect(isAan(STANDAARD_SUGGESTIES, s.id)).toBe(true);
      expect(s.uitleg.length).toBeGreaterThan(10);
    }
  });

  it("aan/uit per soort, zonder dubbels", () => {
    let i = zetSoort(STANDAARD_SUGGESTIES, "weer", false);
    i = zetSoort(i, "weer", false);
    expect(i.uit).toEqual(["weer"]);
    expect(isAan(i, "weer")).toBe(false);
    expect(isAan(i, "budget")).toBe(true);
    expect(zetSoort(i, "weer", true).uit).toEqual([]);
  });

  it("leest onbekende of kapotte gegevens veilig", () => {
    expect(leesSuggesties(null)).toEqual(STANDAARD_SUGGESTIES);
    expect(leesSuggesties({ uit: ["weer", "raket", 3, "weer"], verborgen: ["a", "", 5] })).toEqual({
      uit: ["weer"],
      verborgen: ["a"],
    });
    expect(leesSuggesties({ uit: "weer" })).toEqual(STANDAARD_SUGGESTIES);
  });

  it("niet meer tonen: per kaart, begrensd (oudste eruit)", () => {
    let i = STANDAARD_SUGGESTIES;
    for (let n = 0; n < MAX_VERBORGEN + 5; n++) i = verberg(i, `k${n}`);
    expect(i.verborgen).toHaveLength(MAX_VERBORGEN);
    expect(i.verborgen[0]).toBe("k5");
    expect(verberg(i, "k5").verborgen.at(-1)).toBe("k5");
  });
});

describe("één kaart op Vandaag", () => {
  const alle = [
    { soort: "seizoen" as const, sleutel: "seizoen:2026-11:pompoen" },
    { soort: "weer" as const, sleutel: "weer:2026-11-18:koud" },
    { soort: "variatie" as const, sleutel: "variatie:2026-11-16:vlees" },
    { soort: "restjes" as const, sleutel: "restjes:r1" },
    null,
  ];

  it("de volgorde van belang: restjes eerst, seizoen laatst", () => {
    expect(VOLGORDE[0]).toBe("restjes");
    expect(kiesKaart(alle, STANDAARD_SUGGESTIES)?.soort).toBe("restjes");
  });

  it("een soort uit = de volgende kaart; alles uit = geen kaart", () => {
    const i = zetSoort(STANDAARD_SUGGESTIES, "restjes", false);
    expect(kiesKaart(alle, i)?.soort).toBe("weer");
    const niets = VOLGORDE.reduce((x, s) => zetSoort(x, s, false), STANDAARD_SUGGESTIES);
    expect(kiesKaart(alle, niets)).toBeNull();
  });

  it("verborgen kaart = de volgende; een nieuwe sleutel komt terug", () => {
    const i = verberg(verberg(STANDAARD_SUGGESTIES, "restjes:r1"), "weer:2026-11-18:koud");
    expect(kiesKaart(alle, i)?.soort).toBe("variatie");
    expect(kiesKaart([{ soort: "restjes", sleutel: "restjes:r2" }], i)?.sleutel).toBe("restjes:r2");
  });

  it("geen kandidaten = geen kaart", () => {
    expect(kiesKaart([], STANDAARD_SUGGESTIES)).toBeNull();
  });
});

describe("signalen", () => {
  it("variatie: drie keer vlees, er komt er nog een → de laatste vervangen", () => {
    const week = [
      { datum: "2026-11-16", soort: "vlees" as const },
      { datum: "2026-11-17", soort: "vis" as const },
      { datum: "2026-11-18", soort: "vlees" as const },
      { datum: "2026-11-20", soort: "vlees" as const },
    ];
    expect(variatieSignaal(week, "2026-11-17")).toEqual({
      soort: "vlees",
      aantal: 3,
      datum: "2026-11-20",
    });
    // Alles al voorbij: niets meer te veranderen.
    expect(variatieSignaal(week, "2026-11-21")).toBeNull();
    // Twee keer is gewoon.
    expect(variatieSignaal(week.slice(0, 3), "2026-11-16")).toBeNull();
    // Veel vegetarisch is geen probleem.
    expect(
      variatieSignaal(
        ["16", "17", "18", "19"].map((d) => ({ datum: `2026-11-${d}`, soort: "vega" as const })),
        "2026-11-16",
      ),
    ).toBeNull();
  });

  it("budget: alleen met een budget en (bijna) erboven", () => {
    expect(budgetSignaal({ totaal: 80, nietGeschat: 0 }, null)).toBeNull();
    expect(budgetSignaal({ totaal: 80, nietGeschat: 0 }, 120)).toBeNull();
    expect(budgetSignaal({ totaal: 110, nietGeschat: 0 }, 120)?.status).toBe("bijna");
    const over = budgetSignaal({ totaal: 135.5, nietGeschat: 1 }, 120);
    expect(over?.status).toBe("over");
    // euro() gebruikt een vaste spatie na het teken.
    expect(over?.tekst.replace(/\u00a0/g, " ")).toBe(
      "Je weekmenu kost ongeveer € 135,50: € 15,50 boven je budget van € 120,00.",
    );
  });
});
