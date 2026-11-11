/**
 * Kleine UX-verbeteringen uit de persona-audit: zoeken met tikfout (BUG-100), negatieve
 * hoeveelheid in de voorraad (BUG-101), zichtbare knop "Aanpassen" (BUG-102), eerlijke foutmelding
 * bij een mislukte aanpassing op de lijst (BUG-037). Demo-data.
 */
import {
  expect,
  heeftHorizontaleScroll,
  meldAan,
  nepDb,
  resetDemo,
  storing,
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

const IK = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";

test("BUG-037: mislukt het ophogen van een bestaand item, dan zegt de app dat", async ({
  page,
  extern,
}) => {
  await page.goto("/boodschappen");
  await expect(page.getByText("melk", { exact: true }).first()).toBeVisible();
  // "melk" staat al op de lijst: dit wordt een aanpassing (PATCH), geen nieuwe regel.
  await storing({ pad: "/rest/v1/shopping_items", soort: "fout", methode: "PATCH", keer: 1 });
  await page.getByRole("textbox", { name: "Iets toevoegen" }).fill("1 l melk");
  await page.getByRole("textbox", { name: "Iets toevoegen" }).press("Enter");
  await expect(page.getByText(/lukte niet om dit toe te voegen/)).toBeVisible();
  const melk = ((await nepDb())["shopping_items"] ?? []).filter((i) => i["name"] === "melk");
  expect(melk).toHaveLength(1);
  void extern;
});

test("BUG-037: offline wachtrij meldt niet 'bewaard' als het bewaren mislukt", async ({
  page,
  extern,
}) => {
  await page.addInitScript(
    ([ik, lijst]) => {
      if (sessionStorage.getItem("wachtrij-gezet")) return;
      sessionStorage.setItem("wachtrij-gezet", "1");
      localStorage.setItem(
        "foodlo-boodschappen-wachtrij",
        JSON.stringify([{ soort: "toevoegen", userId: ik, listId: lijst, tekst: "2 bananen" }]),
      );
    },
    [IK, LIJST],
  );
  await storing({ pad: "/rest/v1/shopping_items", soort: "fout", methode: "POST", keer: 1 });
  await page.goto("/boodschappen");
  await expect(page.getByText(/nog niet bewaard/)).toBeVisible();
  await expect(page.getByText("Je wijzigingen zijn bewaard")).toHaveCount(0);
  const rij = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("foodlo-boodschappen-wachtrij") ?? "[]"),
  );
  expect(rij).toEqual([expect.objectContaining({ tekst: "2 bananen", pogingen: 1 })]);
  void extern;
});
