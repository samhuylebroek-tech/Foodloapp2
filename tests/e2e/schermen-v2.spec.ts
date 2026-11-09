/**
 * Schermafdrukken van de nieuwe navigatie en de Vandaag-ervaring (alleen met SCHERMEN=1).
 * Alleen nepdata (lokale nep-Supabase). Bestanden: docs/foodloapp-v2/schermen/v2/<project>-<naam>.png
 */
import type { Page } from "@playwright/test";
import { meldAan, resetDemo, test, zetKlok } from "./helpers";

test.skip(!process.env["SCHERMEN"], "alleen met SCHERMEN=1");
test.describe.configure({ timeout: 180_000 });

async function klaar(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(700);
}

async function foto(page: Page, project: string, naam: string, volledig = false) {
  const pad = `docs/foodloapp-v2/schermen/v2/${project}-${naam}`;
  await page.screenshot({ path: `${pad}.png` });
  if (volledig)
    await page.screenshot({
      path: `${pad}-volledig.png`,
      fullPage: true,
      style: 'nav[aria-label="Snelmenu"]{display:none!important}',
    });
}

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("vandaag en navigatie", async ({ page }, info) => {
  const p = info.project.name;
  await zetKlok(page, 14);
  // 1. Vandaag met een geplande maaltijd + aanvulkaart.
  await page.goto("/");
  await klaar(page);
  await foto(page, p, "01-vandaag-gepland", true);

  // 2. Het Nieuw-menu in de kop.
  await page.getByRole("button", { name: "Nieuw" }).click();
  await page.waitForTimeout(500);
  await foto(page, p, "02-nieuw-menu");
  await page.keyboard.press("Escape");

  // 3. De vijf plaatsen, elk actief.
  for (const [pad, naam] of [
    ["/planner", "03-week"],
    ["/boodschappen", "04-lijst"],
    ["/gerechten", "05-keuken-recepten"],
    ["/voorraad", "06-keuken-voorraad"],
    ["/inspiratie", "07-ontdek"],
  ] as const) {
    await page.goto(pad);
    await klaar(page);
    await foto(page, p, naam);
  }

  // 4. Vandaag zonder plan: "Wat eten we vandaag?" met voorstellen uit de voorraad.
  const vandaag = new Date().toLocaleDateString("sv-SE");
  await fetch(`http://127.0.0.1:54439/rest/v1/meal_plan?plan_date=eq.${vandaag}`, {
    method: "DELETE",
  });
  await page.goto("/");
  await klaar(page);
  await foto(page, p, "08-vandaag-leeg-voorstellen", true);

  // 5. Eén tik: "Kook … vanavond" → gepland, met melding en ongedaan maken.
  await page
    .getByRole("region", { name: "Met wat je in huis hebt" })
    .getByRole("button", { name: /^Kook .* vanavond$/ })
    .first()
    .click();
  await page.getByText(/staat op vanavond/).waitFor();
  await page.waitForTimeout(600);
  await foto(page, p, "09-vandaag-na-kook-vanavond");
});

test("rondleiding", async ({ page }, info) => {
  const p = info.project.name;
  await page.goto("/rondleiding");
  const venster = page.getByRole("dialog", { name: "Rondleiding" });
  for (let stap = 1; stap <= 7; stap++) {
    await venster.getByText(`Stap ${stap} van 7`).waitFor();
    await page.locator("[data-rondleiding-kader]").waitFor();
    await page.waitForTimeout(400);
    await foto(page, p, `10-rondleiding-${stap}`);
    await venster.getByRole("button", { name: stap === 7 ? "Klaar" : "Volgende" }).click();
  }
});

test("weekmenu → lijst (WP4)", async ({ page }, info) => {
  const p = info.project.name;
  await page.goto("/planner");
  await klaar(page);
  await foto(page, p, "20-weekmenu");
  const open = async (menu: string) => {
    await page.getByRole("button", { name: "Acties voor Stoofvlees met frietjes" }).first().click();
    await page.getByRole("menuitem", { name: menu }).waitFor();
    await page.waitForTimeout(300);
  };
  await open("Ander gerecht");
  await foto(page, p, "21-actiemenu");
  await page.getByRole("menuitem", { name: "Ander gerecht" }).click();
  const sheet = page.getByRole("dialog", { name: "Ander gerecht" });
  await sheet.waitFor();
  await page.waitForTimeout(600);
  await foto(page, p, "22-ander-gerecht");
  await sheet
    .getByRole("button", { name: /Romige pompoensoep/ })
    .first()
    .click();
  await page.getByText(/in plaats van Stoofvlees met frietjes/).waitFor();
  await page.waitForTimeout(500);
  await foto(page, p, "23-na-vervangen-melding");
  await page.goto("/boodschappen");
  await klaar(page);
  await foto(page, p, "24-lijst-na-vervangen", true);
});

test("Vandaag (WP3): de Nu-kaart in vijf situaties", async ({ page }, info) => {
  const p = info.project.name;
  const nu = page.locator("[data-nu]");
  // 14 u: voor vanavond ontbreekt iets.
  await zetKlok(page, 14);
  await page.goto("/");
  await nu.waitFor();
  await klaar(page);
  await foto(page, p, "30-nu-aanvullen", true);
  // Eén tik → winkelen; "Daarna" toont de rest van de week.
  await nu.getByRole("button", { name: "Zet op mijn lijst" }).click();
  await page.locator('[data-nu="winkelen"]').waitFor();
  await page.waitForTimeout(600);
  await foto(page, p, "31-nu-winkelen", true);
});

test("Vandaag (WP3): morgen, hervatten, niets gepland", async ({ page }, info) => {
  const p = info.project.name;
  await zetKlok(page, 22);
  await page.goto("/");
  await page.locator('[data-nu="morgen"]').waitFor();
  await klaar(page);
  await foto(page, p, "32-nu-morgen");
});

test("Vandaag (WP3): hervatten", async ({ page }, info) => {
  const p = info.project.name;
  await zetKlok(page, 17);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "foodlo:kookstand:aaaaaaaa-0000-4000-8000-000000000001",
      JSON.stringify({ stap: 1, tijd: Date.now() }),
    );
  });
  await page.goto("/");
  await page.locator('[data-nu="hervatten"]').waitFor();
  await klaar(page);
  await foto(page, p, "33-nu-hervatten");
});
