/**
 * Premium en abonnementen in TESTMODUS (voorstel 0012, nep-Supabase, TestBetaalProvider):
 * testcheckout → proef → mislukte/geslaagde betaling nabootsen → opzeggen in twee tikken;
 * testfacturen; entitlement ontgrendelt de premium-extra; partnerplan alleen voor eigenaar/finance;
 * makerblok "Abonnees" met fee-berekening, zonder uitbetaling.
 */
import { expect, meldAan, nepDb, resetDemo, test } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const PROEF = "5a5a5a5a-0000-4000-8000-000000000003";
const ELS = "5a5a5a5a-0000-4000-8000-000000000001";
const TOM = "5a5a5a5a-0000-4000-8000-000000000002";
const LOTTE_USER = "9a9a9a9a-0000-4000-8000-000000000001";
const HOEVE = "5b5b5b5b-0000-4000-8000-000000000001";

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async () => {
  await resetDemo();
});

test("testcheckout, status, nagebootste betalingen en opzeggen in twee tikken", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.goto("/premium");
  await expect(page.getByText("Testmodus: nog niet te koop.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /4,99 per maand/ })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Allergie- en dieetcontrole" })).toBeVisible();
  // Zonder recht: de premium-extra is op slot.
  await expect(page.getByText("Beschikbaar met Premium.", { exact: false })).toBeVisible();
  await expect(page.getByRole("list", { name: "Seizoenskalender" })).toHaveCount(0);

  await page.getByRole("button", { name: "Premium testen (testmodus)" }).click();
  await expect(page).toHaveURL(/\/abonnement$/);
  await expect(page.getByRole("heading", { name: "Foodlo Premium" })).toBeVisible();
  await expect(page.getByRole("status").getByText("Proefperiode")).toBeVisible();
  const facturen = page.getByRole("list", { name: "Testfacturen" });
  await expect(facturen.getByText(/proefperiode \(14 dagen\)/)).toBeVisible();
  await expect(facturen.getByText(/TEST-\d{4}-0001 · .* · testfactuur/)).toBeVisible();

  let db = await nepDb();
  const abo = db.abonnementen?.find((a) => a["user_id"] === IK);
  expect(abo).toMatchObject({
    status: "proef",
    modus: "test",
    provider: "test",
    plan: "premium_maand",
  });
  const events = (db.betaal_events ?? []).filter((e) => e["user_id"] === IK);
  expect(events.map((e) => e["soort"])).toEqual(["proef_gestart"]);
  expect(new Set(events.map((e) => e["event_id"])).size).toBe(events.length);
  expect(
    (db.entitlements ?? [])
      .filter((e) => e["user_id"] === IK)
      .map((e) => e["recht"])
      .sort(),
  ).toEqual(["premium.seizoenskalender", "premium.weekmenu_extra"]);

  // Het recht ontgrendelt de extra.
  await page.goto("/premium");
  await expect(page.getByRole("list", { name: "Seizoenskalender" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Premium testen (testmodus)" })).toHaveCount(0);

  await page.goto("/abonnement");
  await page.getByRole("button", { name: "Mislukte betaling nabootsen" }).click();
  await expect(page.getByRole("status").getByText("Betaling mislukt")).toBeVisible();
  await expect(page.getByText(/pas je betaalgegevens aan/)).toBeVisible();
  await page.getByRole("button", { name: "Geslaagde betaling nabootsen" }).click();
  await expect(page.getByRole("status").getByText("Actief")).toBeVisible();

  // Opzeggen: tik 1 en tik 2.
  await page.getByRole("button", { name: "Abonnement opzeggen" }).click();
  await page.getByRole("button", { name: "Ja, opzeggen" }).click();
  await expect(page.getByRole("status").getByText("Opgezegd")).toBeVisible();
  await expect(page.getByText(/Premium werkt nog tot/)).toBeVisible();

  db = await nepDb();
  expect(db.abonnementen?.find((a) => a["user_id"] === IK)?.["status"]).toBe("opgezegd");
  expect(
    (db.betaal_events ?? []).filter((e) => e["user_id"] === IK).map((e) => e["soort"]),
  ).toEqual(["proef_gestart", "betaling_mislukt", "betaling_gelukt", "opgezegd"]);
  void extern;
});

test("demogebruiker in proefperiode ziet zijn status met uitleg", async ({ page, extern }) => {
  await meldAan(page, PROEF);
  await page.goto("/abonnement");
  await expect(page.getByRole("status").getByText("Proefperiode")).toBeVisible();
  await expect(page.getByText(/Proef loopt tot/)).toBeVisible();
  void extern;
});

test("partnerplan: eigenaar kiest Partner Plus, analist kan niets wijzigen", async ({
  page,
  extern,
}) => {
  await meldAan(page, ELS);
  await page.goto("/partner/abonnement");
  await expect(page.getByText(/Testplannen: prijzen zijn een voorstel/)).toBeVisible();
  await page.getByRole("button", { name: "Kies Partner Plus (testmodus)" }).click();
  await expect(page.getByText(/Huidig plan: Partner Plus/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Testfacturen" }).getByText(/49,00/)).toBeVisible();
  const db = await nepDb();
  expect(db.abonnementen?.find((a) => a["partner_id"] === HOEVE)).toMatchObject({
    plan: "partner_plus",
    status: "actief",
    modus: "test",
  });

  const ander = await page.context().browser()!.newContext({
    baseURL: "http://127.0.0.1:4339",
    locale: "nl-BE",
  });
  const p2 = await ander.newPage();
  await meldAan(p2, TOM);
  await p2.goto("/partner/abonnement");
  await expect(p2.getByText(/Huidig plan: Partner Plus/)).toBeVisible();
  await expect(p2.getByText(/Je rol mag het abonnement niet wijzigen/)).toBeVisible();
  await expect(p2.getByRole("button", { name: /testmodus|opzeggen/i })).toHaveCount(0);
  await ander.close();
  void extern;
});

test("maker: abonnement in testmodus met fee-berekening (fase 4), standaard uit", async ({
  page,
  extern,
}) => {
  await meldAan(page, LOTTE_USER);
  await page.goto("/maker");
  const blok = page.getByRole("region", { name: "Abonnement voor fans" });
  await expect(blok.getByText("Testmodus: nog niet te koop.")).toBeVisible();
  await expect(blok.getByText(/Er wordt niets aangerekend en niets uitbetaald/)).toBeVisible();
  // Zonder plan staat het abonnement uit; de maker kiest het zelf.
  await expect(
    blok.getByRole("switch", { name: "Abonnement aanbieden (testmodus)" }),
  ).toHaveAttribute("aria-checked", "false");
  await blok.getByLabel(/Testprijs per maand/).fill("4,99");
  const verdeling = blok.getByRole("definition");
  await expect(blok.getByText("Jij krijgt")).toBeVisible();
  await expect(verdeling.last()).toHaveText(/3,18/);
  await blok.getByLabel(/Testprijs per maand/).fill("abc");
  await expect(blok.getByText(/Geef een bedrag tussen/)).toBeVisible();
  void extern;
});
