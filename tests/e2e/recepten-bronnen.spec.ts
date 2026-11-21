/**
 * Fase 2: recepten uit alle bronnen, met altijd een nakijkscherm (nep-databank, geen AI, geen
 * internet). Video-link, tekst met allergeen, dubbel recept, link die niet lukt, delen en
 * delen-naar-de-app (share target).
 */
import { expect, meldAan, nepDb, resetDemo, test } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const recepten = async () => (await nepDb()).recipes ?? [];
const nietConcept = async () => (await recepten()).filter((r) => r["is_concept"] !== true);

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("video-link → nakijken → bewaren → het recept toont de videolink en klikbare tijden", async ({
  page,
  extern,
}) => {
  const voor = (await nietConcept()).length;
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Video-link/ }).click();
  await page
    .getByLabel("Link naar de video")
    .fill("https://www.tiktok.com/@chefanna/video/7301?is_from_webapp=1");
  await expect(page.getByText("✓ Video van TikTok herkend")).toBeVisible();
  await expect(page.getByLabel(/Wie maakte de video/)).toHaveValue("@chefanna");
  await page
    .getByLabel(/Tekst onder de video/)
    .fill(
      "Snelle tomatensoep\nIngrediënten:\n1 kg tomaten\n1 ui\n1 l bouillon\nBereiding:\n0:20 Snij de tomaten en de ui in stukken.\n1:05 Kook alles 20 minuten en mix fijn.",
    );
  await page.getByRole("button", { name: "Verder naar nakijken" }).click();

  const venster = page.getByRole("dialog", { name: "Kijk je recept na" });
  await expect(venster.getByTestId("nakijk-bron")).toContainText("Video van @chefanna op TikTok");
  await expect(venster.getByRole("link", { name: /Bekijk de video bij TikTok/ })).toHaveAttribute(
    "href",
    "https://www.tiktok.com/@chefanna/video/7301",
  );
  await expect(venster.getByLabel("Naam")).toHaveValue("Snelle tomatensoep");
  // Nog niets bewaard zolang je nakijkt.
  expect((await nietConcept()).length).toBe(voor);

  await venster.getByRole("button", { name: "Bewaar bij mijn recepten" }).click();
  await expect(page).toHaveURL(/\/recepten\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("video-bron")).toContainText("Video van @chefanna op TikTok");
  await expect(page.getByRole("link", { name: /Bekijk de video bij TikTok/ })).toBeVisible();
  // TikTok kent geen link naar een moment: de tijd staat er als tekst.
  await expect(page.getByText("Snij de tomaten en de ui in stukken.")).toBeVisible();

  const nieuw = (await recepten()).find((r) => r["title"] === "Snelle tomatensoep")!;
  expect(nieuw["source_url"]).toBe("https://www.tiktok.com/@chefanna/video/7301");
  expect(nieuw["user_id"]).toBe(IK);
  expect(String(nieuw["description"])).toContain("Video van @chefanna op TikTok.");
  void extern;
});

test("demo: recept van YouTube met tijdcodes opent de video op dat moment", async ({
  page,
  extern,
}) => {
  await page.goto("/recepten/aaaaaaaa-0000-4000-8000-000000000009");
  await expect(page.getByTestId("video-bron")).toContainText("Video van @chefanna op YouTube");
  const tijd = page.getByRole("link", { name: /Bekijk op 45 seconden in de video/ });
  await expect(tijd).toHaveAttribute("href", "https://www.youtube.com/watch?v=demoChoco01&t=45s");
  await expect(tijd).toHaveAttribute("target", "_blank");
  void extern;
});

test("tekst met een allergeen: waarschuwing in het nakijkscherm, niets bewaard", async ({
  page,
  extern,
}) => {
  const voor = (await recepten()).length;
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Tekst plakken/ }).click();
  await page
    .getByLabel("Tekst van het recept")
    .fill(
      "Notentaart\n200 g bloem\n100 g hazelnoten\n2 eieren\nsuiker\nMeng alles tot een deeg.\nBak 30 minuten op 180 graden.",
    );
  await page.getByRole("button", { name: "Recept eruit halen" }).click();
  const venster = page.getByRole("dialog", { name: "Kijk je recept na" });
  await expect(venster).toBeVisible({ timeout: 30_000 });
  await expect(venster.getByTestId("nakijk-bron")).toContainText("zonder slimme hulp");
  // Centrale controle: Lotte (deelt haar allergie niet) → alleen "niet geschikt".
  await expect(venster.getByTestId("eters-oordeel")).toContainText("Niet geschikt voor Lotte");
  // Onzeker: suiker zonder hoeveelheid.
  await expect(venster.getByTestId("nakijk-onzeker")).toContainText("Geen hoeveelheid bij: suiker");
  await page.waitForTimeout(1600);
  expect((await recepten()).length).toBe(voor);
  void extern;
});

test("dubbel recept: keuze tussen 'Open bestaande' en 'Toch bewaren'", async ({ page, extern }) => {
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Tekst plakken/ }).click();
  const tekst =
    "Stoofvlees met frietjes\n1 kg rundvlees\n3 uien\n50 cl donker bier\nBak het vlees bruin in boter.\nLaat 2 uur zachtjes stoven.";
  await page.getByLabel("Tekst van het recept").fill(tekst);
  await page.getByRole("button", { name: "Recept eruit halen" }).click();
  const venster = page.getByRole("dialog", { name: "Kijk je recept na" });
  await expect(venster.getByTestId("nakijk-dubbel")).toContainText(
    "Dit lijkt op je recept “Stoofvlees met frietjes”",
    { timeout: 30_000 },
  );
  await venster.getByRole("button", { name: "Open bestaande" }).click();
  await expect(page).toHaveURL(/aaaaaaaa-0000-4000-8000-000000000001$/);

  // Tweede keer: toch bewaren als nieuw recept.
  const voor = (await nietConcept()).length;
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Tekst plakken/ }).click();
  await page.getByLabel("Tekst van het recept").fill(tekst);
  await page.getByRole("button", { name: "Recept eruit halen" }).click();
  await venster.getByRole("button", { name: "Toch bewaren" }).click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/recepten\/[0-9a-f-]{36}$/);
  await expect.poll(async () => (await nietConcept()).length).toBe(voor + 1);
  void extern;
});

test("link die niet lukt: uitleg met alternatieven, de link blijft bewaard als bron", async ({
  page,
  extern,
}) => {
  const voor = (await recepten()).length;
  await page.goto("/recepten/nieuw");
  const url = "https://voorbeeld.be/recept/bestaat-niet";
  await page.getByLabel("Link naar het recept").fill(url);
  await page.getByRole("button", { name: "Inlezen" }).click();
  const fout = page.getByTestId("import-fout");
  await expect(fout).toContainText("Deze link konden we niet inlezen", { timeout: 30_000 });
  await expect(fout.getByRole("button", { name: "Plak de tekst" })).toBeVisible();
  await expect(fout.getByRole("button", { name: "Neem een foto" })).toBeVisible();
  // De link blijft staan.
  await expect(page.getByLabel("Link naar het recept")).toHaveValue(url);
  await fout.getByRole("button", { name: "Typ het zelf" }).click();
  await expect(page.getByRole("button", { name: /Zelf typen/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Naam van het gerecht")).toBeFocused();
  expect((await recepten()).length).toBe(voor);
  void extern;
});

test("delen: 'Link kopiëren' zet de receptlink op het klembord, privé is duidelijk", async ({
  page,
  context,
  extern,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/recepten/aaaaaaaa-0000-4000-8000-000000000002");
  await page.getByRole("button", { name: "Delen" }).first().click();
  const venster = page.getByRole("dialog", { name: "Recept delen" });
  await expect(venster.getByTestId("deel-status")).toContainText("Privé");
  await venster.getByRole("button", { name: "Link kopiëren" }).click();
  await expect(page.getByText("Link gekopieerd")).toBeVisible();
  const klembord = await page.evaluate(() => navigator.clipboard.readText());
  expect(klembord).toMatch(/\/recepten\/aaaaaaaa-0000-4000-8000-000000000002$/);

  // Als tekst delen (zonder Web Share in deze browser): het recept als tekst op het klembord.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await venster.getByRole("button", { name: "Als tekst delen" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Romige pompoensoep\n\nIngrediënten\n- 1 kg pompoen");
  void extern;
});

test("delen naar de app: een gedeelde video-link landt bij 'Video-link', tekst bij 'Tekst plakken'", async ({
  page,
  extern,
}) => {
  const voor = (await recepten()).length;
  await page.goto(
    `/recepten/nieuw?title=${encodeURIComponent("Chocomousse")}&text=${encodeURIComponent("Zo makkelijk! https://youtu.be/abc123?si=x")}`,
  );
  await expect(page.getByRole("button", { name: /Video-link/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Link naar de video")).toHaveValue("https://youtu.be/abc123?si=x");
  await expect(page.getByLabel(/Tekst onder de video/)).toHaveValue(/Chocomousse/);

  await page.goto(
    `/recepten/nieuw?text=${encodeURIComponent("Pannenkoeken\n250 g bloem\n2 eieren")}`,
  );
  await expect(page.getByRole("button", { name: /Tekst plakken/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Tekst van het recept")).toHaveValue(/250 g bloem/);
  await page.waitForTimeout(1600);
  expect((await recepten()).length).toBe(voor);
  void extern;
});
