/**
 * Fase 6 — premium en abonnementsbeheer in TESTMODUS (nep-Supabase, TestBetaalProvider, verzonnen
 * data): nette premium-uitleg voor gratis gebruikers, extra's alleen met recht (server-side),
 * opzeggen → actief tot einde periode → daarna dicht, mislukte testbetaling → genadeperiode,
 * facturen met btw (ook als tekstbestand), overstap naar jaar (pro rata), terugbetaling binnen
 * 14 dagen, makerabonnement + Premium tegelijk, en een directe API-aanroep zonder recht.
 */
import { readFileSync } from "node:fs";
import type { Page, Request } from "@playwright/test";
import { seizoenVoor } from "../../src/lib/betalen/premium-inhoud";
import { expect, meldAan, NEP_SUPABASE, nepDb, resetDemo, test } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const AHMED = "c7c7c7c7-0000-4000-8000-000000000002";
const HARIRA = "a7a7a7a7-0000-4000-8000-000000000006";
const JAN = "22222222-2222-4222-8222-222222222222";

test.describe.configure({ timeout: 120_000 });
test.beforeEach(async () => {
  await resetDemo();
});

const mijnRechten = async () =>
  ((await nepDb()).entitlements ?? [])
    .filter((e) => e["user_id"] === IK)
    .map((e) => String(e["recht"]))
    .sort();

async function startPremium(page: Page) {
  await page.goto("/premium");
  await page.getByRole("button", { name: "Premium testen (testmodus)" }).click();
  await expect(page).toHaveURL(/\/abonnement$/);
  await expect(page.getByRole("status").getByText("Proefperiode")).toBeVisible();
}

async function extrasOpen(page: Page) {
  await page.goto("/premium");
  await expect(page.getByRole("list", { name: "Seizoenskalender" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Weekmenu-sjablonen" })).toBeVisible();
  await expect(page.getByTestId("premium-uitleg")).toHaveCount(0);
}

async function extrasDicht(page: Page) {
  await page.goto("/premium");
  await expect(page.getByTestId("premium-uitleg")).toHaveCount(2);
  await expect(page.getByRole("list", { name: "Seizoenskalender" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Weekmenu-sjablonen" })).toHaveCount(0);
}

test("gratis: nette premium-uitleg, kern blijft gratis, geen kapotte knoppen", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await extrasDicht(page);
  const uitleg = page.getByTestId("premium-uitleg");
  await expect(uitleg.first()).toContainText("Dit hoort bij Premium.");
  await expect(uitleg.first()).toContainText("Alles wat je nu gratis gebruikt, blijft gratis.");
  await expect(uitleg.nth(1)).toContainText("Kant-en-klare weken");
  // In de uitleg staat geen (uitgeschakelde) knop.
  await expect(uitleg.getByRole("button")).toHaveCount(0);
  for (const kern of ["Allergie- en dieetcontrole", "Boodschappenlijst", "Weekmenu plannen"]) {
    await expect(page.getByRole("rowheader", { name: kern })).toBeVisible();
  }
  // Prijzen uit de centrale configuratie, met btw.
  await expect(page.getByRole("heading", { name: /4,99 per maand/ })).toBeVisible();
  await expect(page.getByText(/waarvan €\s0,87 btw \(21 %\)/)).toBeVisible();
  await expect(page.getByText(/49,90 per jaar/)).toBeVisible();
  void extern;
});

test("premium (test) → extra's open → opzeggen → actief tot einde → einde nabootsen → dicht", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await startPremium(page);
  expect(await mijnRechten()).toEqual(["premium.seizoenskalender", "premium.weekmenu_extra"]);
  await extrasOpen(page);
  // De seizoenskalender komt van de server (na de rechtencontrole).
  await expect(
    page.getByRole("list", { name: "Seizoenskalender" }).getByRole("listitem"),
  ).toHaveCount(4);
  await expect(page.getByRole("list", { name: "Weekmenu-sjablonen" })).toContainText("Veggie week");

  await page.goto("/abonnement");
  await page.getByRole("button", { name: "Geslaagde betaling nabootsen" }).click();
  await expect(page.getByRole("status").getByText("Actief")).toBeVisible();
  await expect(page.getByTestId("volgende-factuur")).toContainText(/4,99/);

  await page.getByRole("button", { name: "Abonnement opzeggen" }).click();
  await page.getByRole("button", { name: "Ja, opzeggen" }).click();
  await expect(page.getByRole("status").getByText("Opgezegd")).toBeVisible();
  await expect(page.getByText(/Premium werkt nog tot/)).toBeVisible();
  await expect(page.getByTestId("volgende-factuur")).toHaveCount(0);
  // Opgezegd = nog actief tot het einde van de periode.
  await extrasOpen(page);

  await page.goto("/abonnement");
  await page.getByRole("button", { name: "Einde van de periode nabootsen" }).click();
  await expect(page.getByRole("heading", { name: "Gratis" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bekijk Premium" })).toBeVisible();
  await expect.poll(mijnRechten).toEqual([]);
  await extrasDicht(page);
  const abo = (await nepDb()).abonnementen?.find((a) => a["user_id"] === IK);
  expect(abo).toMatchObject({ status: "geen", modus: "test", periode_einde: null });
  void extern;
});

test("geweigerde testbetaling → genadeperiode met duidelijke melding, geen gegevensverlies", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  const receptenVoor = ((await nepDb()).recipes ?? []).length;
  await startPremium(page);
  await page.getByRole("button", { name: "Mislukte betaling nabootsen" }).click();
  const melding = page.getByRole("alert").filter({ hasText: "lukte niet" });
  await expect(melding).toContainText("Je laatste (test)betaling lukte niet.");
  await expect(melding).toContainText("genadeperiode van 7 dagen");
  await expect(melding).toContainText("blijven altijd bewaard");
  await expect(page.getByRole("status").getByText("Betaling mislukt")).toBeVisible();
  const abo = (await nepDb()).abonnementen?.find((a) => a["user_id"] === IK);
  expect(abo?.["genade_tot"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const facturen = (await nepDb()).facturen?.filter((f) => f["user_id"] === IK) ?? [];
  expect(facturen.map((f) => f["status"]).sort()).toEqual(["betaald", "mislukt"]);
  // Tijdens de genadeperiode blijft Premium werken.
  await extrasOpen(page);

  await page.goto("/abonnement");
  await page.getByRole("button", { name: "Einde van de genadeperiode nabootsen" }).click();
  await expect(page.getByRole("heading", { name: "Gratis" })).toBeVisible();
  await extrasDicht(page);
  expect(((await nepDb()).recipes ?? []).length).toBe(receptenVoor);
  void extern;
});

test("factuur met btw, als tekst te downloaden; overstap naar jaar pro rata; geld terug binnen 14 dagen", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await startPremium(page);
  await page.getByRole("button", { name: "Geslaagde betaling nabootsen" }).click();
  await expect(page.getByRole("status").getByText("Actief")).toBeVisible();
  const lijst = page.getByRole("list", { name: "Testfacturen" });
  const maand = lijst.getByRole("listitem").filter({ hasText: "Foodlo Premium: 1 maand" });
  await expect(maand).toContainText(/Excl\. btw €\s4,12 · btw 21 % €\s0,87/);
  const db = await nepDb();
  const rij = db.facturen?.find((f) => f["user_id"] === IK && f["bedrag_cent"] === 499);
  expect(rij).toMatchObject({ btw_cent: 87, btw_procent: 21, soort: "factuur", test: true });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    maand.getByRole("button", { name: /^Download TEST-\d{4}-\d{4} \(tekst\)$/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^TEST-\d{4}-\d{4}\.txt$/);
  const tekst = readFileSync((await download.path())!, "utf8");
  expect(tekst).toContain("TESTFACTUUR — GEEN ECHTE FACTUUR");
  expect(tekst).toMatch(/Btw 21 %:\s+€\s0,87/);

  // Overstap naar jaar: tekstvoorstel pro rata, daarna testfactuur voor het verschil.
  await expect(page.getByTestId("pro-rata")).toContainText(/tegoed/);
  await page.getByRole("button", { name: "Overstappen naar jaar (testmodus)" }).click();
  await expect(page.getByRole("heading", { name: "Foodlo Premium (jaar)" })).toBeVisible();
  await expect(lijst.getByText(/overstap, 1 jaar min/)).toBeVisible();
  await expect(page.getByTestId("pro-rata")).toContainText(/niets teruggestort/);

  // Geld terug: de laatste betaling (de overstap) binnen 14 dagen, in twee tikken.
  await page.getByRole("button", { name: "Terugbetaling vragen (testmodus)" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Premium stopt meteen");
  await page.getByRole("button", { name: "Ja, terugbetalen" }).click();
  await expect(page.getByRole("heading", { name: "Gratis" })).toBeVisible();
  await expect(lijst.getByText(/testcreditnota/)).toBeVisible();
  await expect(lijst.getByText("(terugbetaald)")).toBeVisible();
  const na = await nepDb();
  const credit = na.facturen?.find((f) => f["user_id"] === IK && f["soort"] === "creditnota");
  expect(credit?.["verwijst_naar"]).toBeTruthy();
  expect(credit?.["test"]).toBe(true);
  expect(na.betaal_events?.some((e) => e["user_id"] === IK && e["soort"] === "terugbetaald")).toBe(
    true,
  );
  expect(await mijnRechten()).toEqual([]);
  void extern;
});

test("makerabonnement en Premium tegelijk: elk ontgrendelt zijn eigen extra", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.goto("/makers/chef-ahmed");
  const blok = page.getByTestId("maker-abonneren");
  await blok.getByRole("button", { name: "Abonneren in testmodus" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Ja, abonneren (test)" }).click();
  await expect(blok.getByRole("status")).toContainText("Je bent abonnee (testmodus)");
  // Alleen maker: exclusief recept open, premium-extra's dicht.
  await page.goto(`/recepten/${HARIRA}`);
  await expect(page.getByText("Laat 40 minuten zacht koken.").first()).toBeVisible();
  await extrasDicht(page);

  await startPremium(page);
  await extrasOpen(page);
  await page.goto(`/recepten/${HARIRA}`);
  await expect(page.getByText("Laat 40 minuten zacht koken.").first()).toBeVisible();
  const db = await nepDb();
  expect(
    db.maker_abonnementen?.find((a) => a["fan_id"] === IK && a["creator_id"] === AHMED)?.["status"],
  ).toBe("actief");
  expect(db.abonnementen?.find((a) => a["user_id"] === IK)?.["status"]).toBe("proef");
  void extern;
});

test("directe API-aanroep zonder recht wordt geweigerd, met recht niet", async ({
  page,
  request,
  extern,
}) => {
  let opgenomen: Request | null = null;
  page.on("request", (r) => {
    if (r.url().includes("/_serverFn/") && (r.postData() ?? "").includes("seizoenskalender"))
      opgenomen = r;
  });
  await meldAan(page);
  await startPremium(page);
  await extrasOpen(page);
  await expect.poll(() => opgenomen !== null).toBe(true);
  const req = opgenomen as unknown as Request;
  const token = async (sub?: string) => {
    const q = sub ? `?sub=${sub}` : "";
    return ((await (await fetch(`${NEP_SUPABASE}/__token${q}`)).json()) as { token: string }).token;
  };
  const speel = async (auth: string | null) => {
    const headers = { ...req.headers() };
    delete headers["authorization"];
    if (auth) headers["authorization"] = `Bearer ${auth}`;
    const r = await request.fetch(req.url(), {
      method: req.method(),
      headers,
      data: req.postData() ?? undefined,
    });
    return r.text();
  };
  const items = seizoenVoor().items;
  const metRecht = await speel(await token(IK));
  expect(metRecht).toContain(items[0]);
  expect(metRecht).not.toContain("GEEN_RECHT");

  const zonder = await speel(await token(JAN));
  expect(zonder).toContain("GEEN_RECHT");
  expect(zonder).toContain("Dit hoort bij Premium");
  expect(zonder).not.toContain('"items"');
  for (const i of items) expect(zonder).not.toContain(i);

  const anoniem = await speel(null);
  expect(anoniem).toMatch(/Unauthorized/);
  expect(anoniem).not.toContain("items");
  void extern;
});
