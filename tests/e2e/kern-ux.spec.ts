/**
 * Kleine UX-verbeteringen uit de persona-audit: zoeken met tikfout (BUG-100), negatieve
 * hoeveelheid in de voorraad (BUG-101), zichtbare knop "Aanpassen" (BUG-102). Demo-data.
 */
import {
  expect,
  heeftHorizontaleScroll,
  meldAan,
  nepDb,
  resetDemo,
  test,
  zetKlok,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
});

test("BUG-100: zoeken met een tikfout vindt het recept toch", async ({ page, extern }) => {
  await page.goto("/gerechten");
  await page.getByLabel("Zoeken").fill("stofvlees");
  await expect(page.getByText("Stoofvlees met frietjes").first()).toBeVisible();
  await page.getByLabel("Zoeken").fill("spagetti");
  await expect(page.getByText("Spaghetti bolognese").first()).toBeVisible();
  void extern;
});

test("BUG-101: negatieve hoeveelheid geeft een duidelijke melding en wordt niet bewaard", async ({
  page,
  extern,
}) => {
  await page.goto("/voorraad");
  const voor = ((await nepDb())["pantry_items"] ?? []).length;
  await page.getByLabel("Nieuw product").fill("-5 kg rijst");
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(page.getByText(/kan niet negatief zijn/)).toBeVisible();
  expect(((await nepDb())["pantry_items"] ?? []).length).toBe(voor);
  void extern;
});

test("BUG-102: eigen recept heeft een zichtbare knop Aanpassen (ook op 320 px)", async ({
  page,
  extern,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/gerechten");
  await page.getByText("Spaghetti bolognese").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const knop = page.getByRole("link", { name: "Aanpassen" });
  await expect(knop).toBeVisible();
  expect(await heeftHorizontaleScroll(page)).toBe(false);
  await knop.click();
  await expect(page.getByLabel("Naam van het gerecht")).toBeVisible();
  void extern;
});
