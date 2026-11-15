/**
 * Werkstroom F — kookassistent "Vraag het Foodlo" (nep-databank, testadapter, geen echte AI).
 * - Vervangers uit de vaste tabel respecteren jouw allergie en die van wie meeëet; de reden van een
 *   lid dat niet deelt (Lotte) blijft privé.
 * - De slimme hulp antwoordt in de demo met de testadapter (zichtbaar "Testmodus"); een voorstel
 *   met noten wordt ook daar tegengehouden.
 * - Aanpassen toont eerst een voorbeeld; "Bewaar als kopie" laat het origineel ongemoeid,
 *   "Pas dit recept aan" kan ongedaan gemaakt worden.
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test } from "./helpers";

const WITLOOF = "aaaaaaaa-0000-4000-8000-000000000008";

async function kennismaking(page: Page, k: { allergieen: string[]; dieet?: string }) {
  await page.addInitScript(
    ([id, waarde]) => window.localStorage.setItem(`foodlo:kennismaking:${id}`, waarde),
    [DEMO_USER_ID, JSON.stringify(k)] as const,
  );
}

async function openAssistent(page: Page) {
  await page.goto(`/recepten/${WITLOOF}`);
  await page.getByRole("button", { name: "Vraag het Foodlo" }).click();
  const paneel = page.getByRole("dialog", { name: "Vraag het Foodlo" });
  await expect(paneel).toBeVisible();
  return paneel;
}

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("vervanger respecteert jouw glutenallergie en Lottes allergie (zonder reden te tonen)", async ({
  page,
}) => {
  await kennismaking(page, { allergieen: ["gluten"] });
  const paneel = await openAssistent(page);
  // Mee-eters uit het gezin (demo): Lotte en Gust.
  await expect(paneel.getByRole("button", { name: "Lotte" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await paneel
    .getByRole("group", { name: "Welk ingrediënt wil je vervangen?" })
    .getByRole("button", { name: "melk" })
    .click();
  const vast = paneel.getByRole("list", { name: "Vaste vervangers voor melk" });
  await expect(vast.getByText("Rijstmelk")).toBeVisible();
  await expect(vast.getByText("Sojamelk")).toBeVisible();
  await expect(vast.getByText("Havermelk")).toHaveCount(0);
  await expect(vast.getByText("Amandelmelk")).toHaveCount(0);

  const niet = paneel.getByRole("list", { name: "Niet voorgesteld" });
  await expect(niet.getByRole("listitem").filter({ hasText: "Havermelk" })).toContainText(
    "bevat mogelijk gluten (jouw allergie)",
  );
  await expect(niet.getByRole("listitem").filter({ hasText: "Amandelmelk" })).toContainText(
    "niet geschikt voor Lotte",
  );
  // Lotte deelt haar voorkeuren niet: Marie ziet niet welke allergie.
  await expect(niet.getByRole("listitem").filter({ hasText: "Amandelmelk" })).not.toContainText(
    "noten",
  );

  // Lotte eet vanavond niet mee: dan mag amandelmelk wel.
  await paneel.getByRole("button", { name: "Lotte" }).click();
  await expect(vast.getByText("Amandelmelk")).toBeVisible();

  expect(await axeErnstig(page)).toEqual([]);
});

test("slimme hulp in testmodus: gelabeld, en een voorstel met noten wordt tegengehouden", async ({
  page,
}) => {
  await kennismaking(page, { allergieen: ["noten"] });
  const paneel = await openAssistent(page);
  await paneel.getByLabel("Ander ingrediënt").fill("room");
  await paneel.getByRole("button", { name: "Zoek vervangers" }).click();
  await expect(
    paneel.getByRole("list", { name: "Vaste vervangers voor room" }).getByText("Kokosroom"),
  ).toBeVisible();

  await paneel.getByRole("button", { name: "Meer ideeën van de slimme hulp" }).click();
  await expect(
    paneel.getByText("Testmodus: vaste voorbeeldantwoorden, geen echte AI"),
  ).toBeVisible();
  const extra = paneel.getByRole("list", { name: "Extra ideeën van de slimme hulp" });
  await expect(extra.getByText("Zijdetofu")).toBeVisible();
  await expect(extra.getByText("Cashewroom")).toHaveCount(0);
  await expect(
    paneel
      .getByRole("list", { name: "Niet voorgesteld" })
      .getByRole("listitem")
      .filter({ hasText: "Cashewroom" }),
  ).toContainText("bevat mogelijk noten (jouw allergie)");
  await expect(paneel.getByText(/Je kan vandaag nog 19 van de 20 slimme vragen/)).toBeVisible();

  // Korte kookvraag: eerst het vaste antwoord, zonder AI.
  await paneel.getByRole("tab", { name: "Vraag" }).click();
  await paneel.getByLabel("Je kookvraag").fill("Mijn saus is te dun");
  await paneel.getByRole("button", { name: "Vraag", exact: true }).click();
  await expect(paneel.getByRole("region", { name: "Antwoord" })).toContainText("maïzena");
  await expect(paneel.getByText("Vaste Foodlo-tips (zonder AI)")).toBeVisible();
});

test("vegetarisch maken: eerst een voorbeeld, dan als kopie bewaren; origineel blijft", async ({
  page,
}) => {
  const paneel = await openAssistent(page);
  await paneel.getByRole("tab", { name: "Aanpassen" }).click();
  await paneel.getByRole("button", { name: "Toon vegetarisch voorbeeld" }).click();

  const verschillen = paneel.getByRole("list", { name: "Verschillen" });
  await expect(verschillen).toContainText("8 snee gekookte hesp");
  await expect(verschillen).toContainText("→ 8 snee gegrilde aubergineplakjes");
  await expect(paneel.getByRole("list", { name: "Let op" })).toContainText(
    "De titel noemt het nog",
  );
  // Nog niets bewaard.
  const voor = (await nepDb()).recipe_ingredients!.filter((r) => r["recipe_id"] === WITLOOF);
  expect(voor.map((r) => r["name"])).toContain("gekookte hesp");

  await paneel.getByRole("button", { name: "Bewaar als kopie" }).click();
  await expect(page.getByText("Kopie bewaard. Het origineel blijft zoals het was.")).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(WITLOOF));

  const db = await nepDb();
  const kopie = db.recipes!.find(
    (r) => r["title"] === "Witloof met hesp en kaassaus (vegetarisch)",
  );
  expect(kopie).toBeTruthy();
  expect(kopie!["tags"]).toEqual(["Belgisch", "oven", "vegetarisch"]);
  const kopieIngr = db
    .recipe_ingredients!.filter((r) => r["recipe_id"] === kopie!["id"])
    .map((r) => r["name"]);
  expect(kopieIngr).toContain("gegrilde aubergineplakjes");
  expect(kopieIngr).not.toContain("gekookte hesp");
  const origineel = db
    .recipe_ingredients!.filter((r) => r["recipe_id"] === WITLOOF)
    .map((r) => r["name"]);
  expect(origineel).toContain("gekookte hesp");
});

test("origineel aanpassen voor 2 personen en daarna ongedaan maken", async ({ page }) => {
  const paneel = await openAssistent(page);
  await paneel.getByRole("tab", { name: "Aanpassen" }).click();
  await paneel.getByRole("button", { name: "Minder personen" }).click();
  await paneel.getByRole("button", { name: "Minder personen" }).click();
  await paneel.getByRole("button", { name: "Toon voorbeeld voor 2 personen" }).click();
  await expect(paneel.getByRole("list", { name: "Verschillen" })).toContainText(
    "→ 4 stuk(s) witloof",
  );

  await paneel.getByRole("button", { name: "Pas dit recept aan" }).click();
  await expect(page.getByText("Recept aangepast")).toBeVisible();
  await expect
    .poll(async () => (await nepDb()).recipes!.find((r) => r["id"] === WITLOOF)!["servings"])
    .toBe(2);
  const na = (await nepDb()).recipe_ingredients!.find(
    (r) => r["recipe_id"] === WITLOOF && r["name"] === "witloof",
  );
  expect(na!["quantity"]).toBe(4);

  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(page.getByText("Recept teruggezet zoals het was")).toBeVisible();
  const terug = await nepDb();
  expect(terug.recipes!.find((r) => r["id"] === WITLOOF)!["servings"]).toBe(4);
  expect(
    terug.recipe_ingredients!.find((r) => r["recipe_id"] === WITLOOF && r["name"] === "witloof")![
      "quantity"
    ],
  ).toBe(8);
});

test("in de kookstand: Vraag-knop opent vervangen en vraag, zonder aanpassen", async ({ page }) => {
  await page.goto(`/recepten/${WITLOOF}?koken=1`);
  await page.getByRole("button", { name: "Vraag het Foodlo" }).click();
  const paneel = page.getByRole("dialog", { name: "Vraag het Foodlo" });
  await expect(paneel.getByRole("tab", { name: "Vervangen" })).toBeVisible();
  await expect(paneel.getByRole("tab", { name: "Aanpassen" })).toHaveCount(0);
  await paneel
    .getByRole("group", { name: "Welk ingrediënt wil je vervangen?" })
    .getByRole("button", { name: "boter" })
    .click();
  await expect(
    paneel.getByRole("list", { name: "Vaste vervangers voor boter" }).getByText("Olijfolie"),
  ).toBeVisible();
  await expect(paneel.getByRole("button", { name: "Gebruik dit in het recept" })).toHaveCount(0);
});
