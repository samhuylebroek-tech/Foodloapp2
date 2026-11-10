/**
 * C1 — boodschappen als kernproduct: B1 lijst eerst, B2 snel toevoegen, B3 waarom op mijn
 * lijst, B4 winkelvolgorde. Eigen nep-dataset: Pasta vandaag (4 pers.), Soep morgen,
 * Foodlo-regels daarvoor, een eigen regel melk en aankoopgeschiedenis (koffie 3×, brood 2×).
 */
import type { Page } from "@playwright/test";
import { expect, meldAan, nepDb, resetNep, seedDb, test } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";
const PASTA = "aaaa0000-0000-4000-8000-000000000011";
const SOEP = "aaaa0000-0000-4000-8000-000000000012";
const JAN = "33333333-3333-4333-8333-333333333333";

const dag = (plus: number) => {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  return d.toLocaleDateString("sv-SE");
};
const recept = (id: string, title: string, servings: number) => ({
  id,
  user_id: IK,
  title,
  servings,
  is_concept: false,
  tags: [],
  category: "hoofdgerecht",
  instructions: ["Koken."],
  deleted_at: null,
});
const ing = (recipe_id: string, name: string, quantity: number, unit: string, position = 0) => ({
  id: crypto.randomUUID(),
  recipe_id,
  name,
  quantity,
  unit,
  position,
});
const regel = (name: string, quantity: number | null, unit: string, recipe_id: string | null) => ({
  id: crypto.randomUUID(),
  user_id: IK,
  list_id: LIJST,
  name,
  quantity,
  unit,
  checked: false,
  recipe_id,
});
const gekocht = (name: string, dagenGeleden: number) => ({
  id: crypto.randomUUID(),
  user_id: IK,
  name,
  quantity: 1,
  unit: "",
  recipe_id: null,
  gekocht_op: new Date(Date.now() - dagenGeleden * 86400000).toISOString(),
});

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetNep();
  await seedDb({
    recipes: [recept(PASTA, "Pasta", 4), recept(SOEP, "Soep", 2)],
    recipe_ingredients: [
      ing(PASTA, "tomaten", 4, "", 0),
      ing(PASTA, "melk", 2, "dl", 1),
      ing(SOEP, "melk", 30, "cl", 0),
      ing(SOEP, "pompoen", 1, "", 1),
    ],
    meal_plan: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        recipe_id: PASTA,
        plan_date: dag(0),
        meal_type: "avondeten",
        personen: null,
        group_id: null,
      },
      {
        id: crypto.randomUUID(),
        user_id: IK,
        recipe_id: SOEP,
        plan_date: dag(1),
        meal_type: "avondeten",
        personen: null,
        group_id: null,
      },
    ],
    pantry_items: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        naam: "melk",
        hoeveelheid: 1,
        eenheid: "dl",
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-01T10:00:00Z",
      },
    ],
    shopping_lists: [
      { id: LIJST, user_id: IK, name: "Boodschappen", created_at: "2026-11-01T10:00:00Z" },
    ],
    shopping_items: [
      regel("tomaten", 4, "", PASTA),
      regel("melk", 4, "dl", PASTA),
      regel("pompoen", 1, "", SOEP),
      regel("melk", 1, "l", null),
      regel("wc-papier", 1, "", null),
      regel("appelsap", 1, "l", null),
      { ...regel("chocomelk", 1, "l", null), user_id: JAN },
    ],
    profiles: [{ id: JAN, display_name: "Jan" }],
    shopping_history: [
      gekocht("koffie", 20),
      gekocht("koffie", 13),
      gekocht("koffie", 6),
      gekocht("brood", 9),
      gekocht("brood", 4),
    ],
  });
  await meldAan(page);
});

async function lijstOpen(page: Page) {
  await page.goto("/boodschappen");
  await expect(page.getByRole("heading", { level: 1, name: "Boodschappen" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "tomaten als gekocht aanvinken" })).toBeVisible();
}

test("B1: de lijst staat bovenaan — eerste boodschap zichtbaar zonder scrollen", async ({
  page,
  extern,
}, info) => {
  await lijstOpen(page);
  const hoogte = page.viewportSize()!.height;
  const eerste = page.locator("main section[aria-label] [role=checkbox]").first();
  const b = await eerste.boundingBox();
  expect(b, "eerste boodschap").not.toBeNull();
  // Telefoon: boven de vaste invoerbalk (± 180 px onderaan); groter: gewoon in beeld.
  const grens = info.project.name.startsWith("mobiel") ? hoogte - 180 : hoogte;
  expect(b!.y + b!.height, "eerste boodschap boven de vouw").toBeLessThan(grens);
  // Winkelen staat in de kop, niet als grote balk.
  await expect(page.getByRole("button", { name: "Ik ga winkelen" })).toBeVisible();
  // Geen tabs meer: "Toevoegen uit je weekmenu" is een manier om iets toe te voegen.
  await expect(page.getByRole("tab", { name: "Uit gerechten" })).toHaveCount(0);
  await page.getByRole("button", { name: /Je weekmenu/ }).click();
  await expect(page.getByText("Gerechten uit je weekmenu")).toBeVisible();
  await page.getByRole("button", { name: "Terug naar je lijst" }).click();
  await expect(page.getByRole("checkbox", { name: "tomaten als gekocht aanvinken" })).toBeVisible();
  void extern;
});

test("B2: leeg invoerveld aanraken toont 'vaak gekocht'; één tik zet het op de lijst", async ({
  page,
  extern,
}) => {
  await lijstOpen(page);
  await page.getByRole("textbox", { name: "Iets toevoegen" }).click();
  const vaak = page.getByRole("region", { name: "Iets toevoegen" }).getByLabel("Vaak gekocht");
  await expect(vaak.getByRole("button", { name: /koffie/ })).toBeVisible();
  await vaak.getByRole("button", { name: /koffie/ }).click();
  await expect
    .poll(async () => ((await nepDb()).shopping_items ?? []).some((i) => i["name"] === "koffie"))
    .toBe(true);
  void extern;
});

test("B3: 'waarom op mijn lijst?' toont gerechten met dag en hoeveelheid, voorraad en je eigen regel", async ({
  page,
  extern,
}) => {
  await lijstOpen(page);
  await page.getByRole("button", { name: "Waarom staat melk op je lijst? Voor Pasta" }).click();
  const paneel = page.getByRole("dialog", { name: "Waarom staat melk op je lijst?" });
  await expect(paneel).toBeVisible();
  await expect(paneel.getByText("Pasta", { exact: true })).toBeVisible();
  await expect(paneel.getByText("Soep", { exact: true })).toBeVisible();
  await expect(paneel.getByText("vandaag", { exact: true })).toBeVisible();
  await expect(paneel.getByText("morgen", { exact: true })).toBeVisible();
  await expect(paneel.getByText(/Samen:/)).toBeVisible();
  await expect(paneel.getByText("Al in huis")).toBeVisible();
  await expect(paneel.getByText(/zelf toegevoegd/)).toBeVisible();
  // Alleen lezen: de lijst is niet veranderd.
  expect(((await nepDb()).shopping_items ?? []).length).toBe(7);
  await page.keyboard.press("Escape");
  await expect(paneel).toBeHidden();
  void extern;
});

test("B4: winkelvolgorde aanpassen — lijst en winkelmodus volgen, blijft na herladen", async ({
  page,
  extern,
}) => {
  await lijstOpen(page);
  await page.getByRole("button", { name: "Meer opties voor deze lijst" }).click();
  await page.getByRole("button", { name: "Volgorde van je winkel" }).click();
  const paneel = page.getByRole("dialog", { name: "Volgorde van je winkel" });
  const hoger = paneel.getByRole("button", { name: "Dranken hoger" });
  for (let i = 0; i < 8 && (await hoger.isEnabled()); i++) await hoger.click();
  await expect(hoger).toBeDisabled(); // Dranken staat nu eerst
  await paneel.getByRole("button", { name: "Klaar" }).click();
  await expect(paneel).toBeHidden();

  const eersteAfdeling = () =>
    page
      .locator("main section[aria-label]")
      .filter({ has: page.getByRole("button", { name: /^Alles in .* afvinken$/ }) })
      .first();
  await expect(eersteAfdeling()).toHaveAttribute("aria-label", "Dranken");
  await page.reload();
  await expect(eersteAfdeling()).toHaveAttribute("aria-label", "Dranken");

  await page.getByRole("button", { name: "Ik ga winkelen" }).click();
  const winkel = page.getByRole("dialog", { name: "Winkelmodus" });
  await expect(winkel.locator('[aria-label="Afdelingen"] button').first()).toContainText("Dranken");
  void extern;
});

test("B6: productcatalogus — tegel toevoegen, nog eens tikken haalt weg, ongedaan maken zet terug", async ({
  page,
  extern,
}) => {
  await lijstOpen(page);
  await page.getByRole("button", { name: "Producten kiezen" }).first().click();
  const blad = page.getByRole("dialog", { name: "Producten kiezen" });
  await expect(blad).toBeVisible();
  // Wat al op de lijst staat, is aangeduid.
  await expect(blad.getByRole("button", { name: /^tomaten: staat op je lijst/ })).toBeVisible();
  await blad.getByRole("button", { name: "bananen toevoegen" }).click();
  await expect
    .poll(async () => ((await nepDb()).shopping_items ?? []).some((i) => i["name"] === "bananen"))
    .toBe(true);
  await expect(blad.getByRole("button", { name: /^bananen: staat op je lijst/ })).toBeVisible();
  await blad.getByRole("button", { name: /^bananen: staat op je lijst/ }).click();
  await expect
    .poll(async () => ((await nepDb()).shopping_items ?? []).some((i) => i["name"] === "bananen"))
    .toBe(false);
  await page.waitForTimeout(600);
  // Meldingen schuiven even bij het verschijnen (en de stapel klapt open onder de muis).
  // De bovenste melding (de laatste actie), ook terwijl het onderblad open is.
  await page
    .locator('[data-sonner-toast][data-front="true"]')
    .getByRole("button", { name: "Ongedaan maken", exact: true })
    .click();
  await expect
    .poll(async () => ((await nepDb()).shopping_items ?? []).some((i) => i["name"] === "bananen"))
    .toBe(true);
  // Zoeken in de catalogus.
  await blad.getByLabel("Zoek in de producten").fill("koff");
  await expect(blad.getByRole("button", { name: /^koffie/ }).first()).toBeVisible();
  await expect(blad.getByRole("button", { name: "melk toevoegen" })).toHaveCount(0);
  void extern;
});

test("B6: bananen komen in Groenten & fruit terecht (afdelingsindeling met meervouden)", async ({
  page,
  extern,
}) => {
  await lijstOpen(page);
  await page.getByRole("textbox", { name: "Iets toevoegen" }).fill("bananen");
  await page.getByRole("textbox", { name: "Iets toevoegen" }).press("Enter");
  const groenten = page.locator("main section[aria-label='Groenten & fruit']");
  await expect(groenten.getByText("bananen", { exact: true })).toBeVisible();
  void extern;
});

test("B5: wat een ander toevoegde, toont wie het was", async ({ page, extern }) => {
  await lijstOpen(page);
  await expect(page.getByText("toegevoegd door Jan")).toBeVisible();
  // Eigen boodschappen tonen geen naam.
  await expect(page.getByText(/toegevoegd door/)).toHaveCount(1);
  void extern;
});
