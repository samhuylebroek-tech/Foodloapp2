import { describe, expect, it } from "vitest";
import { BETAALPROVIDER_GEKOPPELD, testBetalingGeweigerd } from "../betaalpoort";
import { heeftRecht } from "./entitlements";
import { leesPrijs, verdeelOpbrengst } from "./fee";
import { testHandtekening, TestWebhookVerifier } from "./handtekening";
import { geeftToegang, verwerkEvent, volgendeStatus, type AbonnementStaat } from "./statusmachine";
import { TestBetaalProvider } from "./test-provider";
import { euro, PLANNEN, type BetaalEvent, type BetaalEventSoort } from "./types";

const ev = (id: string, soort: BetaalEventSoort): BetaalEvent => ({
  id,
  soort,
  abonnementRef: "sub_1",
  plan: "premium_maand",
  tijd: "2026-11-15T10:00:00Z",
});
const leeg: AbonnementStaat = { status: "geen", verwerkt: [] };

describe("statusmachine", () => {
  it("volgt de toegestane overgangen", () => {
    expect(volgendeStatus("geen", "proef_gestart")).toBe("proef");
    expect(volgendeStatus("geen", "checkout_voltooid")).toBe("actief");
    expect(volgendeStatus("proef", "betaling_gelukt")).toBe("actief");
    expect(volgendeStatus("actief", "betaling_mislukt")).toBe("betaling_mislukt");
    expect(volgendeStatus("betaling_mislukt", "betaling_gelukt")).toBe("actief");
    expect(volgendeStatus("actief", "opgezegd")).toBe("opgezegd");
    expect(volgendeStatus("opgezegd", "periode_afgelopen")).toBe("geen");
    expect(volgendeStatus("opgezegd", "checkout_voltooid")).toBe("actief");
  });
  it("weigert onmogelijke overgangen zonder iets te veranderen", () => {
    expect(volgendeStatus("geen", "betaling_gelukt")).toBeNull();
    expect(volgendeStatus("geen", "opgezegd")).toBeNull();
    const u = verwerkEvent(leeg, ev("e1", "betaling_mislukt"));
    expect(u).toMatchObject({ veranderd: false, reden: "ongeldige_overgang" });
    expect(u.staat.status).toBe("geen");
  });
  it("is idempotent op event-id", () => {
    const a = verwerkEvent(leeg, ev("e1", "proef_gestart"));
    expect(a.staat.status).toBe("proef");
    const b = verwerkEvent(a.staat, ev("e2", "opgezegd"));
    expect(b.staat.status).toBe("opgezegd");
    // Hetzelfde event (e1) opnieuw: niets terug naar "proef".
    const c = verwerkEvent(b.staat, ev("e1", "proef_gestart"));
    expect(c).toMatchObject({ veranderd: false, reden: "dubbel" });
    expect(c.staat.status).toBe("opgezegd");
  });
  it("toegang tijdens proef, actief en opgezegd (tot periode-einde), niet bij geen", () => {
    expect(geeftToegang("proef")).toBe(true);
    expect(geeftToegang("actief")).toBe(true);
    expect(geeftToegang("opgezegd")).toBe(true);
    expect(geeftToegang("geen")).toBe(false);
  });
});

describe("webhook-handtekening en testprovider", () => {
  it("controleert de handtekening", () => {
    const v = new TestWebhookVerifier();
    const body = JSON.stringify(ev("e1", "proef_gestart"));
    expect(v.verifieer(body, testHandtekening(body))).toBe(true);
    expect(v.verifieer(`${body} `, testHandtekening(body))).toBe(false);
    expect(v.verifieer(body, null)).toBe(false);
    expect(v.verifieer(body, testHandtekening(body, "andere-sleutel"))).toBe(false);
  });
  it("simuleert checkout, status en opzeggen lokaal", async () => {
    const p = new TestBetaalProvider(() => new Date("2026-11-15T10:00:00Z"));
    expect(p.modus).toBe("test");
    const c = await p.startCheckout({ plan: "premium_maand", klantRef: "u1" });
    expect(c.url).toMatch(/^\/abonnement\?testcheckout=/);
    expect(await p.haalStatus(c.abonnementRef)).toBe("geen");
    const w = p.maakWebhook(p.event("proef_gestart", c.abonnementRef, "premium_maand"));
    await p.verwerkWebhook(w.body, w.handtekening);
    expect(await p.haalStatus(c.abonnementRef)).toBe("proef");
    await p.verwerkWebhook(w.body, w.handtekening); // dubbel: geen effect
    expect(await p.haalStatus(c.abonnementRef)).toBe("proef");
    await p.annuleer(c.abonnementRef);
    expect(await p.haalStatus(c.abonnementRef)).toBe("opgezegd");
    await expect(p.verwerkWebhook(w.body, "test_vals")).rejects.toThrow(/handtekening/);
  });
  it("testbetalingen alleen in testmodus en zonder echte provider", () => {
    expect(BETAALPROVIDER_GEKOPPELD).toBe(false);
    expect(testBetalingGeweigerd("test")).toBeNull();
    expect(testBetalingGeweigerd("live")).toMatch(/Echte betalingen/);
    expect(testBetalingGeweigerd("test", true)).toMatch(/echte betaalprovider/);
  });
});

describe("fee-verdeling makerabonnement", () => {
  it("telt exact op tot de prijs", () => {
    for (const prijs of [100, 299, 499, 999, 1234, 5000]) {
      const v = verdeelOpbrengst(prijs);
      expect(v.btwCent + v.betaalkostenCent + v.platformCent + v.makerCent).toBe(prijs);
      expect(v.makerCent).toBeGreaterThan(0);
    }
  });
  it("€ 4,99: btw 21%, betaalkosten, 15% platform", () => {
    expect(verdeelOpbrengst(499)).toEqual({
      prijsCent: 499,
      btwCent: 87,
      betaalkostenCent: 32,
      platformCent: 62,
      makerCent: 318,
    });
    expect(verdeelOpbrengst(0).makerCent).toBe(0);
  });
  it("leest een prijs in Belgische notatie", () => {
    expect(leesPrijs("4,99")).toBe(499);
    expect(leesPrijs("€ 3")).toBe(300);
    expect(leesPrijs("0,50")).toBeNull();
    expect(leesPrijs("abc")).toBeNull();
    expect(leesPrijs("60")).toBeNull();
    expect(euro(499)).toMatch(/4,99/);
  });
});

describe("entitlements", () => {
  const nu = new Date("2026-11-15T12:00:00Z");
  it("geeft recht binnen de geldigheid", () => {
    const g = {
      id: "u",
      entitlements: [{ recht: "premium.weekmenu_extra", geldig_tot: "2026-11-20" }],
    };
    expect(heeftRecht(g, "premium.weekmenu_extra", nu)).toBe(true);
    expect(heeftRecht(g, "premium.seizoenskalender", nu)).toBe(false);
    expect(heeftRecht(g, "premium.weekmenu_extra", new Date("2026-11-21T12:00:00Z"))).toBe(false);
  });
  it("zonder einddatum altijd, zonder gebruiker nooit", () => {
    expect(heeftRecht({ id: "u", entitlements: [{ recht: "x", geldig_tot: null }] }, "x", nu)).toBe(
      true,
    );
    expect(heeftRecht(null, "x", nu)).toBe(false);
    expect(heeftRecht({ id: "u", entitlements: [] }, "x", nu)).toBe(false);
  });
  it("elk plan heeft een prijs als voorstel en eigen rechten", () => {
    expect(PLANNEN.premium_maand.prijsCent).toBe(499);
    expect(PLANNEN.premium_maand.rechten).toContain("premium.weekmenu_extra");
  });
});
