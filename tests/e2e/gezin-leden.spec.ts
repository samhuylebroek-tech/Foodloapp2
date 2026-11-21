/**
 * Werkstroom C: persoonlijke voeding (voorstel 0009) en gezinsleden met voorkeuren, mee-eters
 * en veiligheid per lid (voorstel 0010). Alleen tegen de nep-databank; in productie bestaan
 * deze tabellen pas na de migratie (dan "binnenkort", getest met een ontbrekende tabel).
 */
import { expect, meldAan, nepDb, resetDemo, seedDb, storing, test } from "./helpers";

const MARIE = "11111111-1111-4111-8111-111111111111";
const NOTEN = "aaaaaaaa-0000-4000-8000-0000000000c1";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await seedDb({
    recipes: [
      {
        id: NOTEN,
        user_id: MARIE,
        title: "Pasta met hazelnootpesto",
        servings: 4,
        prep_minutes: 10,
        cook_minutes: 10,
        is_concept: false,
        tags: ["vegetarisch"],
        category: "hoofdgerecht",
        instructions: ["Kook de pasta.", "Mix de pesto."],
        image_url: null,
        deleted_at: null,
        created_at: "2026-11-10T10:00:00Z",
      },
    ],
    recipe_ingredients: [
      ["spaghetti", 0],
      ["hazelnoten", 1],
      ["basilicum", 2],
    ].map(([name, position]) => ({
      id: `aaaaaaaa-00c1-4000-8000-00000000000${position}`,
      recipe_id: NOTEN,
      name,
      quantity: 100,
      unit: "g",
      position,
    })),
  });
  await meldAan(page);
});

test("mijn voorkeuren: pas na toestemming op het account bewaard", async ({ page, extern }) => {
  await page.goto("/instellingen");
  await page.getByRole("link", { name: /Mijn allergieën en voorkeuren/ }).click();
  await expect(page).toHaveURL(/\/mijn-voeding/);
  await expect(
    page.getByText("Alleen voor jou. Nooit naar de AI. Niet zichtbaar voor je gezin.").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sesam" }).click();
  await page.getByRole("radio", { name: "Vegetarisch" }).click();
  await page.getByLabel(/liever niet eet/).fill("bloemkool");
  await page.getByRole("button", { name: "Toevoegen" }).click();
  await page.getByRole("button", { name: "Bewaren", exact: true }).click();
  // Eerst de toestemmingsvraag; nog niets op het account.
  await expect(
    page.getByRole("heading", { name: "Mogen we dit bewaren op je account?" }),
  ).toBeVisible();
  expect((await nepDb()).persoonlijke_voeding ?? []).toHaveLength(0);
  await page.getByRole("button", { name: "Ja, bewaar op mijn account" }).click();
  await expect(page.getByText(/Bewaard op je account/)).toBeVisible();
  const rijen = (await nepDb()).persoonlijke_voeding ?? [];
  expect(rijen).toHaveLength(1);
  expect(rijen[0]).toMatchObject({
    user_id: MARIE,
    allergieen: ["sesam"],
    dieet: "vegetarisch",
    uitsluitingen: ["bloemkool"],
  });
  expect(String(rijen[0]!.toestemming_op)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await page.reload();
  await expect(
    page.getByText(/Op je account bewaard met je toestemming van \d{2}\/\d{2}\/\d{4}/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sesam" })).toHaveAttribute("aria-pressed", "true");
  void extern;
});

test("zonder toestemming of zonder tabel blijft het op het toestel", async ({ page, extern }) => {
  await storing({ pad: "/rest/v1/persoonlijke_voeding", soort: "ontbreekt", keer: 50 });
  await page.goto("/mijn-voeding");
  await expect(
    page.getByText(/Bewaren op je account: deze functie wordt binnenkort geactiveerd/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pinda's" }).click();
  await page.getByRole("button", { name: "Bewaren", exact: true }).click();
  await expect(page.getByText("Bewaard op dit toestel")).toBeVisible();
  const toestel = await page.evaluate(
    (id) => window.localStorage.getItem(`foodlo:kennismaking:${id}`),
    MARIE,
  );
  expect(JSON.parse(toestel ?? "{}").allergieen).toEqual(["pindas"]);
  void extern;
});

test("gezin: lid met allergie toevoegen, reden van een ander blijft verborgen", async ({
  page,
  extern,
}) => {
  await page.goto("/gezin");
  const kaarten = page.getByTestId("lidkaart");
  await expect(kaarten.filter({ hasText: "Lotte" })).toContainText(
    "Voorkeuren ingevuld (niet gedeeld)",
  );
  await expect(kaarten.filter({ hasText: "Lotte" })).not.toContainText(/noten/i);
  // Lotte wordt door Jan beheerd: Marie kan haar voorkeuren niet openen.
  await expect(
    kaarten.filter({ hasText: "Lotte" }).getByRole("button", { name: "Voorkeuren" }),
  ).toHaveCount(0);
  await expect(kaarten.filter({ hasText: "Gust" })).toContainText("Vegetarisch");
  await expect(page.getByRole("link", { name: /Gezinsweekmenu/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Gezinslijst/ })).toBeVisible();

  await page.getByLabel("Iemand zonder account toevoegen").fill("Mila");
  await page.getByRole("radio", { name: "Een kind" }).click();
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  const mila = kaarten.filter({ hasText: "Mila" });
  await expect(mila).toContainText("Nog geen voorkeuren");
  await mila.getByRole("button", { name: "Voorkeuren" }).click();
  const venster = page.getByRole("dialog");
  await venster.getByRole("button", { name: "Melk (lactose)" }).click();
  // Zonder toestemming kan je niet bewaren.
  await expect(venster.getByRole("button", { name: "Bewaren" })).toBeDisabled();
  await venster.getByText("Ik beheer dit voor Mila").click();
  await venster.getByRole("button", { name: "Bewaren" }).click();
  await expect(mila).toContainText("Melk (lactose)");
  const db = await nepDb();
  const lid = (db.huishouden_leden ?? []).find((l) => l.naam === "Mila");
  expect(lid).toMatchObject({ rol: "kind", user_id: null, beheerder_id: MARIE });
  const v = (db.lid_voeding ?? []).find((r) => r.lid_id === lid!.id);
  expect(v).toMatchObject({
    allergieen: ["melk"],
    delen_met_gezin: false,
    toestemming_door: MARIE,
    toestemming_soort: "beheerder",
  });
  void extern;
});

test("inplannen: wie eet mee bepaalt de personen, waarschuwing zonder reden", async ({
  page,
  extern,
}) => {
  await page.goto("/planner");
  await page.getByRole("button", { name: "Gerecht toevoegen" }).last().click();
  await page.getByRole("button", { name: /Verder naar maaltijd/ }).click();
  const venster = page.getByRole("dialog");
  await expect(venster.getByText("Wie eet mee?")).toBeVisible();
  await expect(venster.getByText("4 personen")).toBeVisible();
  await venster.getByRole("button", { name: "Jan", exact: true }).click();
  await expect(venster.getByText("3 personen")).toBeVisible();
  await venster.getByRole("button", { name: "Eén gast meer" }).click();
  await expect(venster.getByText("4 personen")).toBeVisible();
  await venster.getByRole("button", { name: "Eén gast minder" }).click();
  await expect(venster.getByText("3 personen")).toBeVisible();

  const pesto = venster.getByRole("button", { name: /Pasta met hazelnootpesto/ });
  await expect(pesto).toContainText("Niet veilig voor Lotte");
  await expect(pesto).not.toContainText(/noten/i);
  // Gust deelt zijn dieet: daar staat de reden wel bij.
  await expect(venster.getByRole("button", { name: /Stoofvlees met frietjes/ })).toContainText(
    /Niet veilig voor Gust \(Gust: past niet bij vegetarisch\)/,
  );

  const voor = ((await nepDb()).meal_plan ?? []).length;
  await venster.getByRole("button", { name: /Romige pompoensoep/ }).click();
  await expect(page.getByText(/Romige pompoensoep staat op/).first()).toBeVisible();
  await expect.poll(async () => ((await nepDb()).meal_plan ?? []).length).toBe(voor + 1);
  const db = await nepDb();
  const nieuw = db.meal_plan!.find(
    (p) =>
      !String(p.id).startsWith("cccccccc") &&
      p.recipe_id === "aaaaaaaa-0000-4000-8000-000000000002",
  );
  expect(nieuw?.personen).toBe(3);
  // De mee-eters worden net na de maaltijd bewaard.
  await expect
    .poll(
      async () =>
        ((await nepDb()).maaltijd_eters ?? []).filter((e) => e.meal_plan_id === nieuw!.id).length,
    )
    .toBe(3);
  // Initialen op de weekkaart.
  await expect(page.locator("[data-testid=mee-eters]:visible").first()).toBeVisible();
  void extern;
});

test("zonder gezinsleden-tabel: gewone personenteller blijft werken", async ({ page, extern }) => {
  await storing({ pad: "/rest/v1/huishouden_leden", soort: "ontbreekt", keer: 50 });
  await page.goto("/planner");
  await page.getByRole("button", { name: "Gerecht toevoegen" }).last().click();
  await page.getByRole("button", { name: /Verder naar maaltijd/ }).click();
  const venster = page.getByRole("dialog");
  await expect(venster.getByText("Voor hoeveel personen?")).toBeVisible();
  await expect(venster.getByText("Wie eet mee?")).toHaveCount(0);
  await page.goto("/gezin");
  await expect(
    page.getByText(/Voorkeuren per gezinslid: deze functie wordt binnenkort geactiveerd/),
  ).toBeVisible();
  void extern;
});
