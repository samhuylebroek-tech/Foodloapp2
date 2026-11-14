/**
 * Ronde 2, punt 6: receptinvoer in het echte scherm (nep-databank, geen AI beschikbaar).
 * - Methode 9 (delen naar de app): vult alleen voor, er gebeurt niets automatisch.
 * - Methode 2 en 4 (link, tekst): mislukt de import (hier: geen AI/geen internet), dan wordt er
 *   niets bewaard en krijgt de gebruiker een duidelijke melding. Nooit een half recept.
 * De omzetting zelf (JSON-LD, platformen) is getest in src/lib/receptimport.test.ts.
 */
import { expect, meldAan, nepDb, resetDemo, test } from "./helpers";

const aantalRecepten = async () => ((await nepDb()).recipes ?? []).length;

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("delen naar de app: link en tekst worden voorgevuld, er wordt niets automatisch bewaard", async ({
  page,
  extern,
}) => {
  const voor = await aantalRecepten();
  const url = "https://voorbeeld.be/recept/stoofvlees";
  await page.goto(
    `/recepten/nieuw?title=${encodeURIComponent("Stoofvlees")}&text=${encodeURIComponent("Vlaamse stoofvlees met bier")}&url=${encodeURIComponent(url)}`,
  );
  await expect(page.getByText(/We hebben wat je deelde alvast overgenomen/)).toBeVisible();
  await expect(page.getByLabel("Link naar het recept")).toHaveValue(url);
  await page.waitForTimeout(1500);
  expect(await aantalRecepten()).toBe(voor);
  void extern;
});

test("link inlezen die niet lukt: duidelijke melding, niets bewaard", async ({ page, extern }) => {
  const voor = await aantalRecepten();
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Link plakken/ }).click();
  await page.getByLabel("Link naar het recept").fill("https://voorbeeld.be/recept/bestaat-niet");
  await page.getByRole("button", { name: "Inlezen" }).click();
  await expect(
    page.locator("[data-sonner-toast], [role=alert], [role=status]").first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(1000);
  expect(await aantalRecepten()).toBe(voor);
  void extern;
});

test("tekst omzetten die niet lukt: duidelijke melding, niets bewaard", async ({
  page,
  extern,
}) => {
  const voor = await aantalRecepten();
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Link plakken/ }).click();
  await page
    .getByLabel("Tekst van het recept")
    .fill("Pannenkoeken\n250 g bloem\n2 eieren\n500 ml melk\nMeng alles en bak.");
  await page.getByRole("button", { name: "Recept eruit halen" }).click();
  await expect(
    page.locator("[data-sonner-toast], [role=alert], [role=status]").first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(1000);
  expect(await aantalRecepten()).toBe(voor);
  void extern;
});

test("foto van een recept die niet lukt: duidelijke melding, niets bewaard", async ({
  page,
  extern,
}) => {
  const voor = await aantalRecepten();
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Foto van recept/ }).click();
  // Klein, geldig PNG-beeld (1 × 1 pixel) als "screenshot van een recept".
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page
    .locator("label", { hasText: "Kies een foto" })
    .locator('input[type="file"]')
    .setInputFiles({ name: "recept.png", mimeType: "image/png", buffer: png });
  await expect(
    page.locator("[data-sonner-toast], [role=alert], [role=status]").first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  expect(await aantalRecepten()).toBe(voor);
  void extern;
});

// Ronde 3 (FR-RI-05): voorbeeldweergave vóór bewaren, zonder iets te bewaren.
test("editor: 'Voorbeeld' toont het recept zoals het eruit zal zien, zonder te bewaren", async ({
  page,
  extern,
}) => {
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Zelf typen/ }).click();
  await expect(page.getByLabel("Naam van het gerecht")).toBeEditable();
  await page.getByLabel("Naam van het gerecht").fill("Tomatensoep van oma");
  await page.getByLabel(/Ingrediënten — één per regel/).fill("1 kg tomaten\n1 ui\n1 l bouillon");
  await page
    .getByLabel(/Bereiding — één stap per regel/)
    .fill("Snij de groenten.\nKook 20 minuten en mix.");
  await page.getByRole("button", { name: "Klaar", exact: true }).click();
  const venster = page.getByRole("dialog", { name: "Klopt alles?" });
  await venster.getByRole("button", { name: "Voorbeeld" }).click();
  const voorbeeld = venster.getByTestId("recept-voorbeeld");
  await expect(voorbeeld.getByRole("heading", { name: "Tomatensoep van oma" })).toBeVisible();
  await expect(voorbeeld.getByText("tomaten", { exact: true })).toBeVisible();
  await expect(voorbeeld.getByText("Kook 20 minuten en mix.")).toBeVisible();
  await venster.getByRole("button", { name: "Nakijken" }).click();
  await expect(voorbeeld).toHaveCount(0);
  void extern;
});
