/**
 * P6 — Toegankelijkheid van de schermen die in P1–P5 nieuw zijn: axe (WCAG 2.2 A/AA) zonder
 * ernstige of kritieke meldingen, een toetsenbordroute met zichtbare focus, en bevestigingen
 * die een schermlezer voorleest (aria-live).
 *
 * Draait in desktop en mobiel-390 (naam begint met "a11y-"). Chromium + axe-core vervangt geen
 * test met VoiceOver of TalkBack op een echt toestel.
 */
import type { Browser, Locator, Page } from "@playwright/test";
import { axeErnstig, expect, meldAan, resetDemo, seedDb, test, zetKlok } from "./helpers";

test.describe.configure({ timeout: 300_000 });

const R = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const JAN = "22222222-2222-4222-8222-222222222222";
const GEZIN = "abababab-0000-4000-8000-000000000001";

async function wacht(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, {
      timeout: 15_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

/** Heeft het element met focus een zichtbare focusrand (outline of ring via box-shadow)? */
async function zichtbareFocus(l: Locator) {
  return l.evaluate((el) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
    const ring = s.boxShadow !== "none" && s.boxShadow !== "";
    return outline || ring;
  });
}

/** Ligt de tekst in een voorleesgebied (aria-live / status / alert)? */
async function voorgelezen(page: Page, tekst: RegExp | string) {
  const m = page.getByText(tekst).first();
  await expect(m).toBeVisible({ timeout: 30_000 });
  return m.evaluate((el) => !!el.closest("[aria-live], [role=status], [role=alert]"));
}

test("nieuwe schermen P1–P5: geen ernstige axe-meldingen", async ({ page, extern }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  const fouten: string[] = [];
  const meet = async (naam: string) => {
    await wacht(page);
    for (const a of await axeErnstig(page)) fouten.push(`${naam}: ${a}`);
  };

  // P1 week samenstellen (start en voorstel) en Mijn keuken.
  await page.goto("/week-samenstellen");
  await expect(page.getByRole("heading", { name: "Stel je week samen", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
  await meet("week-samenstellen");
  await page.getByRole("button", { name: /^Stel mijn menu samen/ }).click();
  await expect(page.getByRole("button", { name: "Bewaar dit menu" })).toBeVisible({
    timeout: 30_000,
  });
  await meet("week-samenstellen (voorstel)");
  await page.goto("/mijn-keuken");
  await expect(page.getByRole("button", { name: "Bewaar mijn keuken" })).toBeVisible({
    timeout: 30_000,
  });
  await meet("mijn-keuken");

  // P2/P5 lijst-details: product aanpassen (met "Wie haalt dit?") op de gezinslijst.
  await page.goto("/boodschappen?lijst=gezin");
  await expect(page.getByRole("button", { name: /Mijn deel/ })).toBeVisible({ timeout: 30_000 });
  await meet("gezinslijst (Hele lijst / Mijn deel)");
  await page.getByRole("button", { name: "appels aanpassen" }).click();
  await expect(page.getByRole("dialog").getByLabel("Wie haalt dit?")).toBeVisible();
  await meet("lijst-details (product aanpassen)");
  await page.keyboard.press("Escape");

  // P3 versies: eerst een versie maken via "Bewaar voor 6 personen".
  await page.goto(`/recepten/${R(8)}`);
  const ingr = page.getByRole("region", { name: "Ingrediënten" });
  await ingr.getByRole("button", { name: "Meer personen" }).click();
  await ingr.getByRole("button", { name: "Meer personen" }).click();
  await ingr.getByRole("button", { name: "Bewaar voor 6 personen" }).click();
  await page.getByRole("button", { name: /^Versies \(\d+\)$/ }).click();
  await expect(page.getByRole("dialog", { name: "Versies" })).toBeVisible();
  await meet("versies");
  await page.keyboard.press("Escape");

  // P3 klaar met koken.
  await page.goto(`/recepten/${R(3)}`);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Klaar met koken" }).click();
  await expect(page.getByRole("group", { name: "Blijft er iets over?" })).toBeVisible();
  await meet("klaar met koken");

  // P4 assistent-gesprek en suggesties-instellingen.
  await page.goto("/assistent?van=week");
  const veld = page.getByRole("textbox", { name: "Of typ zelf wat je wilt veranderen" });
  await veld.fill("maak mijn week goedkoper");
  await page.getByRole("button", { name: "Vraag", exact: true }).click();
  await expect(page.locator("[data-voorstel]").last()).toBeVisible({ timeout: 30_000 });
  await meet("assistent-gesprek");
  await page.goto("/instellingen/suggesties");
  await expect(page.getByText("Meldingen in de app").first()).toBeVisible({ timeout: 30_000 });
  await meet("suggesties-instellingen");

  // P5 meldingen (bel) en de pagina Herinneringen.
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Meldingen/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Meldingen" })).toBeVisible();
  await meet("meldingen (bel)");
  await page.keyboard.press("Escape");
  await page.goto("/meldingen");
  await expect(page.getByRole("heading", { name: "Herinneringen", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await meet("herinneringen");

  expect(fouten).toEqual([]);
  void extern;
});

test("conflictmelding (twee browsers): geen ernstige axe-meldingen, keuze met toetsenbord", async ({
  page,
  extern,
}) => {
  await resetDemo();
  const PLAN = "c5c5c5c5-0000-4000-8000-000000000001";
  await seedDb({
    meal_plan: [
      {
        id: PLAN,
        user_id: "11111111-1111-4111-8111-111111111111",
        group_id: GEZIN,
        recipe_id: R(1),
        custom_title: null,
        soort: null,
        personen: 4,
        plan_date: new Date().toLocaleDateString("sv-SE"),
        meal_type: "avondeten",
        created_at: "2026-11-01T10:00:00Z",
      },
    ],
  });
  await meldAan(page);
  const browser = page.context().browser() as Browser;
  const ctx = await browser.newContext({
    baseURL: "http://127.0.0.1:4339",
    locale: "nl-BE",
    timezoneId: "Europe/Brussels",
    viewport: page.viewportSize() ?? { width: 412, height: 915 },
  });
  const jan = await ctx.newPage();
  await jan.route("**/*", (route) =>
    ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  await meldAan(jan, JAN);
  try {
    const kies = async (p: Page, nieuw: string) => {
      await p.goto("/planner?weergave=gezin");
      await p
        .getByRole("button", { name: "Acties voor Stoofvlees met frietjes" })
        .filter({ visible: true })
        .first()
        .click();
      await p.getByRole("menuitem", { name: "Ander gerecht" }).click();
      const blad = p.getByRole("dialog", { name: "Ander gerecht" });
      await blad.getByRole("textbox", { name: "Zoek in je recepten" }).fill(nieuw);
      return blad.getByRole("button", { name: new RegExp(nieuw, "i") }).first();
    };
    const marie = await kies(page, "Griekse salade");
    await (await kies(jan, "Romige pompoensoep")).click();
    await page.waitForTimeout(500);
    await marie.click();
    const keuze = page.getByTestId("conflict-keuze");
    await expect(keuze).toBeVisible({ timeout: 30_000 });
    await wacht(page);
    expect(await axeErnstig(page)).toEqual([]);
    // Toetsenbord: "Houd die van Jan" bereikbaar, met zichtbare focus, Enter werkt.
    const houd = keuze.getByRole("button", { name: "Houd die van Jan" });
    await houd.focus();
    await expect(houd).toBeFocused();
    expect(await zichtbareFocus(houd)).toBe(true);
    await page.keyboard.press("Enter");
    await expect(keuze).toBeHidden();
  } finally {
    await ctx.close();
  }
  void extern;
});

test("toetsenbordroute week samenstellen: Tab bereikt de hoofdknop met zichtbare focus; bevestiging wordt voorgelezen", async ({
  page,
  extern,
}) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/week-samenstellen");
  const hoofd = page.getByRole("button", { name: /^Stel mijn menu samen/ });
  await expect(hoofd).toBeVisible({ timeout: 60_000 });
  await wacht(page);
  // Alleen met Tab (max. 120 stappen) naar de hoofdknop.
  let gevonden = false;
  for (let i = 0; i < 120 && !gevonden; i++) {
    await page.keyboard.press("Tab");
    gevonden = await hoofd.evaluate((el) => el === document.activeElement);
  }
  expect(gevonden, "de hoofdknop is met Tab bereikbaar").toBe(true);
  expect(await zichtbareFocus(hoofd)).toBe(true);
  await page.keyboard.press("Enter");
  const bewaar = page.getByRole("button", { name: "Bewaar dit menu" });
  await expect(bewaar).toBeVisible({ timeout: 30_000 });
  await bewaar.focus();
  expect(await zichtbareFocus(bewaar)).toBe(true);
  await page.keyboard.press("Enter");
  const vraag = page.getByRole("alertdialog");
  if (await vraag.isVisible().catch(() => false))
    await vraag.getByRole("button", { name: /^Ja/ }).click();
  expect(await voorgelezen(page, /Menu bewaard/)).toBe(true);
  void extern;
});

test("offline-melding wordt voorgelezen (role=status) en verdwijnt na herstel", async ({
  page,
  context,
  extern,
}) => {
  await resetDemo();
  await meldAan(page);
  await page.goto("/boodschappen");
  await expect(page.getByText("donker bier").first()).toBeVisible({ timeout: 30_000 });
  const band = page.getByTestId("offline-band");
  await expect(band).toHaveAttribute("role", "status");
  await context.setOffline(true);
  await expect(band).toContainText("Je bent offline");
  await wacht(page);
  expect(await axeErnstig(page)).toEqual([]);
  await context.setOffline(false);
  await expect(band).not.toContainText("offline");
  void extern;
});
