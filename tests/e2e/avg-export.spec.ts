/**
 * AVG-export via de knop in Instellingen (BUG-026). Nep-Supabase zonder RLS: de server moet zelf
 * strikt op de gebruiker filteren. Fictieve gegevens; er wordt niets buiten 127.0.0.1 aangesproken.
 */
import { readFileSync } from "node:fs";
import { expect, meldAan, resetDemo, seedDb, test, zetKlok } from "./helpers";

const VREEMD = "66666666-6666-4666-8666-666666666666";

test("Mijn gegevens downloaden: volledig, eigen gegevens, niets van een ander", async ({
  page,
  extern,
}) => {
  await resetDemo();
  await seedDb({
    recipes: [
      {
        id: "eeee0000-0000-4000-8000-0000000000ff",
        user_id: VREEMD,
        title: "Geheim recept van een vreemde",
        servings: 2,
        is_concept: false,
        tags: [],
        instructions: [],
        deleted_at: null,
      },
    ],
    recipe_ingredients: [
      {
        id: "eeee0000-0000-4000-8000-0000000000f1",
        recipe_id: "eeee0000-0000-4000-8000-0000000000ff",
        name: "geheime saus",
        position: 0,
      },
    ],
    pantry_items: [
      { id: "eeee0000-0000-4000-8000-0000000000f2", user_id: VREEMD, naam: "vreemde voorraad" },
    ],
    feedback: [
      { id: "eeee0000-0000-4000-8000-0000000000f3", user_id: VREEMD, message: "vreemd ticket" },
    ],
  });
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/instellingen");
  const [bestand] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Mijn gegevens downloaden/ }).click(),
  ]);
  const inhoud = readFileSync(await bestand.path(), "utf8");
  const json = JSON.parse(inhoud) as Record<string, unknown>;

  // Volledig: de nieuwe secties zitten erin.
  for (const sectie of [
    "recepten",
    "ingredienten",
    "receptfotos",
    "voorraadkast",
    "gezinslidmaatschappen",
    "deelrechten",
    "feedback",
    "sessies",
    "credits",
  ])
    expect(json, sectie).toHaveProperty(sectie);
  // Eigen gegevens (demodata van Marie) staan erin.
  expect((json["recepten"] as unknown[]).length).toBeGreaterThan(0);
  expect((json["ingredienten"] as unknown[]).length).toBeGreaterThan(0);
  // Niets van een ander.
  expect(inhoud).not.toContain("Geheim recept van een vreemde");
  expect(inhoud).not.toContain("geheime saus");
  expect(inhoud).not.toContain("vreemde voorraad");
  expect(inhoud).not.toContain("vreemd ticket");
  // Geheimen bewust niet in het bestand.
  expect(inhoud).not.toContain('"nummer"');
  expect(inhoud).not.toContain('"p256dh"');
  void extern;
});
