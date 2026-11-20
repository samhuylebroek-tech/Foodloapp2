import { describe, expect, it } from "vitest";
import { heeftRecht, rechtenVanRol, type AdminProfiel, type AdminRol } from "./admin.functions";
import {
  aanvraagBesluitFout,
  auditOmschrijving,
  BCC_SCHERMEN,
  btwUitInclusief,
  klikratio,
  leesPlatformProcent,
  leesTestbudget,
  maandLabel,
  maandVan,
  omzetPerMaand,
  procent,
  rolNaam,
  uitbetalingPerMaker,
  uitnodigingFout,
  type FactuurRij,
  type MakerBetalingRij,
} from "./bcc";

const profiel = (role: AdminRol): AdminProfiel => ({
  user_id: "x",
  role,
  active: true,
  can_view_private_content: false,
  note: "",
});

const betaling = (
  creator: string,
  cent: number,
  dag: string,
  soort: MakerBetalingRij["soort"] = "betaling",
): MakerBetalingRij => ({
  creator_id: creator,
  soort,
  bedrag_cent: cent,
  btw_cent: btwUitInclusief(cent),
  test: true,
  created_at: `${dag}T10:00:00Z`,
});

describe("rollen en rechten per scherm", () => {
  it("moderator ziet geen omzet of uitbetalingen, wel partners en moderatie", () => {
    const m = profiel("content_manager");
    expect(heeftRecht(m, "finance.view")).toBe(false);
    expect(heeftRecht(m, "finance.manage")).toBe(false);
    expect(heeftRecht(m, "partners.manage")).toBe(true);
    expect(heeftRecht(m, "content.manage")).toBe(true);
  });
  it("analist kijkt alleen: campagnes zien, niets beslissen, geen omzet", () => {
    const a = profiel("analyst");
    expect(heeftRecht(a, "partners.view")).toBe(true);
    expect(heeftRecht(a, "partners.manage")).toBe(false);
    expect(heeftRecht(a, "finance.view")).toBe(false);
  });
  it("de verdeling maker/platform wijzigt alleen de eigenaar", () => {
    expect(heeftRecht(profiel("super_admin"), "finance.manage")).toBe(true);
    for (const r of ["admin", "content_manager", "analyst", "support"] as const)
      expect(heeftRecht(profiel(r), "finance.manage"), r).toBe(false);
  });
  it("support ziet niets van partners of omzet", () => {
    expect(rechtenVanRol("support")).not.toContain("partners.view");
    expect(rechtenVanRol("support")).not.toContain("finance.view");
  });
  it("rollen in gewone taal", () => {
    expect(rolNaam("super_admin")).toBe("Eigenaar");
    expect(rolNaam("admin")).toBe("Beheerder");
    expect(rolNaam("content_manager")).toBe("Moderator");
    expect(rolNaam("analyst")).toBe("Analist");
    expect(rolNaam("iets")).toBe("Onbekende rol");
  });
  it("elk scherm in de rechtentabel vraagt een bestaand recht", () => {
    const alle = new Set(rechtenVanRol("super_admin"));
    for (const s of BCC_SCHERMEN) expect(alle.has(s.recht), s.pad).toBe(true);
  });
});

describe("omzet per maand (testmodus)", () => {
  it("makerabonnement, partnerplan en premium apart, btw apart, terugbetaling eraf", () => {
    const b = [
      betaling("m1", 399, "2026-11-03"),
      betaling("m1", 399, "2026-11-10"),
      betaling("m1", 200, "2026-11-12", "terugbetaling"),
      betaling("m2", 500, "2026-10-01"),
    ];
    const f: FactuurRij[] = [
      {
        user_id: null,
        partner_id: "p1",
        bedrag_cent: 4900,
        status: "betaald",
        test: true,
        datum: "2026-11-05",
      },
      {
        user_id: "u1",
        partner_id: null,
        bedrag_cent: 499,
        status: "betaald",
        test: true,
        datum: "2026-11-06",
      },
      {
        user_id: "u2",
        partner_id: null,
        bedrag_cent: 499,
        status: "mislukt",
        test: true,
        datum: "2026-11-06",
      },
      {
        user_id: "u3",
        partner_id: null,
        bedrag_cent: 0,
        status: "betaald",
        test: true,
        datum: "2026-11-06",
      },
    ];
    const [nov, okt] = omzetPerMaand(b, f);
    expect(nov!.maand).toBe("2026-11");
    expect(okt!.maand).toBe("2026-10");
    expect(nov!.makerAbonnementen).toEqual({ aantal: 2, brutoCent: 798, btwCent: 138 });
    expect(nov!.terugbetalingen).toEqual({ aantal: 1, brutoCent: 200, btwCent: 35 });
    expect(nov!.partnerplannen).toEqual({ aantal: 1, brutoCent: 4900, btwCent: 850 });
    expect(nov!.premium).toEqual({ aantal: 1, brutoCent: 499, btwCent: 87 });
    expect(nov!.totaalBrutoCent).toBe(798 - 200 + 4900 + 499);
    expect(nov!.totaalBtwCent).toBe(138 - 35 + 850 + 87);
    expect(nov!.totaalExclBtwCent).toBe(nov!.totaalBrutoCent - nov!.totaalBtwCent);
  });
  it("rijen die geen test zijn, tellen nooit mee", () => {
    const r = omzetPerMaand(
      [{ ...betaling("m1", 399, "2026-11-03"), test: false }],
      [
        {
          user_id: "u",
          partner_id: null,
          bedrag_cent: 499,
          status: "betaald",
          test: false,
          datum: "2026-11-01",
        },
      ],
    );
    expect(r).toEqual([]);
  });
  it("leeg = geen maanden; ongeldige datum wordt overgeslagen", () => {
    expect(omzetPerMaand([], [])).toEqual([]);
    expect(omzetPerMaand([{ ...betaling("m", 399, "x"), created_at: "nooit" }], [])).toEqual([]);
  });
  it("btw uit een bedrag inclusief 21 %", () => {
    expect(btwUitInclusief(121)).toBe(21);
    expect(btwUitInclusief(399)).toBe(69);
    expect(btwUitInclusief(-5)).toBe(0);
  });
  it("maanden in gewone taal", () => {
    expect(maandVan("2026-11-03T18:00:00Z")).toBe("2026-11");
    expect(maandVan(null)).toBeNull();
    expect(maandLabel("2026-11")).toBe("november 2026");
  });
});

describe("makeruitbetalingen (testmodus)", () => {
  it("één betaling van € 3,99 bij 15 %: btw, betaalkosten, platform en maker kloppen tot op de cent", () => {
    const [r] = uitbetalingPerMaker([betaling("ahmed", 399, "2026-11-03")], 15);
    expect(r).toMatchObject({
      brutoCent: 399,
      btwCent: 69,
      betaalkostenCent: 31,
      platformCent: 50,
    });
    expect(r!.makerCent).toBe(249);
    expect(r!.btwCent + r!.betaalkostenCent + r!.platformCent + r!.makerCent).toBe(399);
  });
  it("het centrale percentage verschuift alleen maker ↔ platform", () => {
    const [a] = uitbetalingPerMaker([betaling("m", 399, "2026-11-03")], 15);
    const [b] = uitbetalingPerMaker([betaling("m", 399, "2026-11-03")], 20);
    expect(b!.platformCent).toBe(66);
    expect(b!.makerCent).toBe(233);
    expect(a!.platformCent + a!.makerCent).toBe(b!.platformCent + b!.makerCent);
    const [nul] = uitbetalingPerMaker([betaling("m", 399, "2026-11-03")], 0);
    expect(nul!.platformCent).toBe(0);
  });
  it("een terugbetaling trekt af; nooit negatief; per maker gegroepeerd", () => {
    const r = uitbetalingPerMaker(
      [
        betaling("a", 399, "2026-11-03"),
        betaling("a", 399, "2026-11-04", "terugbetaling"),
        betaling("b", 399, "2026-11-04", "terugbetaling"),
        betaling("c", 999, "2026-11-04"),
      ],
      15,
    );
    expect(r.map((x) => x.creator_id)).toEqual(["c", "a", "b"]);
    const a = r.find((x) => x.creator_id === "a")!;
    expect(a).toMatchObject({ betalingen: 1, terugbetalingen: 1, makerCent: 0, brutoCent: 0 });
    expect(r.find((x) => x.creator_id === "b")!.makerCent).toBe(0);
  });
  it("platformpercentage: 0–50, één decimaal, komma mag", () => {
    expect(leesPlatformProcent("15")).toBe(15);
    expect(leesPlatformProcent("12,5")).toBe(12.5);
    expect(leesPlatformProcent(20)).toBe(20);
    expect(leesPlatformProcent("51")).toBeNull();
    expect(leesPlatformProcent("-1")).toBeNull();
    expect(leesPlatformProcent("12,55")).toBeNull();
    expect(leesPlatformProcent("")).toBeNull();
    expect(leesPlatformProcent("abc")).toBeNull();
  });
});

describe("partneraanvragen, campagnes en uitnodigingen", () => {
  it("afwijzen vraagt een reden; een besliste aanvraag kan niet opnieuw", () => {
    expect(aanvraagBesluitFout("nieuw", "goedgekeurd", "")).toBeNull();
    expect(aanvraagBesluitFout("nieuw", "geweigerd", "")).toMatch(/reden/);
    expect(aanvraagBesluitFout("nieuw", "geweigerd", "Geen voedingsbedrijf")).toBeNull();
    expect(aanvraagBesluitFout("goedgekeurd", "geweigerd", "Toch niet")).toMatch(/al beslist/);
    expect(aanvraagBesluitFout("nieuw", "goedgekeurd", "x".repeat(501))).toMatch(/te lang/);
  });
  it("testbudget in euro", () => {
    expect(leesTestbudget("")).toBe(0);
    expect(leesTestbudget("250")).toBe(25000);
    expect(leesTestbudget("€ 1.250,50")).toBe(125050);
    expect(leesTestbudget("abc")).toBeNull();
    expect(leesTestbudget("200000")).toBeNull();
  });
  it("klikratio en procent in Belgische notatie", () => {
    expect(klikratio(1000, 34)).toBe(3.4);
    expect(klikratio(0, 5)).toBe(0);
    expect(procent(3.4)).toBe("3,4 %");
  });
  it("uitnodiging: geldig adres, uitnodigbare rol, geen dubbel; eigenaar kan je niet uitnodigen", () => {
    expect(uitnodigingFout("an@voorbeeld.test", "content_manager", [])).toBeNull();
    expect(uitnodigingFout("geen-adres", "admin", [])).toMatch(/e-mailadres/);
    expect(uitnodigingFout("an@voorbeeld.test", "super_admin", [])).toMatch(/rol/);
    expect(
      uitnodigingFout("AN@voorbeeld.test", "admin", [
        { email: "an@voorbeeld.test", status: "testmodus" },
      ]),
    ).toMatch(/al een uitnodiging/);
    expect(
      uitnodigingFout("an@voorbeeld.test", "admin", [
        { email: "an@voorbeeld.test", status: "ingetrokken" },
      ]),
    ).toBeNull();
  });
  it("auditlog in gewone taal, onbekende acties blijven leesbaar", () => {
    expect(auditOmschrijving("partner.aanvraag.goedgekeurd")).toBe("Partneraanvraag goedgekeurd");
    expect(auditOmschrijving("bcc.verdeling.gewijzigd")).toMatch(/Verdeling/);
    expect(auditOmschrijving("iets.anders")).toBe("iets.anders");
  });
});
