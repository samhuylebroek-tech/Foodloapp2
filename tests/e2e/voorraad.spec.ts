/** Voorraadkast: wat heb ik in huis, en wat kan ik daarmee koken? Met demodata. */
import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  meldAan,
  nepDb,
  resetDemo,
  test,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await page.goto("/voorraad");
  await expect(page.getByRole("heading", { name: "Voorraadkast" })).toBeVisible();
});

test("toont de voorraad en recepten die je ermee kan maken", async ({ page, extern }) => {
  const inHuis = page.getByRole("list", { name: "In huis", exact: true });
  await expect(inHuis.getByText("pompoen")).toBeVisible();
  const koken = page.getByRole("list", { name: "Recepten met wat je in huis hebt" });
  await expect(koken.getByText("Romige pompoensoep")).toBeVisible();
  await expect(koken.getByText(/Je hebt \d+ van de \d+/).first()).toBeVisible();
  expect(await heeftHorizontaleScroll(page)).toBe(false);
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});

test("snel toevoegen en weer verwijderen met ongedaan maken", async ({ page, extern }) => {
  await page.getByRole("button", { name: "melk toevoegen" }).click();
  const inHuis = page.getByRole("list", { name: "In huis", exact: true });
  await expect(inHuis.getByText("melk", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "melk toevoegen" })).toHaveCount(0);

  await page.getByRole("button", { name: "Verwijderen: melk" }).click();
  await expect(inHuis.getByText("melk", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(inHuis.getByText("melk", { exact: true })).toBeVisible();
  void extern;
});

test("eigen invoer wordt ontleed (hoeveelheid en eenheid)", async ({ page, extern }) => {
  await page.getByLabel("Nieuw product").fill("500 g pure chocolade");
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect
    .poll(async () => (await nepDb()).pantry_items?.find((p) => p["naam"] === "pure chocolade"))
    .toMatchObject({ hoeveelheid: 500, eenheid: "g" });
  void extern;
});

test("ontbrekende ingrediënten op de lijst, zonder dubbels bij een tweede keer", async ({
  page,
  extern,
}) => {
  const voor = (await nepDb()).shopping_items?.length ?? 0;
  const eerste = page
    .getByRole("list", { name: "Recepten met wat je in huis hebt" })
    .getByRole("listitem")
    .first();
  await eerste.getByRole("button", { name: "Ontbrekende op mijn lijst" }).click();
  await expect(page.getByText(/op je lijst gezet/)).toBeVisible();
  const na = (await nepDb()).shopping_items?.length ?? 0;
  expect(na).toBeGreaterThan(voor);

  await eerste.getByRole("button", { name: "Ontbrekende op mijn lijst" }).click();
  await expect(page.getByText("Alles stond al op je lijst.")).toBeVisible();
  expect((await nepDb()).shopping_items?.length ?? 0).toBe(na);
  void extern;
});

test("vanaf Vandaag in twee tikken bij je voorraad (Keuken → Voorraad)", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: /^Keuken/ })
    .first()
    .click();
  await page
    .getByRole("navigation", { name: "Keuken" })
    .getByRole("link", { name: /Voorraad/ })
    .click();
  await expect(page).toHaveURL(/\/voorraad$/);
  void extern;
});
