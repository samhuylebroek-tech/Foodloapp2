/**
 * P5 — Schermcontrole samenwerking op 390 px: licht en "Extra duidelijk" met tekst 200 %.
 * Bewaart schermafdrukken in de testuitvoer (niet in de repo) en controleert dat niets
 * horizontaal uitloopt. Draait in het project mobiel-390 (naam bevat "schermen").
 */
import type { Page } from "@playwright/test";
import { expect, heeftHorizontaleScroll, meldAan, resetDemo, seedDb, test } from "./helpers";

const JAN = "22222222-2222-4222-8222-222222222222";
const MARIE = "11111111-1111-4111-8111-111111111111";
const GEZIN = "abababab-0000-4000-8000-000000000001";
const PLAN = "c5c5c5c5-0000-4000-8000-000000000001";
const LIJST = "c6c6c6c6-0000-4000-8000-000000000001";
const R = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const vandaag = new Date().toLocaleDateString("sv-SE");

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }, info) => {
  test.skip((page.viewportSize()?.width ?? 0) > 500, "alleen telefoonbreedte");
  void info;
  await resetDemo();
  await seedDb({
    meal_plan: [
      {
        id: PLAN,
        user_id: MARIE,
        group_id: GEZIN,
        recipe_id: R(1),
        custom_title: null,
        soort: null,
        personen: 4,
        plan_date: vandaag,
        meal_type: "avondeten",
        created_at: "2026-11-01T10:00:00Z",
      },
    ],
    shopping_lists: [
      {
        id: LIJST,
        user_id: MARIE,
        group_id: GEZIN,
        name: "Gezinslijst",
        created_at: "2026-11-02T10:00:00Z",
      },
    ],
    shopping_items: [
      ["volkorenbrood van de bakker", 1, "stuk(s)"],
      ["jonge kaas", 300, "g"],
    ].map(([name, quantity, unit], i) => ({
      id: `c7c7c7c7-0000-4000-8000-00000000000${i}`,
      user_id: MARIE,
      list_id: LIJST,
      name,
      quantity,
      unit,
      checked: false,
      recipe_id: null,
      note: null,
      created_at: "2026-11-02T10:00:00Z",
    })),
    lijst_toewijzingen: [
      {
        id: "c8c8c8c8-0000-4000-8000-000000000001",
        item_id: "c7c7c7c7-0000-4000-8000-000000000000",
        list_id: LIJST,
        toegewezen_aan: JAN,
        winkel: "Bakker",
      },
    ],
    app_meldingen: [
      {
        id: "a5a5a5a5-0017-4000-8000-000000000002",
        user_id: MARIE,
        group_id: GEZIN,
        actor_id: JAN,
        soort: "menu",
        tekst: "Jan veranderde woensdag in Spaghetti bolognese. Let op: niet veilig voor Lotte",
        link: "/planner?weergave=gezin",
        sleutel: null,
        gelezen_op: null,
        created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
    ],
    gezin_activiteit: [
      {
        id: "a6a6a6a6-0017-4000-8000-000000000002",
        group_id: GEZIN,
        actor_id: JAN,
        soort: "menu",
        tekst: "Jan veranderde vandaag in Spaghetti bolognese",
        datum: vandaag,
        ref_id: PLAN,
        created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      },
    ],
  });
});

async function varianten(page: Page, naam: string, info: { outputPath: (n: string) => string }) {
  expect(await heeftHorizontaleScroll(page), `${naam}: horizontaal scrollen`).toBe(false);
  await page.screenshot({ path: info.outputPath(`${naam}-licht.jpg`), quality: 70 });
  await page.evaluate(() => {
    document.documentElement.classList.add("thema-contrast");
    document.documentElement.style.fontSize = "200%";
  });
  await page.waitForTimeout(300);
  expect(await heeftHorizontaleScroll(page), `${naam} (200 %): horizontaal scrollen`).toBe(false);
  await page.screenshot({ path: info.outputPath(`${naam}-duidelijk-200.jpg`), quality: 70 });
  await page.evaluate(() => {
    document.documentElement.classList.remove("thema-contrast");
    document.documentElement.style.fontSize = "";
  });
}

test("schermen: conflictkeuze, lijst verdelen, meldingen, wie veranderde wat", async ({
  page,
}, info) => {
  await meldAan(page);
  // 1. Conflictkeuze (Marie zag stoofvlees; Jan zette intussen spaghetti).
  await page.goto("/planner?weergave=gezin");
  await page
    .getByRole("button", { name: "Acties voor Stoofvlees met frietjes" })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Ander gerecht" }).click();
  const blad = page.getByRole("dialog", { name: "Ander gerecht" });
  await blad.getByRole("textbox", { name: "Zoek in je recepten" }).fill("Griekse");
  await seedDb({}); // niets: alleen om de volgorde te tonen
  await fetch("http://127.0.0.1:54439/rest/v1/meal_plan?id=eq." + PLAN, {
    method: "PATCH",
    headers: { "content-type": "application/json", apikey: "sb_secret_nep_alleen_lokaal" },
    body: JSON.stringify({ recipe_id: R(4) }),
  });
  await blad
    .getByRole("button", { name: /Griekse/i })
    .filter({ visible: true })
    .first()
    .click();
  const keuze = page.getByTestId("conflict-keuze");
  await expect(keuze).toBeVisible();
  await keuze.getByRole("button", { name: "Bekijk allebei" }).click();
  await varianten(page, "p5-conflict", info);
  await keuze.getByRole("button", { name: /Houd/ }).click();

  // 2. Wie veranderde wat (Week, gezin).
  await page.reload();
  const log = page.getByRole("region", { name: "Wie veranderde wat" });
  await log.getByText("Toon").click();
  await log.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await varianten(page, "p5-wie-wat", info);

  // 3. Lijst verdelen.
  await page.goto("/boodschappen?lijst=gezin");
  await expect(page.getByTestId("wie-haalt").first()).toBeVisible();
  await page
    .getByRole("group", { name: "Welk deel van de lijst" })
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await varianten(page, "p5-lijst-verdeeld", info);
  await page
    .getByRole("button", { name: "jonge kaas aanpassen" })
    .evaluate((el) => (el as HTMLElement).click());
  await expect(page.getByLabel("Wie haalt dit?")).toBeVisible();
  await page.getByLabel("Wie haalt dit?").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await varianten(page, "p5-wie-haalt-dit", info);
  await page.keyboard.press("Escape");

  // 4. Meldingen (bel).
  await page.goto("/");
  await page.getByTestId("meldingen-bel").click();
  await expect(page.getByRole("dialog", { name: "Meldingen" })).toBeVisible();
  await varianten(page, "p5-meldingen", info);
  await page.keyboard.press("Escape");

  // 5. Instellingen › Suggesties en meldingen.
  await page.goto("/instellingen/suggesties#meldingen");
  await page
    .getByRole("region", { name: "Meldingen in de app" })
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await varianten(page, "p5-instellingen-meldingen", info);
});
