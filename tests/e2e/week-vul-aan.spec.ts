/**
 * Fase E (usecase 7): Week "Vul aan met voorstellen". Per lege dag één voorstel uit je eigen
 * recepten, met redenen; plannen per dag of alles samen, altijd met "Ongedaan maken"; dezelfde
 * veiligheidsregel; uit met "Slimme voorstellen". Nepdata (demo), volgende week (alle dagen leeg).
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test } from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const MET_GLUTEN = [
  "Stoofvlees met frietjes",
  "Witloof met hesp en kaassaus",
  "Spaghetti bolognese",
];

async function volgendeWeek(page: Page) {
  await page.goto("/planner");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible({ timeout: 60_000 });
  const weekKnop = page.getByRole("button", { name: /— kies een week in de kalender$/ });
  await expect(async () => {
    if ((await weekKnop.innerText()).startsWith("Deze week"))
      await page.getByRole("button", { name: "Volgende week", exact: true }).click();
    expect(await weekKnop.innerText()).toMatch(/^Volgende week/);
  }).toPass({ timeout: 30_000 });
  return page.getByRole("region", { name: "Vul aan met voorstellen" });
}

const geplandAantal = async () => ((await nepDb()).meal_plan ?? []).length;
const geplandeTitels = async (kaart: import("@playwright/test").Locator) =>
  (await kaart
    .getByRole("button", { name: /^Plan / })
    .evaluateAll((els) =>
      els.map((e) => (e.getAttribute("aria-label") ?? "").replace(/^Plan (.*) op .*$/, "$1")),
    )) as string[];

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await fetch(`${NEP}/meal_plan?id=neq.0`, { method: "DELETE" });
  await meldAan(page);
});

test("drie voorstellen met redenen; één plannen en ongedaan maken; daarna alles samen", async ({
  page,
  extern,
}) => {
  const kaart = await volgendeWeek(page);
  await expect(kaart).toBeVisible({ timeout: 30_000 });
  await expect(kaart.getByRole("listitem")).toHaveCount(3);
  for (const r of await kaart.locator("[data-redenen]").allInnerTexts())
    expect(r.trim().length).toBeGreaterThan(0);
  expect(await axeErnstig(page)).toEqual([]);

  const eerste = kaart.getByRole("button", { name: /^Plan / }).first();
  const titel = ((await eerste.getAttribute("aria-label")) ?? "").replace(
    /^Plan (.*) op .*$/,
    "$1",
  );
  await eerste.click();
  await expect.poll(geplandAantal).toBe(1);
  // De dag is gevuld: dat gerecht staat niet meer als voorstel op de kaart.
  await expect.poll(() => geplandeTitels(kaart)).not.toContain(titel);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(geplandAantal).toBe(0);

  await kaart.getByRole("button", { name: /^Zet ze alle \d in je weekmenu$/ }).click();
  await expect.poll(geplandAantal).toBe(3);
  const recepten = new Set(((await nepDb()).meal_plan ?? []).map((p) => p["recipe_id"]));
  expect(recepten.size).toBe(3);
  void extern;
});

test("glutenallergie: nooit een gerecht met gluten op de kaart", async ({ page, extern }) => {
  await page.addInitScript(
    ([id]) =>
      window.localStorage.setItem(
        `foodlo:kennismaking:${id}`,
        JSON.stringify({ allergieen: ["gluten"] }),
      ),
    [DEMO_USER_ID],
  );
  const kaart = await volgendeWeek(page);
  await expect(kaart.getByRole("listitem").first()).toBeVisible({ timeout: 30_000 });
  const titels = await geplandeTitels(kaart);
  expect(titels.length).toBeGreaterThan(0);
  for (const t of MET_GLUTEN) expect(titels).not.toContain(t);
  void extern;
});

test("Niet nu haalt een voorstel weg, Ongedaan maken zet het terug", async ({ page, extern }) => {
  const kaart = await volgendeWeek(page);
  const knop = kaart.getByRole("button", { name: /^Niet nu: / }).first();
  await expect(knop).toBeVisible({ timeout: 30_000 });
  const titel = ((await knop.getAttribute("aria-label")) ?? "").replace(/^Niet nu: /, "");
  await knop.click();
  await expect.poll(() => geplandeTitels(kaart)).not.toContain(titel);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(() => geplandeTitels(kaart)).toContain(titel);
  void extern;
});

test("Slimme voorstellen uit: geen kaart; Laat Foodlo kiezen blijft", async ({ page, extern }) => {
  await page.goto("/instellingen");
  await page.getByRole("switch", { name: "Slimme voorstellen" }).click();
  await volgendeWeek(page);
  await page.waitForTimeout(1500);
  await expect(page.getByRole("region", { name: "Vul aan met voorstellen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Laat Foodlo kiezen" }).first()).toBeVisible();
  void extern;
});

test("320 px en tekst 200 %: kaart loopt niet uit", async ({ page, extern }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
  const kaart = await volgendeWeek(page);
  await expect(kaart.getByRole("listitem").first()).toBeVisible({ timeout: 30_000 });
  await kaart.scrollIntoViewIfNeeded();
  const uit = await kaart.evaluate((k) => {
    const w = document.documentElement.clientWidth;
    return {
      scroll: document.documentElement.scrollWidth - w,
      te: [k, ...k.querySelectorAll("*")]
        .filter((e) => e.getBoundingClientRect().right > w + 1)
        .map((e) => `${e.tagName} "${(e.textContent ?? "").trim().slice(0, 30)}"`)
        .slice(0, 5),
    };
  });
  expect(uit).toEqual({ scroll: 0, te: [] });
  void extern;
});
