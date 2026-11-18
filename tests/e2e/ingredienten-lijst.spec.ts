/**
 * P2 — Ingrediënten & slimme lijst (één kostenbron).
 * Eigen dataset (nep-Supabase): Pasta en Pompoensoep gepland, 1 pompoen in de voorraad.
 */
import type { Page } from "@playwright/test";
import { expect, meldAan, nepDb, resetNep, seedDb, test } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";
const PASTA = "aaaa0000-0000-4000-8000-0000000000a1";
const SOEP = "aaaa0000-0000-4000-8000-0000000000a2";
const STOOF = "aaaa0000-0000-4000-8000-0000000000a3";
const PLAN_SOEP = "bbbb0000-0000-4000-8000-0000000000a2";

const dag = (plus: number) => {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  return d.toLocaleDateString("sv-SE");
};
const maandag = (terug: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * terug);
  return d.toISOString().slice(0, 10);
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
  quantity: number | null,
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
const plan = (id: string, recipe_id: string, plus: number) => ({
  id,
  user_id: IK,
  recipe_id,
  plan_date: dag(plus),
  meal_type: "avondeten",
  personen: 4,
  group_id: null,
});

test.describe.configure({ timeout: 150_000 });

async function seed(extra: Record<string, Record<string, unknown>[]> = {}) {
  await resetNep();
  await seedDb({
    recipes: [
      recept(PASTA, "Pasta", 4),
      recept(SOEP, "Pompoensoep", 4),
      recept(STOOF, "Stoofpot", 4),
    ],
    recipe_ingredients: [
      ing(PASTA, "spaghetti", 350, "g", 0),
      ing(PASTA, "ui", 2, "", 1),
      ing(PASTA, "olijfolie", 2, "el", 2),
      ing(SOEP, "pompoen", 2, "kg", 0),
      ing(SOEP, "ajuin", 1, "stuk", 1),
      ing(SOEP, "slagroom", 20, "cl", 2),
      ing(SOEP, "zout", null, "", 3),
      ing(STOOF, "rundvlees", 800, "g", 0),
      ing(STOOF, "wortel", 500, "g", 1),
    ],
    meal_plan: [plan(crypto.randomUUID(), PASTA, 1), plan(PLAN_SOEP, SOEP, 0)],
    shopping_lists: [
      { id: LIJST, user_id: IK, name: "Boodschappen", created_at: "2026-11-01T10:00:00Z" },
    ],
    shopping_items: [],
    pantry_items: [
      { id: crypto.randomUUID(), user_id: IK, naam: "pompoen", hoeveelheid: 1, eenheid: "" },
    ],
    ...extra,
  });
}

async function aanvullen(page: Page) {
  await page.goto("/aanvullen");
  await expect(page.getByRole("button", { name: /op mijn lijst/ })).toBeVisible({
    timeout: 60_000,
  });
}

type Rij = { name: string; quantity: number | null; unit: string; recipe_id?: string | null };
/** De lijst per productnaam, alleen de inhoud (geen tijdstempels). */
const lijst = async () =>
  Object.fromEntries(
    (((await nepDb()).shopping_items ?? []) as unknown as Rij[]).map((i) => [
      i.name,
      { name: i.name, quantity: i.quantity, unit: i.unit, recipe_id: i.recipe_id ?? null },
    ]),
  );

test("weekmenu → lijst: samengevoegd, te kopen na voorraad, gangbare verpakking en één kost", async ({
  page,
  extern,
}) => {
  await seed();
  await meldAan(page);
  await aanvullen(page);
  // Pompoen: 2 kg nodig, 1 stuk (≈ 1,2 kg) in huis → 0,8 kg te kopen.
  const pompoen = page.getByRole("checkbox", { name: /pompoen/ });
  await expect(pompoen).toContainText("nodig 2 kg, 1,2 kg in huis");
  await expect(page.getByRole("checkbox", { name: /spaghetti/ })).toContainText(
    "Gangbare verpakking: 1 pak 500 g",
  );
  await page.getByRole("button", { name: /op mijn lijst/ }).click();
  await expect.poll(async () => Object.keys(await lijst()).length).toBeGreaterThan(2);
  const l = await lijst();
  // ui (2) + ajuin (1) = één regel van 3; slagroom = room.
  expect(Object.keys(l).filter((n) => /^(ui|ajuin)$/.test(n))).toHaveLength(1);
  expect((l["ui"] ?? l["ajuin"])!.quantity).toBe(3);
  expect(l["pompoen"]).toMatchObject({ quantity: 0.8, unit: "kg" });
  expect(l["zout"]).toBeUndefined();

  await page.goto("/boodschappen");
  await expect(page.getByTestId("lijst-kost")).toContainText("Schatting nog te kopen: €", {
    timeout: 60_000,
  });
  await expect(page.getByTestId("lijst-behoefte").filter({ hasText: "1 pak 500 g" })).toBeVisible();
  await expect(
    page.getByTestId("lijst-behoefte").filter({ hasText: "nodig 2 kg · in huis 1,2 kg" }),
  ).toBeVisible();
  void extern;
});

test("basisvoorraad: olijfolie en zout niet op de lijst maar 'heb je meestal', één tik voegt toe", async ({
  page,
  extern,
}) => {
  await seed({
    planprofiel: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        voorraadniveau: "basis",
        basisvoorraad: ["zout", "olijfolie"],
        apparatuur: null,
        kookervaring: null,
        weekbudget: null,
      },
    ],
  });
  await meldAan(page);
  await aanvullen(page);
  const meestal = page.getByRole("list", { name: "Heb je meestal (basisvoorraad)" });
  await expect(meestal.getByRole("checkbox", { name: "olijfolie" })).toBeVisible();
  await expect(meestal.getByRole("checkbox", { name: "zout" })).toBeVisible();
  await expect(meestal.getByRole("checkbox", { name: "olijfolie" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await meestal.getByRole("checkbox", { name: "olijfolie" }).click();
  await page.getByRole("button", { name: /op mijn lijst/ }).click();
  await expect.poll(async () => Object.keys(await lijst())).toContain("olijfolie");
  expect(Object.keys(await lijst())).not.toContain("zout");
  void extern;
});

test("gerecht vervangen: lijst en kost passen aan, ongedaan maken herstelt", async ({
  page,
  extern,
}) => {
  await seed();
  await meldAan(page);
  await aanvullen(page);
  await page.getByRole("button", { name: /op mijn lijst/ }).click();
  await expect.poll(async () => Object.keys(await lijst())).toContain("pompoen");
  const voor = await lijst();

  await page.goto("/planner");
  const kost = page.getByText(/^Geschatte kost: /).first();
  await expect(kost).toBeVisible({ timeout: 60_000 });
  const kostVoor = await kost.textContent();
  await expect(async () => {
    if (!(await page.getByRole("menu").isVisible()))
      await page.getByRole("button", { name: "Acties voor Pompoensoep" }).first().click();
    await expect(page.getByRole("menuitem", { name: "Ander gerecht" })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("menuitem", { name: "Ander gerecht" }).click();
  await page
    .getByRole("dialog", { name: "Ander gerecht" })
    .getByRole("button", { name: /Stoofpot/ })
    .click();
  await expect(page.getByText(/Stoofpot in plaats van Pompoensoep · lijst: /)).toBeVisible();
  await expect.poll(async () => Object.keys(await lijst())).toContain("rundvlees");
  expect(Object.keys(await lijst())).not.toContain("pompoen");
  await expect(kost).not.toHaveText(kostVoor!);

  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(page.getByText("Teruggezet")).toBeVisible();
  await expect.poll(lijst).toEqual(voor);
  await expect(kost).toHaveText(kostVoor!);
  void extern;
});

test("budgetkaart toont vorige weken (schatting)", async ({ page, extern }) => {
  await seed({
    budget_weken: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        week: maandag(1),
        budget: 120,
        geschat: 131.2,
        niet_geschat: 0,
        maaltijden: 7,
      },
    ],
  });
  await meldAan(page);
  await page.goto("/planner");
  const vorige = page.getByTestId("vorige-weken");
  await expect(vorige).toBeVisible({ timeout: 60_000 });
  await vorige.getByText("Vorige weken").click();
  await expect(vorige).toContainText("131,20");
  await expect(vorige).toContainText("boven budget");
  // De huidige week wordt onthouden (nep-databank kent budget_weken).
  await expect
    .poll(async () => ((await nepDb()).budget_weken ?? []).length)
    .toBeGreaterThanOrEqual(2);
  void extern;
});

test("/recepten/nieuw: geen Bewaren of Klaar vóór je een manier kiest, daarna één hoofdknop", async ({
  page,
  extern,
}) => {
  await seed();
  await meldAan(page);
  await page.goto("/recepten/nieuw");
  await expect(page.getByRole("heading", { name: "Hoe wil je je recept toevoegen?" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name: "Bewaren", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Klaar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Zelf typen/ }).click();
  await expect(page.getByRole("button", { name: "Klaar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bewaren", exact: true })).toBeVisible();
  void extern;
});
