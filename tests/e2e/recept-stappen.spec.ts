/**
 * Werkstroom A: een recept stap voor stap invoeren (beginners). Keuze, voortgang, heen en weer
 * zonder gegevensverlies, controle en bewaren. Nep-databank.
 */
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("stap voor stap: voortgang, vorige/volgende zonder verlies, nakijken en bewaren", async ({
  page,
  extern,
}) => {
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: "Stap voor stap" }).click();
  const voortgang = page.getByTestId("stap-voortgang");
  await expect(voortgang).toHaveText("Stap 1 van 4: Naam en foto");
  // Alleen wat bij stap 1 hoort.
  await expect(page.getByLabel("Naam van het gerecht")).toBeVisible();
  await expect(page.getByLabel(/Ingrediënten — één per regel/)).toBeHidden();
  await expect(page.getByRole("heading", { name: "Hoe wil je je recept toevoegen?" })).toHaveCount(
    0,
  );
  await page.getByLabel("Naam van het gerecht").fill("Preisoep van oma");

  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(voortgang).toHaveText("Stap 2 van 4: Ingrediënten");
  await expect(voortgang).toBeFocused();
  await expect(page.getByLabel("Naam van het gerecht")).toBeHidden();
  await page
    .getByLabel(/Ingrediënten — één per regel/)
    .fill("3 preien\n2 aardappelen\n1 l bouillon");

  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(voortgang).toHaveText("Stap 3 van 4: Bereiding");
  await page
    .getByLabel(/Bereiding — één stap per regel/)
    .fill("Snij de groenten.\nKook 25 minuten en mix.");

  // Terug naar stap 1 en 2: alles staat er nog.
  await page.getByRole("button", { name: "Vorige" }).click();
  await expect(page.getByLabel(/Ingrediënten — één per regel/)).toHaveValue(
    "3 preien\n2 aardappelen\n1 l bouillon",
  );
  await page.getByRole("button", { name: "Vorige" }).click();
  await expect(page.getByLabel("Naam van het gerecht")).toHaveValue("Preisoep van oma");
  await expect(page.getByRole("button", { name: "Vorige" })).toBeDisabled();

  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Volgende" }).click();
  await expect(voortgang).toHaveText("Stap 4 van 4: Klopt alles?");
  const controle = page.getByTestId("stap-controle");
  await expect(controle).toContainText("Preisoep van oma");
  await expect(controle).toContainText("3 ingrediënten: preien, aardappelen, bouillon");
  await expect(controle).toContainText("2 stappen");
  expect(await axeErnstig(page)).toEqual([]);

  // "Aanpassen" springt naar de juiste stap.
  await controle.getByRole("button", { name: "Bereiding aanpassen" }).click();
  await expect(voortgang).toHaveText("Stap 3 van 4: Bereiding");
  await page.getByRole("button", { name: "Volgende" }).click();

  await page.getByRole("button", { name: "Bewaren", exact: true }).click();
  await expect(page).toHaveURL(/\/recepten\/[0-9a-f-]{36}$/);
  const db = await nepDb();
  const recept = (db.recipes ?? []).find((r) => r["title"] === "Preisoep van oma");
  expect(recept?.["instructions"]).toEqual(["Snij de groenten.", "Kook 25 minuten en mix."]);
  expect(
    (db.recipe_ingredients ?? []).filter((i) => i["recipe_id"] === recept?.["id"]),
  ).toHaveLength(3);
  void extern;
});

test("stap voor stap wordt onthouden, en zonder naam kan je niet bewaren", async ({
  page,
  extern,
}) => {
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: "Stap voor stap" }).click();
  await page.reload();
  await expect(page.getByTestId("stap-voortgang")).toHaveText("Stap 1 van 4: Naam en foto");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Volgende" }).click();
  await expect(page.getByRole("alert")).toContainText("Geef je gerecht eerst een naam");
  await expect(page.getByRole("button", { name: "Bewaren", exact: true })).toBeDisabled();
  // Terug naar alles op één scherm.
  await page.getByRole("button", { name: "Alles op één scherm" }).click();
  await expect(page.getByTestId("stap-voortgang")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Hoe wil je je recept toevoegen?" }),
  ).toBeVisible();
  void extern;
});
