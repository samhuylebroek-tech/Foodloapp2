/**
 * Schermafbeeldingen van de kernschermen met demodata (alleen op aanvraag):
 *   SCHERMEN=1 SCHERM_MAP=voor npx playwright test schermen --project=mobiel-390 --project=desktop
 * Geen assertions op pixels; dient als visueel verslag voor/na het herontwerp.
 */
import { expect, meldAan, resetDemo, test } from "./helpers";

const MAP = process.env["SCHERM_MAP"] ?? "na";

test.skip(!process.env["SCHERMEN"], "alleen met SCHERMEN=1");

test("kernschermen", async ({ page, extern }, info) => {
  await resetDemo();
  await meldAan(page);
  const schiet = async (naam: string) => {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `docs/foodloapp-v2/schermen/${MAP}/${info.project.name}-${naam}.png`,
      fullPage: true,
    });
  };
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await schiet("1-start");
  await page.goto("/gerechten");
  await schiet("2-recepten");
  await page.goto("/recepten/aaaaaaaa-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: /Stoofvlees/ }).first()).toBeVisible();
  await schiet("3-recept");
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await schiet("4-kookstand");
  await page.goto("/planner");
  await schiet("5-weekmenu");
  await page.goto("/boodschappen");
  await schiet("6-boodschappen");
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Foto van recept/ }).click();
  await schiet("7-nieuw-recept");
  void extern;
});
