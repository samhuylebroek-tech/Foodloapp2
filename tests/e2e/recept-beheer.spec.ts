/**
 * Ronde 2 (docs/foodlo/DEVELOPMENT_ROADMAP.md): receptbeheer zonder verrassingen.
 * - BUG-146: verwijderen op de receptpagina = zelfde als in de lijst: bevestigen, zacht verwijderen,
 *   "Ongedaan maken". Vroeger: browservenster en een harde delete zonder weg terug.
 * - BUG-144: "Zet in mijn gerechten" toont eerst wat er gekopieerd wordt; foto's gaan mee.
 * Nepdata, geen echte databank.
 */
import { expect, meldAan, nepDb, resetNep, seedDb, test } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const VRIEND = "44444444-4444-4444-8444-444444444444";
const MIJN = "eeee0000-0000-4000-8000-0000000001a1";
const VAN_VRIEND = "eeee0000-0000-4000-8000-0000000001b1";

const recept = (id: string, user_id: string, title: string) => ({
  id,
  user_id,
  title,
  servings: 2,
  prep_minutes: 5,
  cook_minutes: 10,
  is_concept: false,
  tags: [],
  category: "hoofdgerecht",
  instructions: ["Snij alles fijn.", "Bak 10 minuten."],
  image_url: null,
  deleted_at: null,
  created_at: "2026-11-01T10:00:00Z",
});
const recepten = async () => (await nepDb()).recipes ?? [];

test.beforeEach(async ({ page }) => {
  await resetNep();
  await seedDb({
    recipes: [recept(MIJN, IK, "Mijn soep"), recept(VAN_VRIEND, VRIEND, "Taart van de vriend")],
    recipe_ingredients: [
      {
        id: "eeee0000-0000-4000-8000-0000000002a1",
        recipe_id: VAN_VRIEND,
        name: "bloem",
        quantity: 200,
        unit: "g",
        position: 0,
      },
      {
        id: "eeee0000-0000-4000-8000-0000000002a2",
        recipe_id: VAN_VRIEND,
        name: "suiker",
        quantity: 100,
        unit: "g",
        position: 1,
      },
    ],
    recipe_photos: [
      {
        id: "eeee0000-0000-4000-8000-0000000003a1",
        recipe_id: VAN_VRIEND,
        path: `${VRIEND}/taart.jpg`,
        position: 0,
      },
    ],
    shares: [
      {
        id: "dddd0000-0000-4000-8000-000000000101",
        owner_id: VRIEND,
        member_id: IK,
        status: "accepted",
        recipes_view: true,
        recipes_edit: false,
      },
    ],
  });
  await meldAan(page);
});

test("verwijderen op de receptpagina: bevestigen, zacht verwijderd, ongedaan maken zet het terug", async ({
  page,
  extern,
}) => {
  await page.goto(`/recepten/${MIJN}`);
  await page.getByRole("button", { name: "Meer acties voor dit recept" }).click();
  await page.getByRole("menuitem", { name: "Verwijderen" }).click();
  const dialoog = page.getByRole("alertdialog");
  await expect(dialoog.getByText("Zeker verwijderen?")).toBeVisible();
  await dialoog.getByRole("button", { name: "Verwijderen" }).click();
  await expect(page).toHaveURL(/\/gerechten/);
  // Nooit hard gewist: de rij bestaat nog, met deleted_at.
  await expect
    .poll(async () => (await recepten()).find((r) => r["id"] === MIJN)?.["deleted_at"] ?? null)
    .not.toBeNull();
  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect
    .poll(async () => {
      const r = (await recepten()).find((x) => x["id"] === MIJN);
      return r ? r["deleted_at"] : "ontbreekt";
    })
    .toBeNull();
  void extern;
});

test("annuleren bij verwijderen laat het recept staan", async ({ page, extern }) => {
  await page.goto(`/recepten/${MIJN}`);
  await page.getByRole("button", { name: "Meer acties voor dit recept" }).click();
  await page.getByRole("menuitem", { name: "Verwijderen" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Annuleren" }).click();
  await expect(page).toHaveURL(new RegExp(`/recepten/${MIJN}`));
  expect((await recepten()).find((r) => r["id"] === MIJN)?.["deleted_at"]).toBeNull();
  void extern;
});

test("'Zet in mijn gerechten' toont eerst een overzicht en kopieert ingrediënten en foto's", async ({
  page,
  extern,
}) => {
  await page.goto(`/recepten/${VAN_VRIEND}`);
  await page.getByRole("button", { name: "Meer acties voor dit recept" }).click();
  await page.getByRole("menuitem", { name: "Zet in mijn gerechten" }).click();
  const dialoog = page.getByRole("alertdialog");
  await expect(dialoog.getByTestId("kopie-overzicht")).toContainText("2 ingrediënten · 2 stappen");
  // Nog niets gekopieerd zolang je niet bevestigt.
  expect((await recepten()).filter((r) => r["title"] === "Taart van de vriend")).toHaveLength(1);
  await dialoog.getByRole("button", { name: "Zet in mijn gerechten" }).click();
  await expect
    .poll(
      async () =>
        (await recepten()).filter(
          (r) => r["user_id"] === IK && r["title"] === "Taart van de vriend",
        ).length,
    )
    .toBe(1);
  const kopieId = async () =>
    String(
      (await recepten()).find((r) => r["user_id"] === IK && r["title"] === "Taart van de vriend")?.[
        "id"
      ],
    );
  await expect
    .poll(async () => {
      const id = await kopieId();
      return ((await nepDb()).recipe_ingredients ?? []).filter((i) => i["recipe_id"] === id).length;
    })
    .toBe(2);
  await expect
    .poll(async () => {
      const id = await kopieId();
      return ((await nepDb()).recipe_photos ?? []).filter((f) => f["recipe_id"] === id).length;
    })
    .toBe(1);
  void extern;
});

// Ronde 3 (FR-RI-07): je eigen recept dupliceren; het origineel blijft ongewijzigd.
test("eigen recept dupliceren maakt een kopie met '(kopie)' en laat het origineel staan", async ({
  page,
  extern,
}) => {
  await page.goto(`/recepten/${MIJN}`);
  await page.getByRole("button", { name: "Meer acties voor dit recept" }).click();
  await page.getByRole("menuitem", { name: "Dupliceren" }).click();
  await expect
    .poll(async () => (await recepten()).filter((r) => r["title"] === "Mijn soep (kopie)").length)
    .toBe(1);
  expect((await recepten()).find((r) => r["id"] === MIJN)?.["title"]).toBe("Mijn soep");
  await expect(page).not.toHaveURL(new RegExp(`/recepten/${MIJN}$`));
  void extern;
});
