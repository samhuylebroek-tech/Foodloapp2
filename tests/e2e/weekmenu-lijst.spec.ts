/**
 * WP4 — weekmenu gewijzigd → boodschappenlijst bijgestuurd.
 * Eigen, kleine dataset (nep-Supabase): Pasta vandaag, Lasagne morgen, een lijst die daarmee
 * klopt, en één regel die de gebruiker zelf toevoegde (koffie).
 */
import type { Page } from "@playwright/test";
import { expect, meldAan, nepDb, resetNep, seedDb, storing, test } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";
const PASTA = "aaaa0000-0000-4000-8000-000000000001";
const LASAGNE = "aaaa0000-0000-4000-8000-000000000002";
const SOEP = "aaaa0000-0000-4000-8000-000000000003";
const PLAN_PASTA = "bbbb0000-0000-4000-8000-000000000001";

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
const ing = (
  recipe_id: string,
  name: string,
  quantity: number,
  unit: string,
  position: number,
) => ({
  id: crypto.randomUUID(),
  recipe_id,
  name,
  quantity,
  unit,
  position,
});
const item = (name: string, quantity: number | null, unit: string, recipe_id: string | null) => ({
  id: crypto.randomUUID(),
  user_id: IK,
  list_id: LIJST,
  name,
  quantity,
  unit,
  checked: false,
  recipe_id,
});

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetNep();
  await seedDb({
    recipes: [recept(PASTA, "Pasta", 4), recept(LASAGNE, "Lasagne", 4), recept(SOEP, "Soep", 2)],
    recipe_ingredients: [
      ing(PASTA, "spaghetti", 400, "g", 0),
      ing(PASTA, "tomaten", 4, "", 1),
      ing(LASAGNE, "gehakt", 500, "g", 0),
      ing(LASAGNE, "tomaten", 2, "", 1),
      ing(LASAGNE, "melk", 5, "dl", 2),
      ing(SOEP, "pompoen", 1, "", 0),
      ing(SOEP, "melk", 20, "cl", 1),
    ],
    meal_plan: [
      {
        id: PLAN_PASTA,
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
        recipe_id: LASAGNE,
        plan_date: dag(1),
        meal_type: "avondeten",
        personen: null,
        group_id: null,
      },
    ],
    shopping_lists: [
      { id: LIJST, user_id: IK, name: "Boodschappen", created_at: "2026-11-01T10:00:00Z" },
    ],
    shopping_items: [
      item("koffie", 1, "", null),
      item("spaghetti", 400, "g", PASTA),
      item("tomaten", 6, "", PASTA),
      item("gehakt", 500, "g", LASAGNE),
      item("melk", 5, "dl", LASAGNE),
    ],
  });
  await meldAan(page);
});

type Regel = { name: string; quantity: number | null; unit: string; recipe_id: string | null };
/** De lijst per productnaam (alleen de inhoud). Faalt bij een dubbele regel. */
async function lijst(): Promise<Record<string, Regel>> {
  const items = ((await nepDb()).shopping_items ?? []) as unknown as Regel[];
  const uit: Record<string, Regel> = {};
  for (const i of items) {
    expect(uit[i.name], `geen dubbele regel voor ${i.name}`).toBeUndefined();
    uit[i.name] = { name: i.name, quantity: i.quantity, unit: i.unit, recipe_id: i.recipe_id };
  }
  return uit;
}
const namen = async () => Object.keys(await lijst()).sort();
const plannen = async () =>
  ((await nepDb()).meal_plan ?? []).map((p) => `${p["plan_date"]}:${p["recipe_id"]}`).sort();

/** Weekmenu openen en wachten tot het scherm echt bruikbaar is (eerste keer compileren is traag). */
async function weekmenu(page: Page) {
  await page.goto("/planner");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible({ timeout: 60_000 });
}

async function openActies(page: Page, gerecht: string, menu: string) {
  await expect(async () => {
    if (!(await page.getByRole("menu").isVisible()))
      await page
        .getByRole("button", { name: `Acties voor ${gerecht}` })
        .first()
        .click();
    await expect(page.getByRole("menuitem", { name: menu })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("menuitem", { name: menu }).click();
}

async function actie(page: Page, gerecht: string, menu: string) {
  await weekmenu(page);
  await openActies(page, gerecht, menu);
}

test("gerecht weg: wat niemand meer nodig heeft eraf, gedeeld product kleiner, eigen regel blijft; ongedaan maken zet alles terug", async ({
  page,
  extern,
}) => {
  const voorLijst = await lijst();
  const voorPlan = await plannen();
  await actie(page, "Pasta", "Uit planning halen");
  await expect(page.getByText("Pasta uit je weekmenu · lijst: 1 minder, 1 eraf")).toBeVisible();
  await expect.poll(namen).toEqual(["gehakt", "koffie", "melk", "tomaten"]);
  const na = await lijst();
  expect(na["tomaten"]).toMatchObject({ quantity: 2, recipe_id: LASAGNE });
  expect(na["koffie"]).toEqual(voorLijst["koffie"]);

  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(page.getByText("Teruggezet")).toBeVisible();
  await expect.poll(plannen).toEqual(voorPlan);
  expect(await lijst()).toEqual(voorLijst);
  void extern;
});

test("ander gerecht (vervangen): oude producten eraf, gedeelde aangepast, nieuwe erbij — en terug", async ({
  page,
  extern,
}) => {
  const voorLijst = await lijst();
  await actie(page, "Pasta", "Ander gerecht");
  const sheet = page.getByRole("dialog", { name: "Ander gerecht" });
  await sheet.getByRole("button", { name: /Soep/ }).click();
  await expect(page.getByText(/Soep in plaats van Pasta · lijst: /)).toBeVisible();
  await expect.poll(namen).toEqual(["gehakt", "koffie", "melk", "pompoen", "tomaten"]);
  const na = await lijst();
  expect(na["melk"]).toMatchObject({ quantity: 7, unit: "dl" }); // 5 dl + 20 cl, één regel
  expect(na["tomaten"]).toMatchObject({ quantity: 2 });
  expect(na["pompoen"]).toMatchObject({ quantity: 1, recipe_id: SOEP });
  expect(await plannen()).toContain(`${dag(0)}:${SOEP}`);

  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(page.getByText("Teruggezet")).toBeVisible();
  await expect.poll(lijst).toEqual(voorLijst);
  expect(await plannen()).toContain(`${dag(0)}:${PASTA}`);
  void extern;
});

test("volgende week opnieuw: buiten de komende 7 dagen, dus de lijst blijft gelijk (geen dubbels)", async ({
  page,
  extern,
}) => {
  const voorLijst = await lijst();
  await actie(page, "Pasta", "Volgende week opnieuw");
  await expect(page.getByText(/Ook ingepland op/)).toBeVisible();
  await expect.poll(async () => (await plannen()).length).toBe(3);
  expect(await lijst()).toEqual(voorLijst);
  void extern;
});

test("fout bij opslaan van de lijst: het gerecht blijft staan en de lijst is onveranderd", async ({
  page,
  extern,
}) => {
  const voorLijst = await lijst();
  const voorPlan = await plannen();
  await weekmenu(page);
  await storing({ pad: "/rest/v1/shopping_items", methode: "DELETE", soort: "fout", keer: 5 });
  await openActies(page, "Pasta", "Uit planning halen");
  await expect(page.getByText(/Er is niets veranderd/)).toBeVisible();
  expect(await plannen()).toEqual(voorPlan);
  expect(await lijst()).toEqual(voorLijst);
  void extern;
});

test("fout bij toevoegen: geen half ingepland gerecht, lijst onveranderd", async ({
  page,
  extern,
}) => {
  const voorLijst = await lijst();
  const voorPlan = await plannen();
  await weekmenu(page);
  await storing({ pad: "/rest/v1/shopping_items", methode: "POST", soort: "fout", keer: 5 });
  await page.getByRole("button", { name: "Gerecht toevoegen" }).last().click();
  await page.getByRole("button", { name: /Verder naar maaltijd/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Soep/ }).click();
  await expect(page.getByText(/Er is niets veranderd/)).toBeVisible();
  expect(await plannen()).toEqual(voorPlan);
  // De melk-regel werd eerst bijgewerkt en daarna teruggezet.
  expect(await lijst()).toEqual(voorLijst);
  void extern;
});

test("twee vensters plannen tegelijk hetzelfde soort gerecht: één regel per product, juiste totalen", async ({
  page,
  browser,
  extern,
}) => {
  const ander = await browser.newPage();
  await meldAan(ander);
  for (const p of [page, ander]) {
    await weekmenu(p);
    await p.getByRole("button", { name: "Gerecht toevoegen" }).last().click();
    await p.getByRole("button", { name: /Verder naar maaltijd/ }).click();
    await expect(p.getByRole("dialog").getByRole("button", { name: /Soep/ })).toBeVisible();
  }
  // Lezen van de lijst traag maken, zodat beide vensters rekenen vóór het andere schrijft.
  await storing({
    pad: "/rest/v1/shopping_items",
    methode: "GET",
    soort: "traag",
    ms: 900,
    keer: 40,
  });
  await Promise.all(
    [page, ander].map((p) => p.getByRole("dialog").getByRole("button", { name: /Soep/ }).click()),
  );
  await expect(page.getByText(/Soep staat op/)).toBeVisible({ timeout: 30_000 });
  await expect(ander.getByText(/Soep staat op/)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => ((await nepDb()).meal_plan ?? []).filter((m) => m["recipe_id"] === SOEP).length,
    )
    .toBe(2);
  // Verwachting uit de opgeslagen porties (de kiezer gebruikt het aantal personen van het
  // huishouden): Soep is voor 2, dus personen/2 per maaltijd.
  const factor = ((await nepDb()).meal_plan ?? [])
    .filter((m) => m["recipe_id"] === SOEP)
    .reduce((n, m) => n + ((m["personen"] as number | null) ?? 2) / 2, 0);
  // lijst() faalt bij een dubbele regel.
  await expect
    .poll(async () => (await lijst())["pompoen"]?.quantity, { timeout: 15_000 })
    .toBe(factor);
  const na = await lijst();
  expect(na["melk"]).toMatchObject({ quantity: 5 + 2 * factor, unit: "dl" }); // 5 dl + factor × 20 cl
  await ander.close();
  void extern;
});
