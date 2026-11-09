/**
 * Product- en UX-review na WP6: alle hoofdschermen op telefoon (390), tablet (768) en desktop
 * (1280). Alleen met SCHERMEN=1, alleen nepdata. Bestanden:
 * docs/foodloapp-v2/schermen/review/<project>-<nr>-<naam>.png (lokaal, niet in git).
 */
import type { Page } from "@playwright/test";
import { meldAan, resetDemo, test, zetKlok } from "./helpers";

test.skip(!process.env["SCHERMEN"], "alleen met SCHERMEN=1");
test.describe.configure({ timeout: 240_000 });

const RECEPT = "aaaaaaaa-0000-4000-8000-000000000001";

async function klaar(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(700);
}

async function foto(page: Page, project: string, naam: string) {
  await page.screenshot({ path: `docs/foodloapp-v2/schermen/review/${project}-${naam}.png` });
}

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
});

test("alle hoofdschermen", async ({ page }, info) => {
  const p = info.project.name;
  for (const [pad, naam] of [
    ["/", "01-vandaag"],
    ["/planner", "02-week"],
    ["/boodschappen", "03-lijst"],
    ["/aanvullen", "04-aanvullen"],
    ["/gerechten", "05-keuken"],
    [`/recepten/${RECEPT}`, "06-recept"],
    ["/voorraad", "07-voorraad"],
    ["/inspiratie", "08-ontdek"],
    ["/meer", "09-meer"],
  ] as const) {
    await page.goto(pad);
    await klaar(page);
    await foto(page, p, naam);
  }

  // Winkelmodus en "niet gevonden".
  await page.goto("/boodschappen");
  await klaar(page);
  const start = page.getByRole("button", { name: "Ik ga boodschappen doen" });
  if (await start.isVisible()) {
    await start.click();
    await page.waitForTimeout(500);
    await foto(page, p, "10-winkelmodus");
    const niet = page.getByRole("button", { name: / niet gevonden$/ }).first();
    if (await niet.isVisible()) {
      await niet.click();
      await page.getByLabel("Of vervangen door").fill("Diepvriesspinazie");
      await page.waitForTimeout(400);
      await foto(page, p, "11-niet-gevonden");
    }
  }

  // Instellingen: eetmomenten.
  await page.goto("/instellingen");
  await klaar(page);
  await page
    .getByRole("heading", { name: "Wanneer eet je?" })
    .scrollIntoViewIfNeeded()
    .catch(() => undefined);
  await page.waitForTimeout(300);
  await foto(page, p, "12-instellingen-eetmomenten");
});
