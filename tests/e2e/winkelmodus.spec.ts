/**
 * WP5 — winkelmodus: overslaan en vervangen, en eigen boodschappen beschermd.
 * Dataset (nep-Supabase): Stoemp vandaag (spinazie 300 g, aardappelen 1 kg), een lijst die
 * daarmee klopt, en twee regels die de gebruiker zelf toevoegde (koffie, melk 2 dl).
 */
import type { Page } from "@playwright/test";
import { expect, meldAan, nepDb, resetNep, seedDb, storing, test, zetKlok } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";
const STOEMP = "cccc0000-0000-4000-8000-000000000001";
const SPINAZIE = "dddd0000-0000-4000-8000-000000000001";

const vandaag = () => new Date().toLocaleDateString("sv-SE");
const item = (
  name: string,
  quantity: number | null,
  unit: string,
  recipe_id: string | null,
  id: string = crypto.randomUUID(),
) => ({ id, user_id: IK, list_id: LIJST, name, quantity, unit, checked: false, recipe_id });

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetNep();
  await seedDb({
    recipes: [
      {
        id: STOEMP,
        user_id: IK,
        title: "Stoemp",
        servings: 4,
        is_concept: false,
        tags: [],
        category: "hoofdgerecht",
        instructions: ["Kook de aardappelen.", "Stamp met de spinazie."],
        deleted_at: null,
      },
    ],
    recipe_ingredients: [
      {
        id: crypto.randomUUID(),
        recipe_id: STOEMP,
        name: "spinazie",
        quantity: 300,
        unit: "g",
        position: 0,
      },
      {
        id: crypto.randomUUID(),
        recipe_id: STOEMP,
        name: "aardappelen",
        quantity: 1,
        unit: "kg",
        position: 1,
      },
    ],
    meal_plan: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        recipe_id: STOEMP,
        plan_date: vandaag(),
        meal_type: "avondeten",
        personen: null,
        group_id: null,
      },
    ],
    shopping_lists: [
      { id: LIJST, user_id: IK, name: "Boodschappen", created_at: "2026-11-01T10:00:00Z" },
    ],
    shopping_items: [
      item("spinazie", 300, "g", STOEMP, SPINAZIE),
      item("aardappelen", 1, "kg", STOEMP),
      item("koffie", 1, "", null),
      item("melk", 2, "dl", null),
    ],
  });
  await zetKlok(page, 14);
  await meldAan(page);
});

type Rij = Record<string, unknown>;
const regels = async () => ((await nepDb()).shopping_items ?? []) as Rij[];
const regel = async (id: string) => (await regels()).find((r) => r["id"] === id);
const voorraad = async () => ((await nepDb()).pantry_items ?? []).map((p) => p["naam"]);

async function naarWinkel(page: Page) {
  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "Ik ga boodschappen doen" }).click();
  const winkel = page.getByRole("dialog", { name: "Winkelmodus" });
  await expect(winkel).toBeVisible();
  return winkel;
}

/** Knop "<naam> niet gevonden", in welke afdeling het product ook ligt. */
async function nietGevonden(page: Page, naam: string) {
  const winkel = page.getByRole("dialog", { name: "Winkelmodus" });
  const knop = winkel.getByRole("button", { name: `${naam} niet gevonden` });
  await expect(async () => {
    if (!(await knop.isVisible())) {
      const n = await winkel.locator('[aria-label="Afdelingen"] button').count();
      for (let i = 0; i < n && !(await knop.isVisible()); i++)
        await winkel.locator('[aria-label="Afdelingen"] button').nth(i).click();
    }
    await expect(knop).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await knop.click();
}

/** "Niet gevonden" → Overslaan, en wachten tot het paneel weer dicht is. */
async function overslaan(page: Page, naam: string) {
  await nietGevonden(page, naam);
  const paneel = page.getByRole("dialog", { name: `${naam} niet gevonden?` });
  await paneel.getByRole("button", { name: /Overslaan/ }).click();
  await expect(paneel).toBeHidden();
}

/** Vink alles af wat nog te halen is in de winkelmodus (afdeling per afdeling). */
async function vinkRestAf(page: Page) {
  const winkel = page.getByRole("dialog", { name: "Winkelmodus" });
  const knop = winkel.getByRole("button", { name: /— tik om af te vinken$/ });
  await expect(async () => {
    if ((await knop.count()) > 0) await knop.first().click();
    await expect(knop).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
}

test("vervangen: hoeveelheid en gerecht blijven, ongedaan maken zet het exact terug", async ({
  page,
  extern,
}) => {
  const winkel = await naarWinkel(page);
  await nietGevonden(page, "spinazie");
  const paneel = page.getByRole("dialog", { name: "spinazie niet gevonden?" });
  await expect(paneel).toBeVisible();
  await expect(paneel.getByText("Voor Stoemp.")).toBeVisible();
  // Hoeveelheid staat al ingevuld; alleen het product kiezen.
  await expect(paneel.getByLabel("Hoeveel")).toHaveValue("300");
  await expect(paneel.getByLabel("Eenheid")).toHaveValue("g");
  await paneel.getByLabel("Of vervangen door").fill("Diepvriesspinazie");
  await paneel.getByRole("button", { name: "Vervangen en in mijn kar" }).click();
  await expect(paneel).toBeHidden();

  await expect
    .poll(() => regel(SPINAZIE))
    .toMatchObject({
      name: "Diepvriesspinazie (i.p.v. spinazie)",
      quantity: 300,
      unit: "g",
      recipe_id: STOEMP,
      checked: true,
    });
  // Geen tweede spinazie-regel.
  expect((await regels()).filter((r) => /spinazie/i.test(String(r["name"])))).toHaveLength(1);

  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect
    .poll(() => regel(SPINAZIE))
    .toMatchObject({
      name: "spinazie",
      quantity: 300,
      unit: "g",
      recipe_id: STOEMP,
      checked: false,
    });
  void extern;
});

test("na het winkelen telt het vervangen product voor de maaltijd: Vandaag zegt 'alles in huis'", async ({
  page,
  extern,
}) => {
  const winkel = await naarWinkel(page);
  await nietGevonden(page, "spinazie");
  const paneel = page.getByRole("dialog", { name: "spinazie niet gevonden?" });
  await paneel.getByLabel("Of vervangen door").fill("Diepvriesspinazie");
  await paneel.getByLabel("Hoeveel").fill("1");
  await paneel.getByLabel("Eenheid").fill("zak");
  await paneel.getByRole("button", { name: "Vervangen en in mijn kar" }).click();
  await expect(paneel).toBeHidden();
  // Koffie niet gevonden: overslaan. Blijft op de lijst.
  await overslaan(page, "koffie");
  await vinkRestAf(page);
  await expect(winkel.getByRole("heading", { name: "Niet gevonden · 1" })).toBeVisible();
  await winkel.getByRole("button", { name: "Klaar met winkelen" }).click();

  await expect
    .poll(voorraad)
    .toEqual(
      expect.arrayContaining(["Diepvriesspinazie (i.p.v. spinazie)", "aardappelen", "melk"]),
    );
  // Overgeslagen koffie blijft open op de lijst, de rest is opgeruimd.
  await expect
    .poll(async () => (await regels()).map((r) => `${r["name"]}:${r["checked"]}`))
    .toEqual(["koffie:false"]);

  await page.goto("/");
  await expect(page.locator("[data-nu]")).toHaveAttribute("data-nu", "koken");
  void extern;
});

test("vervangen mislukt bij opslaan: melding, lijst onveranderd, opnieuw lukt", async ({
  page,
  extern,
}) => {
  const winkel = await naarWinkel(page);
  await nietGevonden(page, "spinazie");
  const paneel = page.getByRole("dialog", { name: "spinazie niet gevonden?" });
  await paneel.getByLabel("Of vervangen door").fill("Diepvriesspinazie");
  await storing({
    pad: "/rest/v1/shopping_items",
    methode: "PATCH",
    soort: "fout",
    status: 503,
    keer: 1,
  });
  await paneel.getByRole("button", { name: "Vervangen en in mijn kar" }).click();
  await expect(
    page.getByText("Vervangen lukte niet. Je lijst blijft zoals hij was."),
  ).toBeVisible();
  await expect(paneel).toBeVisible(); // invoer blijft staan
  expect(await regel(SPINAZIE)).toMatchObject({ name: "spinazie", checked: false });

  await paneel.getByRole("button", { name: "Vervangen en in mijn kar" }).click();
  await expect(paneel).toBeHidden();
  await expect
    .poll(() => regel(SPINAZIE))
    .toMatchObject({ name: "Diepvriesspinazie (i.p.v. spinazie)" });
  void extern;
});

test("overslaan blijft bewaard na herladen; 'Toch gevonden' zet het terug", async ({
  page,
  extern,
}) => {
  let winkel = await naarWinkel(page);
  await expect(winkel.getByTestId("te-halen")).toHaveText("4");
  await overslaan(page, "koffie");
  await expect(winkel.getByTestId("te-halen")).toHaveText("3");
  expect((await regels()).find((r) => r["name"] === "koffie")).toMatchObject({ checked: false });

  await page.reload();
  winkel = await naarWinkel(page);
  await expect(winkel.getByTestId("te-halen")).toHaveText("3");
  await vinkRestAf(page);
  await winkel.getByRole("button", { name: "koffie toch gevonden" }).click();
  await expect(winkel.getByTestId("te-halen")).toHaveText("1");
  await expect(winkel.getByRole("button", { name: /koffie.*tik om af te vinken/ })).toBeVisible();
  void extern;
});

test("eigen boodschap verwijderen en terugzetten: alles blijft gelijk, ook bij een Foodlo-regel", async ({
  page,
  extern,
}) => {
  await page.goto("/boodschappen");
  for (const naam of ["melk", "spinazie"]) {
    await page.getByRole("button", { name: `${naam} aanpassen` }).click();
    await page.getByRole("button", { name: "Verwijderen" }).click();
    await expect.poll(async () => (await regels()).some((r) => r["name"] === naam)).toBe(false);
    await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
    await expect
      .poll(async () => (await regels()).find((r) => r["name"] === naam))
      .toMatchObject(
        naam === "melk"
          ? { quantity: 2, unit: "dl", recipe_id: null, checked: false }
          : { quantity: 300, unit: "g", recipe_id: STOEMP, checked: false },
      );
  }
  void extern;
});

test("op een smal scherm is elke afdeling bereikbaar (rij scrolt)", async ({ page, extern }) => {
  const winkel = await naarWinkel(page);
  const chips = winkel.locator('[aria-label="Afdelingen"] button');
  await expect(chips).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await chips.nth(i).click();
    await expect(chips.nth(i)).toHaveAttribute("aria-current", "step");
  }
  await expect(winkel).toBeVisible();
  void extern;
});
