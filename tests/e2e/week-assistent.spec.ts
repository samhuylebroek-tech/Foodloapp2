/**
 * P4 — Assistent met acties (nep-databank, demo, geen AI-sleutel, geen echte AI).
 * - "Maak mijn week goedkoper" → verschillen → Doe maar → menu en lijst gewijzigd → Ongedaan
 *   maken zet alles terug.
 * - "Vervang <dag>" met het hele gezin (Gust is vegetarisch) → een vegetarisch voorstel.
 * - "Ik heb morgen 15 minuten" → een snel gerecht.
 * - "Nee" verandert niets. Lottes reden (niet gedeeld) staat nergens.
 */
import type { Page } from "@playwright/test";
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test, zetKlok } from "./helpers";

const WEEKDAG = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const dag = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
};
const iso = (d: Date) => d.toLocaleDateString("sv-SE");

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await zetKlok(page, 14);
});

async function menu() {
  const db = await nepDb();
  return (db["meal_plan"] ?? [])
    .map(
      (r) =>
        `${String(r["plan_date"])}|${String(r["meal_type"])}|${String(r["recipe_id"])}|${String(r["personen"])}`,
    )
    .sort();
}
async function lijst() {
  const db = await nepDb();
  return (db["shopping_items"] ?? [])
    .map(
      (r) =>
        `${String(r["name"])}|${String(r["quantity"])}|${String(r["unit"])}|${String(r["checked"])}`,
    )
    .sort();
}

async function vraag(page: Page, zin: string) {
  const veld = page.getByRole("textbox", { name: "Of typ zelf wat je wilt veranderen" });
  await veld.fill(zin);
  await page.getByRole("button", { name: "Vraag", exact: true }).click();
  return page.locator("[data-voorstel]").last();
}

test("vanaf Week: context, voorbeeldvragen, zonder AI; goedkoper → Doe maar → ongedaan maken", async ({
  page,
  extern,
}) => {
  await page.goto("/planner");
  await page.getByRole("link", { name: "Vraag de assistent" }).click();
  await expect(page).toHaveURL(/\/assistent/);
  await expect(page.getByTestId("assistent-context")).toContainText(
    /Week \d+ · \d+ gerechten? gepland/,
  );
  const voorbeelden = page.getByRole("list", { name: "Voorbeeldvragen" });
  await expect(voorbeelden.getByRole("button")).toHaveCount(6);
  expect(await axeErnstig(page)).toEqual([]);

  const menuVoor = await menu();
  const lijstVoor = await lijst();
  await voorbeelden.getByRole("button", { name: "Maak mijn week goedkoper" }).click();
  const kaart = page.locator("[data-voorstel]").last();
  await expect(page.getByText("Ik begreep: Je week goedkoper maken.")).toBeVisible();
  await expect(page.getByText("Zonder AI: vaste regels van Foodlo").first()).toBeVisible();
  await expect(kaart.getByRole("heading", { name: "Zo wordt je week goedkoper" })).toBeVisible();
  const wissels = kaart
    .getByRole("list", { name: "Wat er verandert in je weekmenu" })
    .getByRole("listitem");
  await expect(wissels.first()).toContainText("→");
  await expect(wissels.first()).toContainText(/goedkoper/);
  await expect(kaart.getByText("Boodschappenlijst")).toBeVisible();
  const kost = Number(await kaart.locator("[data-kostverschil]").getAttribute("data-kostverschil"));
  expect(kost).toBeLessThan(0);
  // Lotte deelt haar allergie niet: geen reden in beeld.
  await expect(page.locator("main")).not.toContainText(/noten|bevat mogelijk/i);
  expect(await axeErnstig(page)).toEqual([]);

  // Nog niets veranderd vóór "Doe maar".
  expect(await menu()).toEqual(menuVoor);
  await kaart.getByRole("button", { name: "Doe maar" }).click();
  await expect(kaart.getByRole("status")).toContainText("Gedaan");
  await expect.poll(menu).not.toEqual(menuVoor);
  await expect.poll(lijst).not.toEqual(lijstVoor);

  await kaart.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(
    kaart.getByText("Teruggezet: je weekmenu en je lijst staan weer zoals ervoor."),
  ).toBeVisible();
  await expect.poll(menu).toEqual(menuVoor);
  await expect.poll(lijst).toEqual(lijstVoor);
  expect(extern).toEqual([]);
});

test("vervang een dag met het hele gezin (Gust is vegetarisch): vegetarisch voorstel", async ({
  page,
  extern,
}) => {
  const d = dag(2); // spaghetti bolognese in de demo
  const naam = WEEKDAG[d.getDay()]!;
  await page.goto("/assistent?van=vandaag");
  const kaart = await vraag(page, `vervang ${naam}`);
  await expect(
    kaart.getByRole("heading", { name: `Een ander gerecht voor ${naam}` }),
  ).toBeVisible();
  const rij = kaart.locator(`[data-dag="${iso(d)}"]`);
  await expect(rij).toContainText("Spaghetti bolognese");
  await expect(rij).toContainText("past voor iedereen die meeëet");
  await expect(kaart.getByText(/Marie, Jan, Lotte en Gust/)).toBeVisible();
  await kaart.getByRole("button", { name: "Doe maar" }).click();
  await expect(kaart.getByRole("status")).toContainText("Gedaan");
  const db = await nepDb();
  const plan = (db["meal_plan"] ?? []).find(
    (r) => r["plan_date"] === iso(d) && r["meal_type"] === "avondeten",
  );
  const recept = (db["recipes"] ?? []).find((r) => r["id"] === plan?.["recipe_id"]);
  expect(recept?.["title"]).not.toBe("Spaghetti bolognese");
  expect(recept?.["tags"] as string[]).toContain("vegetarisch");
  expect(extern).toEqual([]);
});

test("ik heb morgen 15 minuten: een snel gerecht; 'Nee' verandert niets", async ({
  page,
  extern,
}) => {
  await page.goto("/assistent?van=week");
  const voor = await menu();
  const kaart = await vraag(page, "Ik heb morgen 15 minuten");
  await expect(kaart.getByRole("heading", { name: "Iets snels voor morgen" })).toBeVisible();
  await expect(kaart).toContainText("Zalm met citroen en dille");
  await expect(kaart).toContainText(/Klaar in (\d|1[0-5]) min/);
  await kaart.getByRole("button", { name: "Nee, laat maar" }).click();
  await expect(kaart.getByText("Oké, er is niets veranderd.")).toBeVisible();
  await expect(kaart.getByRole("button", { name: "Doe maar" })).toHaveCount(0);
  expect(await menu()).toEqual(voor);
  expect(extern).toEqual([]);
});

test("niet begrepen: uitleg en voorbeelden; vraag via link (?vraag=) vanaf Lijst", async ({
  page,
}) => {
  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "Meer opties voor deze lijst" }).click();
  await page.getByRole("link", { name: "Vraag de assistent" }).click();
  await expect(page.getByRole("link", { name: "Terug naar je lijst" })).toBeVisible();
  await vraag(page, "hoe laat is het");
  await expect(page.getByText("Dat begrijp ik (nog) niet.")).toBeVisible();
  await expect(page.locator("[data-voorstel]")).toHaveCount(0);

  await page.goto(`/assistent?vraag=${encodeURIComponent("wat kan ik maken met pompoen")}`);
  const kaart = page.locator("[data-voorstel]").last();
  await expect(kaart.getByRole("list", { name: "Ideeën uit je recepten" })).toContainText(
    "Romige pompoensoep",
  );
  await expect(kaart.getByRole("button", { name: "Doe maar" })).toHaveCount(0);
});
