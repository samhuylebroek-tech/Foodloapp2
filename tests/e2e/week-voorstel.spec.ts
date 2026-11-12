/**
 * Foodloapp Intelligence I-1 in Week: "Laat Foodlo kiezen" volgt dezelfde harde regels als
 * Vandaag (nooit een gekozen allergeen) en toont per voorstel redenen. Nepdata (demo).
 */
import { DEMO_USER_ID } from "./demo-data.mjs";
import { axeErnstig, expect, meldAan, resetDemo, test } from "./helpers";

// Gerechten uit de demo met gluten (bloem, bier, peperkoek, spaghetti).
const MET_GLUTEN = [
  "Stoofvlees met frietjes",
  "Witloof met hesp en kaassaus",
  "Spaghetti bolognese",
];

async function voorstelDoorlopen(page: import("@playwright/test").Page) {
  await page.goto("/planner");
  // Week wordt nooit helemaal stil op het netwerk (zelfde aanpak als weekmenu-lijst.spec.ts).
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible({ timeout: 60_000 });
  // Volgende week: alle 7 dagen liggen nog voor ons (geen nepklok nodig).
  // Alleen opnieuw tikken zolang we nog op "Deze week" staan (een tik vóór de pagina klaar is, doet niets).
  const weekKnop = page.getByRole("button", { name: /— kies een week in de kalender$/ });
  await expect(async () => {
    if ((await weekKnop.innerText()).startsWith("Deze week"))
      await page.getByRole("button", { name: "Volgende week", exact: true }).click();
    expect(await weekKnop.innerText()).toMatch(/^Volgende week/);
  }).toPass({ timeout: 30_000 });
  // Tikken vóór de pagina interactief is, doet niets: opnieuw tot de vraagstap open is.
  const knoppen = page.getByRole("button", { name: "Laat Foodlo kiezen" });
  await expect(async () => {
    if ((await knoppen.count()) < 2) await knoppen.first().click();
    expect(await knoppen.count()).toBe(2);
  }).toPass({ timeout: 30_000 });
  // Vraagstap: opnieuw "Laat Foodlo kiezen" maakt het voorstel.
  await knoppen.last().click();
  await expect(page.getByText(/^Dag 1 van \d+$/)).toBeVisible({ timeout: 30_000 });
  const totaal = Number((await page.getByText(/^Dag 1 van \d+$/).innerText()).split(" ").at(-1));
  const titels: string[] = [];
  let redenen = 0;
  for (let n = 0; n < totaal; n++) {
    const kop = page.locator("h4").first();
    titels.push((await kop.innerText()).trim());
    if (await page.locator("[data-redenen]").count()) redenen++;
    if (n < totaal - 1)
      await page.getByRole("button", { name: "Volgende dag", exact: true }).click();
  }
  return { titels, redenen };
}

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  // Lege week, zodat elke dag een voorstel krijgt.
  await fetch("http://127.0.0.1:54439/rest/v1/meal_plan?id=neq.0", { method: "DELETE" });
  await meldAan(page);
});

test("zonder allergie: voorstellen uit je recepten, met redenen", async ({ page, extern }) => {
  const { titels, redenen } = await voorstelDoorlopen(page);
  expect(titels.length).toBeGreaterThan(0);
  expect(redenen).toBeGreaterThan(0);
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});

test("allergie gluten (kennismaking): nooit een gerecht met gluten voorgesteld", async ({
  page,
  extern,
}) => {
  await page.addInitScript(
    ([id]) => {
      window.localStorage.setItem(
        `foodlo:kennismaking:${id}`,
        JSON.stringify({ allergieen: ["gluten"] }),
      );
    },
    [DEMO_USER_ID],
  );
  const { titels } = await voorstelDoorlopen(page);
  for (const t of MET_GLUTEN) expect(titels).not.toContain(t);
  void extern;
});

test("dieet vegetarisch (kennismaking): geen vlees of vis voorgesteld", async ({
  page,
  extern,
}) => {
  await page.addInitScript(
    ([id]) => {
      window.localStorage.setItem(
        `foodlo:kennismaking:${id}`,
        JSON.stringify({ allergieen: [], dieet: "vegetarisch" }),
      );
    },
    [DEMO_USER_ID],
  );
  const { titels } = await voorstelDoorlopen(page);
  expect(titels.length).toBeGreaterThan(0);
  for (const t of [
    "Stoofvlees met frietjes",
    "Zalm met citroen en dille",
    "Spaghetti bolognese",
    "Witloof met hesp en kaassaus",
  ])
    expect(titels).not.toContain(t);
  void extern;
});
