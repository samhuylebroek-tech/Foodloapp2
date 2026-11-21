/**
 * P4 — Proactieve suggesties (nepdata, demo, testweer, geen AI).
 * - Hooguit één proactieve kaart op Vandaag.
 * - Instellingen › Suggesties: een soort uitzetten → die kaart verdwijnt op Vandaag.
 * - "Niet meer tonen" per kaart, terug te halen in de instellingen.
 * - De variatiekaart opent de assistent met een voorstel (verandert zelf niets).
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test, zetKlok } from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const R = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const iso = (d: Date) => d.toLocaleDateString("sv-SE");

/** Deze week drie keer vlees (vandaag en twee andere dagen van deze week). */
async function weekMetDrieKeerVlees() {
  const nu = new Date();
  nu.setHours(12, 0, 0, 0);
  const maandag = new Date(nu);
  maandag.setDate(nu.getDate() - ((nu.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(maandag);
    d.setDate(maandag.getDate() + i);
    return iso(d);
  });
  const vandaag = iso(nu);
  const andere = week.filter((d) => d !== vandaag).slice(0, 2);
  const res = await fetch(`${NEP}/meal_plan?user_id=eq.${DEMO_USER_ID}`, { method: "DELETE" });
  expect(res.ok).toBe(true);
  const rijen = [
    [vandaag, 1],
    [andere[0]!, 4],
    [andere[1]!, 8],
  ].map(([plan_date, n], i) => ({
    id: `cccccccc-0000-4000-8000-0000000000a${i}`,
    user_id: DEMO_USER_ID,
    recipe_id: R(n as number),
    plan_date,
    meal_type: "avondeten",
    personen: 4,
    custom_title: null,
    soort: null,
    group_id: null,
  }));
  const ins = await fetch(`${NEP}/meal_plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(rijen),
  });
  expect(ins.ok).toBe(true);
}

const kaarten = (page: Page) =>
  page.locator(
    '[data-suggestie], section[aria-label="Weer vandaag"], section[aria-labelledby="gebruik-eerst-titel"]',
  );

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await weekMetDrieKeerVlees();
  await page.addInitScript(() => window.localStorage.setItem("foodlo:testweer", "koud"));
  await meldAan(page);
  await zetKlok(page, 14);
});

test("één kaart tegelijk; soort uitzetten → kaart weg; niet meer tonen → terug te halen", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  const weer = page.getByRole("region", { name: "Weer vandaag" });
  await expect(weer).toContainText("Koud vandaag: iets warms?");
  await expect(kaarten(page)).toHaveCount(1);
  await expect(weer.getByRole("button", { name: "Niet meer tonen" })).toBeVisible();

  // Instellingen › Suggesties: weer uit.
  await weer.getByRole("link", { name: "Suggesties instellen" }).click();
  await expect(page).toHaveURL(/\/instellingen\/suggesties/);
  // 7 soorten suggesties + 5 soorten meldingen in de app (P5).
  await expect(page.getByRole("region", { name: "Op Vandaag" }).getByRole("switch")).toHaveCount(7);
  expect(await axeErnstig(page)).toEqual([]);
  const schakelaar = page.getByRole("switch", { name: /^Weer/ });
  await expect(schakelaar).toBeChecked();
  await schakelaar.click();
  await expect(schakelaar).not.toBeChecked();
  await expect
    .poll(async () => JSON.stringify((await nepDb())["suggestie_instellingen"] ?? []))
    .toContain("weer");

  // Vandaag: geen weerkaart meer; de volgende kaart is "Gevarieerder eten" (3 keer vlees).
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const variatie = page.getByRole("region", { name: "Gevarieerder eten" });
  await expect(variatie).toContainText("Deze week 3 keer vlees");
  await expect(page.getByRole("region", { name: "Weer vandaag" })).toHaveCount(0);
  await expect(kaarten(page)).toHaveCount(1);

  // Niet meer tonen: deze kaart weg, de volgende (seizoen) komt.
  await variatie.getByRole("button", { name: "Niet meer tonen" }).click();
  await expect(page.getByText("Deze suggestie zie je niet meer")).toBeVisible();
  await expect(variatie).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Seizoen" })).toContainText("In het seizoen");
  await expect(kaarten(page)).toHaveCount(1);

  // Terughalen in de instellingen.
  await page.goto("/instellingen/suggesties");
  await expect(page.getByTestId("aantal-verborgen")).toHaveText("1 kaart verborgen");
  await page.getByRole("button", { name: "Toon ze weer" }).click();
  await expect(page.getByTestId("aantal-verborgen")).toHaveText("Geen verborgen kaarten");
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Gevarieerder eten" })).toBeVisible();
  expect(extern).toEqual([]);
});

test("variatiekaart → assistent met een vegetarisch voorstel; er verandert niets zonder Doe maar", async ({
  page,
}) => {
  await page.goto("/instellingen/suggesties");
  await page.getByRole("switch", { name: /^Weer/ }).click();
  await page.goto("/");
  const variatie = page.getByRole("region", { name: "Gevarieerder eten" });
  const voor = JSON.stringify((await nepDb())["meal_plan"]);
  await variatie.getByRole("link", { name: "Toon een voorstel" }).click();
  await expect(page).toHaveURL(/\/assistent/);
  const kaart = page.locator("[data-voorstel]").last();
  await expect(kaart.getByRole("heading", { name: /Een ander gerecht voor/ })).toBeVisible();
  await expect(kaart.getByRole("button", { name: "Doe maar" })).toBeVisible();
  expect(JSON.stringify((await nepDb())["meal_plan"])).toBe(voor);
});

test("Slimme voorstellen uit: geen enkele kaart, en de suggestiepagina zegt waarom", async ({
  page,
}) => {
  await page.goto("/instellingen");
  await page.getByRole("switch", { name: "Slimme voorstellen" }).click();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(kaarten(page)).toHaveCount(0);
  await page.goto("/instellingen");
  await page.getByRole("link", { name: /Suggesties/ }).click();
  await expect(page.getByRole("note")).toContainText('"Slimme voorstellen" staat uit');
});
