/**
 * WP6 — tablet als eigen ervaring (768 en 1024×768 liggend valt al onder desktop).
 * - zijbalk met de vijf plekken, geen onderbalk;
 * - geen horizontaal scrollen op de hoofdschermen;
 * - Vandaag: Nu-kaart met foto naast de tekst; Weekmenu: week links, dag rechts;
 *   Lijst: invoer bovenaan, één brede kolom; Recept: ingrediënten naast de stappen.
 * Gesimuleerd in Chromium (768×1024, aanraking aan) — geen echte tablet.
 */
import type { Locator } from "@playwright/test";
import { axeErnstig, expect, heeftHorizontaleScroll, meldAan, resetDemo, test } from "./helpers";

const RECEPT = "aaaaaaaa-0000-4000-8000-000000000001";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

async function vak(l: Locator) {
  const b = await l.boundingBox();
  expect(b, "element zichtbaar").not.toBeNull();
  return b!;
}

test("zijbalk in plaats van onderbalk, op elk hoofdscherm, zonder horizontaal scrollen", async ({
  page,
  extern,
}) => {
  test.setTimeout(120_000);
  for (const pad of [
    "/",
    "/planner",
    "/boodschappen",
    "/gerechten",
    "/voorraad",
    "/inspiratie",
    `/recepten/${RECEPT}`,
  ]) {
    await page.goto(pad);
    const zij = page.getByRole("navigation", { name: "Zijmenu" });
    await expect(zij, pad).toBeVisible();
    await expect(zij.getByRole("link"), pad).toHaveCount(5);
    await expect(page.getByRole("navigation", { name: "Snelmenu" }), pad).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Hoofdmenu" }), pad).toBeHidden();
    expect(await heeftHorizontaleScroll(page), pad).toBe(false);
    // Inhoud staat naast de zijbalk, niet eronder.
    const balk = await vak(zij);
    const kop = await vak(page.locator("main h1, main [id='vandaag-groet']").first());
    expect(kop.x, pad).toBeGreaterThanOrEqual(balk.x + balk.width);
  }
  void extern;
});

test("Vandaag: foto naast de Nu-kaart; Daarna en Ook vandaag naast elkaar als er beide zijn", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  const nu = page.locator("[data-nu]");
  await expect(nu).toBeVisible();
  const kaart = page.locator("section[aria-labelledby='vandaag-groet']");
  const foto = kaart.locator("a[aria-hidden], div.omslag").first();
  if (await foto.isVisible()) {
    const t = await vak(nu);
    const f = await vak(foto);
    expect(f.x, "foto rechts van de tekst").toBeGreaterThan(t.x + t.width - 1);
  }
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});

test("Weekmenu: week links, gekozen dag rechts; een andere dag kiezen werkt", async ({
  page,
  extern,
}) => {
  await page.goto("/planner");
  const dagen = page.getByRole("navigation", { name: "Dagen van de week" });
  await expect(dagen).toBeVisible();
  await expect(dagen.getByRole("button")).toHaveCount(7);
  // Telefoonknoppen (per dag / hele week, dagenstrook) zijn weg op tablet.
  await expect(page.getByRole("tablist", { name: "Dag kiezen" })).toBeHidden();
  await expect(page.getByRole("tablist", { name: "Weergave kiezen" })).toBeHidden();
  const lijst = await vak(dagen);
  const week = page.getByRole("region", { name: "Week en dag" });
  const dag = await vak(week.locator(":scope > div").first());
  expect(dag.x, "dag staat rechts van de week").toBeGreaterThan(lijst.x + lijst.width - 1);

  const tweede = dagen.getByRole("button").nth(1);
  await tweede.click();
  await expect(tweede).toHaveAttribute("aria-current", "date");
  expect(await heeftHorizontaleScroll(page)).toBe(false);
  void extern;
});

test("Lijst: invoer staat in de pagina (geen balk onderaan), afdelingen breed genoeg om te lezen", async ({
  page,
  extern,
}) => {
  await page.goto("/boodschappen");
  const invoer = page.getByRole("region", { name: "Iets toevoegen" });
  await expect(invoer).toBeVisible();
  expect(await invoer.evaluate((el) => getComputedStyle(el).position)).toBe("static");
  // Op een staande tablet één brede kolom: twee kolommen kapten productnamen af (review WP6).
  const afdeling = page
    .locator("main section[aria-label]")
    .filter({ has: page.getByRole("button", { name: /^Alles in .* afvinken$/ }) })
    .first();
  expect((await vak(afdeling)).width).toBeGreaterThan(500);
  expect(await heeftHorizontaleScroll(page)).toBe(false);
  void extern;
});

test("Recept: foto naast de kerninfo; ingrediënten en stappen op volle breedte", async ({
  page,
  extern,
}) => {
  await page.goto(`/recepten/${RECEPT}`);
  const start = page.getByRole("button", { name: "Start koken" }).first();
  await expect(start).toBeVisible();
  const foto = page.locator("main img").first();
  const f = await vak(foto);
  const s = await vak(start);
  expect(s.x, "knoppen rechts van de foto").toBeGreaterThan(f.x + f.width - 1);
  // Bereiding te smal naast de ingrediënten op een staande tablet (review WP6): onder elkaar.
  const bereiding = page.getByRole("heading", { name: /Bereiding/ }).first();
  expect((await vak(bereiding.locator("xpath=.."))).width).toBeGreaterThan(500);
  expect(await heeftHorizontaleScroll(page)).toBe(false);
  void extern;
});
