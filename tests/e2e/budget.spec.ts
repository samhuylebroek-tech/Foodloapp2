/**
 * Werkstroom F — weekbudget: instellen in Instellingen, geschatte kost en waarschuwing in Week,
 * geschatte kost op het recept. Altijd als "schatting" (geen prijsbron). Nepdata.
 */
import { axeErnstig, expect, meldAan, resetDemo, test, zetKlok } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await zetKlok(page, 14);
});

test("weekbudget instellen; Week waarschuwt erboven en zegt dat het een schatting is", async ({
  page,
}) => {
  await page.goto("/planner");
  const budget = page.getByRole("region", { name: "Budget deze week" });
  await expect(budget).toContainText("Geschatte kost: €");
  await expect(budget).toContainText("Schatting met vaste richtprijzen");
  await budget.getByRole("link", { name: "Stel een weekbudget in" }).click();

  const veld = page.getByLabel("Wat wil je per week uitgeven aan eten? (in euro)");
  await veld.fill("veel");
  await page.getByRole("button", { name: "Bewaar budget" }).click();
  await expect(page.getByRole("alert")).toContainText("Typ een bedrag in euro");

  await veld.fill("10");
  await page.getByRole("button", { name: "Bewaar budget" }).click();
  await expect(page.getByText("Weekbudget bewaard: € 10,00")).toBeVisible();

  await page.goto("/planner");
  await expect(budget).toContainText("van € 10,00");
  await expect(budget.getByRole("status")).toContainText("boven je weekbudget");
  expect(await axeErnstig(page)).toEqual([]);

  // Ruimer budget: geen waarschuwing meer.
  await page.goto("/instellingen");
  await veld.fill("500");
  await page.getByRole("button", { name: "Bewaar budget" }).click();
  await page.goto("/planner");
  await expect(budget).toContainText("Nog ongeveer");
  await expect(budget.getByRole("status")).toHaveCount(0);
});

test("recept toont een geschatte kost die meeschaalt met het aantal personen", async ({ page }) => {
  await page.goto("/recepten/aaaaaaaa-0000-4000-8000-000000000008");
  const kenmerken = page.getByRole("list", { name: "Kenmerken" });
  const kost = kenmerken.getByText("schatting");
  await expect(kost).toBeVisible();
  const voor = await kenmerken.locator("li", { hasText: "schatting" }).innerText();
  await page.getByRole("button", { name: "Minder personen" }).first().click();
  await page.getByRole("button", { name: "Minder personen" }).first().click();
  await expect(kenmerken.locator("li", { hasText: "schatting" })).not.toHaveText(voor);
});
