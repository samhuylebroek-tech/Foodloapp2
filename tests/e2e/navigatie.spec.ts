/**
 * WP1 — vijf vaste plekken (Vandaag · Week · Lijst · Keuken · Ontdek).
 * Per route: precies één actieve plek (of geen, bij Meer-schermen), terugknop alleen
 * op onderliggende schermen, en de rondleiding wijst elk onderdeel zichtbaar aan.
 * Draait op telefoon (390), tablet (768) en desktop (1280).
 */
import { axeErnstig, expect, meldAan, resetDemo, test } from "./helpers";

const RECEPT = "aaaaaaaa-0000-4000-8000-000000000001";
const VERWACHT: [string, string | null, boolean][] = [
  // pad, actieve plek, terugknop?
  ["/", "Vandaag", false],
  ["/planner", "Week", false],
  ["/boodschappen", "Lijst", false],
  ["/aanvullen", "Lijst", true],
  ["/gerechten", "Keuken", false],
  ["/voorraad", "Keuken", false],
  [`/recepten/${RECEPT}`, "Keuken", true],
  ["/recepten/nieuw", "Keuken", true],
  ["/inspiratie", "Ontdek", false],
  ["/meer", null, false],
  ["/instellingen", null, true],
  ["/gezin", null, true],
  ["/kaarten", null, true],
];

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("elke route: juiste plek actief en terugknop alleen waar nodig", async ({ page, extern }) => {
  test.setTimeout(120_000);
  // Telefoon: onderbalk; tablet (768–1023): zijbalk (WP6); desktop: hoofdmenu bovenaan.
  const breedte = page.viewportSize()?.width ?? 0;
  const naam = breedte < 768 ? "Snelmenu" : breedte < 1024 ? "Zijmenu" : "Hoofdmenu";
  const menu = page.getByRole("navigation", { name: naam });
  for (const [pad, plek, terug] of VERWACHT) {
    await page.goto(pad);
    await expect(menu).toBeVisible();
    const actief = menu.locator('[aria-current="page"]');
    if (plek) {
      await expect(actief, pad).toHaveCount(1);
      await expect(actief, pad).toContainText(plek);
    } else {
      await expect(actief, pad).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: "Terug", exact: true }), pad).toHaveCount(
      terug ? 1 : 0,
    );
  }
  // Vijf plekken, altijd met tekst.
  await expect(menu.getByRole("link")).toHaveCount(5);
  void extern;
});

test("Keuken: recepten en voorraad één tik van elkaar, voorraad stuurt naar recepten", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: /^Keuken/ })
    .first()
    .click();
  const keuken = page.getByRole("navigation", { name: "Keuken" });
  await expect(keuken.getByRole("link", { name: "Recepten" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await keuken.getByRole("link", { name: "Voorraad" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Voorraadkast" })).toBeVisible();
  // Vanuit de voorraad naar een recept dat je ermee kan maken.
  await page
    .getByRole("list", { name: "Recepten met wat je in huis hebt" })
    .getByRole("link")
    .first()
    .click();
  await expect(page).toHaveURL(/\/recepten\//);
  void extern;
});

test("rondleiding: zeven stappen, elk onderdeel zichtbaar aangewezen en niet bedekt", async ({
  page,
  extern,
}) => {
  test.setTimeout(120_000);
  await page.goto("/rondleiding");
  const venster = page.getByRole("dialog", { name: "Rondleiding" });
  for (let stap = 1; stap <= 7; stap++) {
    await expect(venster.getByText(`Stap ${stap} van 7`)).toBeVisible();
    const kader = page.locator("[data-rondleiding-kader]");
    await expect(kader, `stap ${stap} wijst iets aan`).toBeVisible();
    const k = (await kader.boundingBox())!;
    const c = (await page.locator("[data-rondleiding-kaart]").boundingBox())!;
    const overlapt = !(k.y + k.height <= c.y || c.y + c.height <= k.y);
    expect(overlapt, `stap ${stap}: uitleg bedekt het aangewezen onderdeel`).toBe(false);
    if (stap === 1) expect(await axeErnstig(page)).toEqual([]);
    await venster.getByRole("button", { name: stap === 7 ? "Klaar" : "Volgende" }).click();
  }
  await expect(venster).toHaveCount(0);
  void extern;
});
