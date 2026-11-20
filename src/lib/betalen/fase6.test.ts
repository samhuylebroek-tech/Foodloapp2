import { describe, expect, it } from "vitest";
import { omzetPerMaand } from "@/lib/bcc";
import { DAGLIMIET } from "@/lib/assistent/gebruik";
import {
  btwVan,
  dagenOver,
  factuurTekst,
  genadeTot,
  moetSluiten,
  proRataWijziging,
  terugbetalingMogelijk,
  volgendeFactuur,
  type FactuurInfo,
} from "./abonnement-regels";
import { FEE_VOORSTEL, leesPrijs } from "./fee";
import { valideerMakerPlan } from "./maker-abonnement";
import { makerRecht } from "./maker-abonnement";
import { SEIZOEN_PER_MAAND, seizoenVoor, WEEK_SJABLONEN } from "./premium-inhoud";
import {
  btwRegel,
  btwUitInclusief,
  jaarBesparingCent,
  makerPrijsGrenzen,
  PRIJZEN,
} from "./prijzen";
import { kiesBetaalProvider } from "./provider";
import {
  aiDaglimiet,
  AI_LIMIETEN,
  beschrijfRecht,
  geenRechtBoodschap,
  isGeenRechtFout,
  KERN_SLEUTELWOORDEN,
  NIVEAUS,
  niveauVan,
  RECHTEN,
  vereisRecht,
} from "./rechten";
import { geeftToegang, volgendeStatus } from "./statusmachine";
import { TestBetaalProvider } from "./test-provider";
import { PLANNEN } from "./types";

const NU = new Date("2026-11-20T12:00:00");
const ID = "11111111-1111-4111-8111-111111111111";
const MAKER = "c7c7c7c7-0000-4000-8000-000000000001";

describe("centrale rechtenlijst (entitlements-matrix)", () => {
  it("elk plan ontgrendelt precies de rechten van zijn niveau", () => {
    expect(PLANNEN.premium_maand.rechten).toEqual([...NIVEAUS.premium.rechten]);
    expect(PLANNEN.premium_jaar.rechten).toEqual([...NIVEAUS.premium.rechten]);
    expect(PLANNEN.partner_basis.rechten).toEqual(["partner.producten"]);
    expect(PLANNEN.partner_plus.rechten).toContain("partner.campagnes");
    expect(NIVEAUS.gratis.rechten).toEqual([]);
  });

  it("elk recht in een niveau staat in de catalogus met het juiste niveau", () => {
    for (const [niveau, n] of Object.entries(NIVEAUS)) {
      for (const r of n.rechten) {
        expect(RECHTEN[r], r).toBeDefined();
        if (niveau !== "partner_plus") expect(RECHTEN[r].niveau).toBe(niveau);
      }
    }
  });

  it("geen consumentenrecht raakt een kernfunctie (veiligheid, lijst, planning…)", () => {
    for (const r of NIVEAUS.premium.rechten) {
      const tekst = `${r} ${RECHTEN[r].titel}`.toLowerCase();
      for (const woord of KERN_SLEUTELWOORDEN)
        expect(tekst, `${r} ↔ ${woord}`).not.toContain(woord);
    }
  });

  it("maker:<id> wordt herkend; onbekende rechten niet", () => {
    expect(niveauVan(makerRecht(MAKER))).toBe("maker");
    expect(niveauVan("premium.seizoenskalender")).toBe("premium");
    expect(beschrijfRecht("premium.bestaat_niet")).toBeNull();
    expect(beschrijfRecht("maker:geen-uuid")).toBeNull();
  });

  it("vereisRecht: met geldig recht ok, verlopen of ontbrekend → GEEN_RECHT", () => {
    const met = {
      id: ID,
      entitlements: [{ recht: "premium.seizoenskalender", geldig_tot: "2026-12-01" }],
    };
    expect(() => vereisRecht(met, "premium.seizoenskalender", NU)).not.toThrow();
    expect(() => vereisRecht(met, "premium.weekmenu_extra", NU)).toThrow(
      /GEEN_RECHT: Dit hoort bij Premium/,
    );
    expect(() =>
      vereisRecht(met, "premium.seizoenskalender", new Date("2026-12-02T08:00:00")),
    ).toThrow(/GEEN_RECHT/);
    expect(() => vereisRecht(null, "premium.seizoenskalender", NU)).toThrow(/GEEN_RECHT/);
    // Onbekend recht: altijd geweigerd, ook als er per ongeluk een rij voor bestaat.
    const vals = { id: ID, entitlements: [{ recht: "premium.alles", geldig_tot: null }] };
    expect(() => vereisRecht(vals, "premium.alles", NU)).toThrow(/GEEN_RECHT/);
  });

  it("makerrecht en premium tegelijk: elk ontgrendelt alleen zichzelf", () => {
    const beide = {
      id: ID,
      entitlements: [
        { recht: makerRecht(MAKER), geldig_tot: "2026-12-10" },
        { recht: "premium.weekmenu_extra", geldig_tot: "2026-12-10" },
      ],
    };
    expect(() => vereisRecht(beide, makerRecht(MAKER), NU)).not.toThrow();
    expect(() => vereisRecht(beide, "premium.weekmenu_extra", NU)).not.toThrow();
    expect(() => vereisRecht(beide, "premium.seizoenskalender", NU)).toThrow(/GEEN_RECHT/);
    expect(() =>
      vereisRecht(beide, makerRecht("c7c7c7c7-0000-4000-8000-000000000002"), NU),
    ).toThrow(/Dit hoort bij een makerabonnement/);
  });

  it("vriendelijke boodschap wordt herkend; gewone fouten niet", () => {
    expect(isGeenRechtFout(new Error(geenRechtBoodschap("premium.seizoenskalender")))).toBe(true);
    expect(isGeenRechtFout(new Error("netwerk"))).toBe(false);
    expect(geenRechtBoodschap("premium.seizoenskalender")).toContain("blijft gratis");
  });

  it("AI-limieten komen uit de lijst en zijn gelijk voor iedereen", () => {
    expect(DAGLIMIET).toBe(AI_LIMIETEN.gratis.assistentPerDag);
    expect(aiDaglimiet([], NU)).toBe(AI_LIMIETEN.gratis.assistentPerDag);
    expect(aiDaglimiet([{ recht: "premium.seizoenskalender", geldig_tot: null }], NU)).toBe(
      AI_LIMIETEN.premium.assistentPerDag,
    );
  });
});

describe("prijzen centraal en btw", () => {
  it("plannen, fee en makergrenzen lezen dezelfde configuratie", () => {
    expect(PLANNEN.premium_maand.prijsCent).toBe(PRIJZEN.premium.maandCent);
    expect(PLANNEN.premium_jaar.prijsCent).toBe(PRIJZEN.premium.jaarCent);
    expect(PLANNEN.partner_plus.prijsCent).toBe(PRIJZEN.partner.plusMaandCent);
    expect(FEE_VOORSTEL.platformProcent).toBe(PRIJZEN.platformProcent);
    expect(FEE_VOORSTEL.btwProcent).toBe(PRIJZEN.btw.procent);
    expect(leesPrijs("0,99")).toBeNull();
    expect(leesPrijs("1")).toBe(PRIJZEN.maker.minCent);
    expect(leesPrijs("50")).toBe(PRIJZEN.maker.maxCent);
    expect(leesPrijs("50,01")).toBeNull();
    expect(makerPrijsGrenzen()).toMatch(/^€\s1 en €\s50$/);
    expect(valideerMakerPlan("0,50", "x")).toEqual({
      fout: expect.stringMatching(/tussen €\s1 en €\s50 per maand/),
    });
  });

  it("btw uit een bedrag inclusief btw (BE 21 %, configureerbaar)", () => {
    expect(btwUitInclusief(499)).toBe(87);
    expect(btwUitInclusief(4990)).toBe(866);
    expect(btwUitInclusief(1210, 21)).toBe(210);
    expect(btwUitInclusief(1060, 6)).toBe(60);
    expect(btwUitInclusief(-5)).toBe(0);
    expect(btwRegel(499)).toMatch(/waarvan €\s0,87 btw \(21 %\)/);
    expect(btwRegel(0)).toMatch(/geen btw/);
    expect(jaarBesparingCent()).toBe(499 * 12 - 4990);
  });

  it("factuur zonder btw-kolom (oude rij) rekent de btw zelf uit", () => {
    expect(btwVan({ bedrag_cent: 499 })).toEqual({ btwCent: 87, procent: 21 });
    expect(btwVan({ bedrag_cent: 499, btw_cent: 50, btw_procent: 12 })).toEqual({
      btwCent: 50,
      procent: 12,
    });
  });
});

describe("pro rata overstappen", () => {
  it("maand → jaar: tegoed voor de resterende dagen gaat van de jaarprijs af", () => {
    const w = proRataWijziging({
      van: "premium_maand",
      naar: "premium_jaar",
      status: "actief",
      periodeEinde: "2026-12-04", // 15 dagen over (20/11 12u → 4/12 23:59)
      nu: NU,
    });
    expect(w.soort).toBe("upgrade");
    expect(dagenOver("2026-12-04", NU)).toBe(15);
    expect(w.tegoedCent).toBe(Math.round((499 * 15) / 30));
    expect(w.teBetalenCent).toBe(4990 - w.tegoedCent);
    expect(w.tekst).toMatch(/15 dagen/);
  });

  it("jaar → maand: gepland op het einde, niets teruggestort", () => {
    const w = proRataWijziging({
      van: "premium_jaar",
      naar: "premium_maand",
      status: "actief",
      periodeEinde: "2027-06-01",
      nu: NU,
    });
    expect(w).toMatchObject({
      soort: "downgrade",
      tegoedCent: 0,
      teBetalenCent: 0,
      ingang: "2027-06-01",
    });
    expect(w.tekst).toMatch(/niets teruggestort/);
  });

  it("tijdens de proef betaal je niets; opgezegd of partner kan niet", () => {
    expect(
      proRataWijziging({
        van: "premium_maand",
        naar: "premium_jaar",
        status: "proef",
        periodeEinde: "2026-12-01",
        nu: NU,
      }),
    ).toMatchObject({ teBetalenCent: 0, ingang: "2026-12-01" });
    expect(
      proRataWijziging({
        van: "premium_maand",
        naar: "premium_jaar",
        status: "opgezegd",
        periodeEinde: "2026-12-01",
        nu: NU,
      }).soort,
    ).toBe("niet_mogelijk");
    expect(
      proRataWijziging({
        van: "partner_plus",
        naar: "premium_jaar",
        status: "actief",
        periodeEinde: null,
        nu: NU,
      }).soort,
    ).toBe("niet_mogelijk");
    expect(
      proRataWijziging({
        van: "premium_maand",
        naar: "premium_maand",
        status: "actief",
        periodeEinde: null,
        nu: NU,
      }).soort,
    ).toBe("zelfde");
  });

  it("tegoed nooit meer dan de prijs, te betalen nooit negatief", () => {
    const w = proRataWijziging({
      van: "premium_maand",
      naar: "premium_jaar",
      status: "actief",
      periodeEinde: "2027-12-31",
      nu: NU,
    });
    expect(w.tegoedCent).toBeLessThanOrEqual(499);
    expect(w.teBetalenCent).toBeGreaterThanOrEqual(0);
  });
});

const f = (x: Partial<FactuurInfo>): FactuurInfo => ({
  id: "f1",
  nummer: "TEST-2026-0001",
  omschrijving: "Foodlo Premium: 1 maand",
  bedrag_cent: 499,
  status: "betaald",
  soort: "factuur",
  datum: "2026-11-15",
  test: true,
  ...x,
});

describe("terugbetaling, genade, volgende factuur en sluiten", () => {
  it("binnen 14 dagen alles terug; daarna niet; nooit twee keer", () => {
    expect(terugbetalingMogelijk([f({})], NU)).toMatchObject({ mag: true, bedragCent: 499 });
    expect(terugbetalingMogelijk([f({ datum: "2026-11-01" })], NU).mag).toBe(false);
    expect(
      terugbetalingMogelijk(
        [f({}), f({ id: "c1", soort: "creditnota", verwijst_naar: "f1", datum: "2026-11-16" })],
        NU,
      ).mag,
    ).toBe(false);
    // Proef (€ 0) of mislukte betaling: niets terug te betalen.
    expect(
      terugbetalingMogelijk([f({ bedrag_cent: 0 }), f({ id: "f2", status: "mislukt" })], NU).mag,
    ).toBe(false);
  });

  it("genadeperiode: zeven dagen na vandaag", () => {
    expect(genadeTot(NU)).toBe("2026-11-27");
  });

  it("volgende factuur: actief → periode-einde, gepland plan telt, opgezegd → geen", () => {
    expect(
      volgendeFactuur({ plan: "premium_maand", status: "actief", periode_einde: "2026-12-04" }),
    ).toEqual({
      datum: "2026-12-04",
      bedragCent: 499,
    });
    expect(
      volgendeFactuur({
        plan: "premium_jaar",
        status: "actief",
        periode_einde: "2027-06-01",
        gepland_plan: "premium_maand",
      })?.bedragCent,
    ).toBe(499);
    expect(
      volgendeFactuur({ plan: "premium_maand", status: "opgezegd", periode_einde: "2026-12-04" }),
    ).toBeNull();
    expect(
      volgendeFactuur({
        plan: "premium_maand",
        status: "betaling_mislukt",
        periode_einde: "2026-12-04",
        genade_tot: "2026-11-27",
      })?.datum,
    ).toBe("2026-11-27");
  });

  it("sluiten: opgezegd na het einde, mislukt na de genade, nooit bij actief", () => {
    expect(
      moetSluiten({ plan: "premium_maand", status: "opgezegd", periode_einde: "2026-11-19" }, NU),
    ).toBe(true);
    expect(
      moetSluiten({ plan: "premium_maand", status: "opgezegd", periode_einde: "2026-11-20" }, NU),
    ).toBe(false);
    expect(
      moetSluiten(
        {
          plan: "premium_maand",
          status: "betaling_mislukt",
          periode_einde: "2026-11-10",
          genade_tot: "2026-11-25",
        },
        NU,
      ),
    ).toBe(false);
    expect(
      moetSluiten({ plan: "premium_maand", status: "actief", periode_einde: "2020-01-01" }, NU),
    ).toBe(false);
    expect(moetSluiten(null, NU)).toBe(false);
  });

  it("testfactuur als tekst: duidelijk test, btw apart, creditnota negatief", () => {
    const t = factuurTekst(f({}));
    expect(t).toMatch(/^TESTFACTUUR — GEEN ECHTE FACTUUR/);
    expect(t).toMatch(/Btw 21 %:\s+€\s0,87/);
    expect(t).toMatch(/Bedrag excl\. btw:\s+€\s4,12/);
    expect(t).toMatch(/Datum:\s+15\/11\/2026/);
    const c = factuurTekst(f({ soort: "creditnota" }));
    expect(c).toMatch(/TEST-CREDITNOTA/);
    expect(c).toMatch(/Totaal incl\. btw:\s+-€\s4,99/);
  });

  it("statusmachine: terugbetaald sluit meteen; mislukte betaling houdt toegang (genade)", () => {
    expect(volgendeStatus("actief", "terugbetaald")).toBe("geen");
    expect(volgendeStatus("opgezegd", "terugbetaald")).toBe("geen");
    expect(volgendeStatus("geen", "terugbetaald")).toBeNull();
    expect(geeftToegang("betaling_mislukt")).toBe(true);
  });
});

describe("betaalprovider-interface (alleen TestProvider)", () => {
  it("terugbetaling en uitbetaling in testmodus, met grenzen", async () => {
    const p = new TestBetaalProvider();
    await expect(
      p.terugbetaal({ abonnementRef: "sub", bedragCent: 499, reden: "herroeping" }),
    ).resolves.toMatchObject({
      status: "test_terugbetaald",
      modus: "test",
      bedragCent: 499,
    });
    await expect(
      p.terugbetaal({ abonnementRef: "sub", bedragCent: 0, reden: "x" }),
    ).rejects.toThrow();
    await expect(
      p.terugbetaal({ abonnementRef: "sub", bedragCent: 10, reden: " " }),
    ).rejects.toThrow();
    await expect(
      p.startUitbetaling({ ontvangerRef: "maker", bedragCent: 318, periode: "2026-11" }),
    ).resolves.toMatchObject({
      status: "zou_uitbetaald_worden",
      modus: "test",
    });
    await expect(
      p.startUitbetaling({ ontvangerRef: "maker", bedragCent: -1, periode: "2026-11" }),
    ).rejects.toThrow();
  });

  it("webhook met valse handtekening wordt geweigerd; geldige gaat door", async () => {
    const p = new TestBetaalProvider(() => NU);
    const { abonnementRef } = await p.startCheckout({ plan: "premium_jaar", klantRef: ID });
    const { body, handtekening } = p.maakWebhook(
      p.event("checkout_voltooid", abonnementRef, "premium_jaar"),
    );
    await expect(p.verwerkWebhook(body, "test_vals")).rejects.toThrow(/Ongeldige handtekening/);
    await p.verwerkWebhook(body, handtekening);
    expect(await p.haalStatus(abonnementRef)).toBe("actief");
    expect(p.event("terugbetaald", abonnementRef, "premium_jaar").bedragCent).toBe(4990);
  });

  it("kiesBetaalProvider: alleen test, nooit live, en uit zodra een echte provider gekoppeld is", () => {
    expect(kiesBetaalProvider("test").modus).toBe("test");
    expect(() => kiesBetaalProvider("live")).toThrow(/alleen de testmodus/);
    expect(() => kiesBetaalProvider("test", true)).toThrow(/echte betaalprovider/);
  });
});

describe("premium-inhoud en omzet", () => {
  it("seizoenskalender voor elke maand, sjablonen met vijf dagen", () => {
    expect(SEIZOEN_PER_MAAND).toHaveLength(12);
    expect(seizoenVoor(NU).maand).toBe("november");
    expect(WEEK_SJABLONEN.every((w) => w.dagen.length === 5)).toBe(true);
  });

  it("creditnota telt als terugbetaling in het BCC, met de opgeslagen btw", () => {
    const [m] = omzetPerMaand(
      [],
      [
        {
          user_id: ID,
          partner_id: null,
          bedrag_cent: 499,
          status: "betaald",
          datum: "2026-11-15",
          soort: "factuur",
          btw_cent: 87,
        },
        {
          user_id: ID,
          partner_id: null,
          bedrag_cent: 499,
          status: "betaald",
          datum: "2026-11-16",
          soort: "creditnota",
          btw_cent: 87,
        },
      ],
    );
    expect(m?.premium.brutoCent).toBe(499);
    expect(m?.terugbetalingen.brutoCent).toBe(499);
    expect(m?.totaalBrutoCent).toBe(0);
    expect(m?.totaalBtwCent).toBe(0);
  });
});
