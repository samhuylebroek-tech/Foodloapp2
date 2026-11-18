/**
 * Eén gebruikersreis door alle vijf de modules, met eigen (lege) gegevens:
 * voorraad aanvullen → Vandaag stelt voor wat kan met wat in huis is → plannen →
 * Week toont het → Lijst bevat alleen het tekort → winkelmodus → klaar met winkelen →
 * voorraad → Vandaag zegt "koken" → koken → voorraad bijgewerkt → Keuken en Ontdek.
 * Bij elke stap: dezelfde toestand in elke module en nooit horizontaal scrollen.
 * Nep-Supabase in Chromium — geen echte databank en geen echt toestel.
 */
import type { Page } from "@playwright/test";
import {
  expect,
  heeftHorizontaleScroll,
  meldAan,
  nepDb,
  resetNep,
  seedDb,
  test,
  voorraadBijhouden,
  zetKlok,
} from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";
const PESTO = "eeee0000-0000-4000-8000-000000000001";
const vandaag = () => new Date().toLocaleDateString("sv-SE");

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  // P3: "Voorraad bijwerken?" na het koken verschijnt alleen als je je voorraad bijhoudt.
  await voorraadBijhouden(page);
  await resetNep();
  await seedDb({
    recipes: [
      {
        id: PESTO,
        user_id: IK,
        title: "Pasta pesto",
        servings: 4,
        prep_minutes: 10,
        cook_minutes: 12,
        is_concept: false,
        tags: [],
        category: "hoofdgerecht",
        instructions: ["Kook de pasta.", "Meng met basilicum en parmezaan."],
        deleted_at: null,
      },
    ],
    recipe_ingredients: [
      ["pasta", 400, "g"],
      ["basilicum", 30, "g"],
      ["parmezaan", 100, "g"],
    ].map(([name, quantity, unit], position) => ({
      id: crypto.randomUUID(),
      recipe_id: PESTO,
      name,
      quantity,
      unit,
      position,
    })),
    pantry_items: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        naam: "pasta",
        hoeveelheid: 500,
        eenheid: "g",
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-01T10:00:00Z",
      },
    ],
    shopping_lists: [
      { id: LIJST, user_id: IK, name: "Boodschappen", created_at: "2026-11-01T10:00:00Z" },
    ],
  });
  await zetKlok(page, 14);
  await meldAan(page);
});

type Rij = Record<string, unknown>;
const db = async (t: string) => ((await nepDb())[t] ?? []) as Rij[];
const openLijst = async () =>
  (await db("shopping_items")).filter((i) => !i["checked"]).map((i) => String(i["name"]));
const voorraad = async () =>
  Object.fromEntries((await db("pantry_items")).map((p) => [String(p["naam"]), p["hoeveelheid"]]));

async function geenZijscroll(page: Page, stap: string) {
  expect(await heeftHorizontaleScroll(page), `${stap}: scrolt opzij`).toBe(false);
}

/** Navigeer zoals een gebruiker: via de hoofdnavigatie (onderbalk of menu bovenaan). */
async function naar(page: Page, label: string) {
  await page
    .getByRole("navigation")
    // Toegankelijke naam is "Week (Weekmenu)": korte tekst plus de langere voor schermlezers.
    .getByRole("link", { name: new RegExp(`^${label}( \\(|$)`) })
    .first()
    .click();
}

test("reis: voorraad → plan → lijst → winkel → koken, in alle modules dezelfde toestand", async ({
  page,
  extern,
}) => {
  // 1. Voorraad: parmezaan erbij.
  await page.goto("/voorraad");
  await page.getByLabel("Nieuw product").fill("100 g parmezaan");
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect.poll(voorraad).toMatchObject({ pasta: 500, parmezaan: 100 });
  await geenZijscroll(page, "voorraad");

  // 2. Vandaag: nog niets gepland, dus "kiezen", met een voorstel uit wat in huis is.
  await naar(page, "Vandaag");
  const nu = page.locator("[data-nu]");
  await expect(nu).toHaveAttribute("data-nu", "kiezen");
  const voorstellen = page.getByRole("region", { name: "Met wat je in huis hebt" });
  await voorstellen.getByRole("button", { name: "Kook Pasta pesto vanavond" }).click();
  await expect(page.getByText(/staat op vanavond/).first()).toBeVisible();
  await expect
    .poll(async () => (await db("meal_plan")).filter((m) => m["plan_date"] === vandaag()).length)
    .toBe(1);
  // Alleen het tekort gaat op de lijst; wat in huis is niet.
  await expect.poll(openLijst).toEqual(["basilicum"]);
  // Vandaag springt door naar de volgende stap: winkelen.
  await expect(nu).toHaveAttribute("data-nu", "winkelen");
  await expect(nu.getByText(/basilicum/).first()).toBeVisible();
  await geenZijscroll(page, "vandaag na plannen");

  // 3. Week toont hetzelfde gerecht.
  await naar(page, "Week");
  await expect(page.getByText("Pasta pesto").first()).toBeVisible();
  await geenZijscroll(page, "week");

  // 4. Lijst: alleen basilicum, met de koppeling naar het gerecht.
  await naar(page, "Lijst");
  await expect(page.getByText("basilicum").first()).toBeVisible();
  await expect(page.getByText("parmezaan")).toHaveCount(0);
  await geenZijscroll(page, "lijst");

  // 5. Winkelmodus: afvinken en klaar met winkelen → voorraad.
  await page.getByRole("button", { name: "Ik ga winkelen" }).click();
  const winkel = page.getByRole("dialog", { name: "Winkelmodus" });
  await expect(winkel).toBeVisible();
  const vink = winkel.getByRole("button", { name: /— tik om af te vinken$/ });
  await expect(async () => {
    if ((await vink.count()) > 0) await vink.first().click();
    await expect(winkel.getByTestId("te-halen")).toHaveText("0", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await winkel.getByRole("button", { name: "Klaar met winkelen" }).click();
  await expect.poll(async () => Object.keys(await voorraad())).toContain("basilicum");
  await expect.poll(openLijst).toEqual([]);

  // 6. Vandaag: alles in huis, dus "koken".
  await naar(page, "Vandaag");
  await expect(nu).toHaveAttribute("data-nu", "koken");
  await nu
    .getByRole("link", { name: /Start koken/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Klaar met koken" }).click();
  await page.getByRole("button", { name: "5 sterren" }).click();
  // P3: niets gaat stil uit de voorraad; je bevestigt het voorstel.
  await page
    .getByRole("button", { name: /^Haal \d+ (product|producten) uit je voorraad$/ })
    .click();
  await expect(page.getByText(/Voorraad bijgewerkt/).first()).toBeVisible();
  // Verbruikt: basilicum en parmezaan op, pasta minder (porties kunnen herschaald zijn).
  await expect
    .poll(async () => {
      const v = await voorraad();
      return [v["basilicum"], v["parmezaan"], Number(v["pasta"] ?? 0) < 500];
    })
    .toEqual([undefined, undefined, true]);
  // P3: "Klaar" sluit het scherm en markeert de maaltijd als gekookt.
  await page.getByRole("button", { name: "Klaar", exact: true }).click();
  await expect.poll(async () => (await nepDb()).kookmomenten?.length ?? 0).toBe(1);

  // 7. Keuken kent het gerecht; Ontdek laadt zonder fout.
  await naar(page, "Keuken");
  await expect(page.getByText("Pasta pesto").first()).toBeVisible();
  await geenZijscroll(page, "keuken");
  await naar(page, "Ontdek");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/ging iets mis|lukte niet/i)).toHaveCount(0);
  await geenZijscroll(page, "ontdek");
  void extern;
});
