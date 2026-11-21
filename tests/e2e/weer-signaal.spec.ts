/**
 * Werkstroom F — weer als klein, optioneel signaal op Vandaag (testadapter, geen weerdienst,
 * geen locatie). Aan/uit in Instellingen › Maaltijden › Weer. Nepdata.
 */
import type { Page } from "@playwright/test";
import { axeErnstig, expect, meldAan, resetDemo, test, zetKlok } from "./helpers";

async function testweer(page: Page, soort: "warm" | "koud" | "zacht") {
  await page.addInitScript((s) => window.localStorage.setItem("foodlo:testweer", s), soort);
}

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await zetKlok(page, 14);
});

test("warm testweer: signaal op Vandaag, gelabeld als testgegevens; uitzetten in Instellingen", async ({
  page,
  extern,
}) => {
  await testweer(page, "warm");
  await page.goto("/");
  const weer = page.getByRole("region", { name: "Weer vandaag" });
  await expect(weer).toContainText("Warm vandaag: iets fris?");
  await expect(weer).toContainText("28 °C in Gent");
  await expect(weer).toContainText("Testgegevens, geen echte weerdienst");
  expect(await axeErnstig(page)).toEqual([]);

  await weer.getByRole("link", { name: "Weer uitzetten" }).click();
  await expect(page).toHaveURL(/instellingen/);
  const schakelaar = page.getByRole("switch", { name: /Weer gebruiken in voorstellen/ });
  await expect(schakelaar).toBeChecked();
  await schakelaar.click();
  await expect(schakelaar).not.toBeChecked();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Weer vandaag" })).toHaveCount(0);

  // Weer aan: het signaal komt terug.
  await page.goto("/instellingen");
  await page.getByRole("switch", { name: /Weer gebruiken in voorstellen/ }).click();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Weer vandaag" })).toBeVisible();
  // Geen enkele weerdienst of andere externe host aangesproken.
  expect(extern).toEqual([]);
});

test("koud testweer: iets warms", async ({ page }) => {
  await testweer(page, "koud");
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Weer vandaag" })).toContainText(
    "Koud vandaag: iets warms?",
  );
});

test("een zachte dag geeft geen weersignaal: Vandaag blijft rustig", async ({ page }) => {
  await testweer(page, "zacht");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Weer vandaag" })).toHaveCount(0);
});
