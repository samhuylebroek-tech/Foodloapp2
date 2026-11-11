/**
 * Tweede verdedigingslaag voor recepten (BUG-105). De nep-Supabase kent GEEN RLS en geeft dus
 * alles terug, precies zoals een te ruime databankregel zou doen. De app moet zelf filteren:
 * eigen recepten, vrienden met deelrecht en actieve gezinsleden wel; een vreemde nooit.
 * RLS blijft de echte grens (tests/rls/), dit is de extra laag.
 */
import { expect, meldAan, resetNep, seedDb, test, zetKlok } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const VRIEND = "44444444-4444-4444-8444-444444444444";
const PARTNER = "55555555-5555-4555-8555-555555555555";
const VREEMD = "66666666-6666-4666-8666-666666666666";
const GEZIN = "abababab-0000-4000-8000-0000000000aa";
const R_VREEMD = "eeee0000-0000-4000-8000-0000000000ff";

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
  instructions: ["Stap"],
  deleted_at: null,
  created_at: "2026-11-01T10:00:00Z",
});

test.beforeEach(async ({ page }) => {
  await resetNep();
  await seedDb({
    recipes: [
      recept("eeee0000-0000-4000-8000-0000000000a1", IK, "Mijn eigen stoofpot"),
      recept("eeee0000-0000-4000-8000-0000000000b1", VRIEND, "Taart van de vriend"),
      recept("eeee0000-0000-4000-8000-0000000000c1", PARTNER, "Curry van de partner"),
      recept(R_VREEMD, VREEMD, "Geheim recept van een vreemde"),
    ],
    shares: [
      {
        id: "dddd0000-0000-4000-8000-000000000001",
        owner_id: VRIEND,
        member_id: IK,
        status: "accepted",
        recipes_view: true,
        recipes_edit: false,
      },
    ],
    groups: [{ id: GEZIN, owner_id: IK, naam: "Thuis" }],
    group_members: [
      {
        id: "cccc0000-0000-4000-8000-000000000001",
        group_id: GEZIN,
        user_id: IK,
        status: "actief",
        rol: "eigenaar",
        recipes_view: true,
        recipes_edit: true,
      },
      {
        id: "cccc0000-0000-4000-8000-000000000002",
        group_id: GEZIN,
        user_id: PARTNER,
        status: "actief",
        rol: "lid",
        recipes_view: true,
        recipes_edit: true,
      },
    ],
  });
  await zetKlok(page, 14);
  await meldAan(page);
});

test("Keuken toont eigen, vriend en gezin, maar nooit een vreemde", async ({ page, extern }) => {
  await page.goto("/gerechten");
  await expect(page.getByText("Mijn eigen stoofpot").first()).toBeVisible();
  await expect(page.getByText("Taart van de vriend").first()).toBeVisible();
  await expect(page.getByText("Curry van de partner").first()).toBeVisible();
  await expect(page.getByText("Geheim recept van een vreemde")).toHaveCount(0);
  void extern;
});

test("Vandaag en de receptkiezer tonen geen recept van een vreemde", async ({ page, extern }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Geheim recept van een vreemde")).toHaveCount(0);
  await page.goto("/planner");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const toevoegen = page.getByRole("button", { name: /Gerecht toevoegen/ }).first();
  await toevoegen.click();
  await expect(page.getByText("Mijn eigen stoofpot").first()).toBeVisible();
  await expect(page.getByText("Geheim recept van een vreemde")).toHaveCount(0);
  void extern;
});

test("detailpagina van een recept van een vreemde: duidelijke melding, geen inhoud", async ({
  page,
  extern,
}) => {
  await page.goto(`/recepten/${R_VREEMD}`);
  await expect(page.getByRole("heading", { name: "Dit recept is niet beschikbaar" })).toBeVisible();
  await expect(page.getByText("Geheim recept van een vreemde")).toHaveCount(0);
  void extern;
});
