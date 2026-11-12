/**
 * Fase B (modulair en optioneel): "Slimme voorstellen" aan/uit in Instellingen, en een nieuwe
 * gebruiker zonder recepten, voorraad, gezin of kennismaking die elke plek gewoon kan gebruiken.
 * Nepdata in Chromium.
 */
import type { Page } from "@playwright/test";
import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  meldAan,
  resetDemo,
  resetNep,
  test,
  zetKlok,
} from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const vandaag = () => new Date().toLocaleDateString("sv-SE");

async function schakel(page: Page, aan: boolean) {
  await page.goto("/instellingen");
  const knop = page.getByRole("switch", { name: "Slimme voorstellen" });
  await expect(knop).toBeVisible({ timeout: 30_000 });
  if ((await knop.getAttribute("aria-checked")) !== String(aan)) await knop.click();
  await expect(knop).toHaveAttribute("aria-checked", String(aan));
}

test.describe.configure({ timeout: 120_000 });

test("Slimme voorstellen uit: geen voorstellen op Vandaag of in de winkel; weer aan: terug", async ({
  page,
  extern,
}) => {
  await resetDemo();
  await fetch(`${NEP}/meal_plan?plan_date=eq.${vandaag()}`, { method: "DELETE" });
  await meldAan(page);
  await zetKlok(page, 17);
  const voorstellen = page.getByRole("region", {
    name: /Met wat je in huis hebt|Ideeën voor vanavond/,
  });

  await page.goto("/");
  await expect(voorstellen.getByRole("button", { name: /^Niet nu: / }).first()).toBeVisible({
    timeout: 30_000,
  });

  await schakel(page, false);
  expect(await axeErnstig(page)).toEqual([]);

  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByText("Wat eten we vandaag?")).toBeVisible();
  await expect(voorstellen).toHaveCount(0);
  // Zelf kiezen blijft altijd mogelijk.
  await expect(page.getByRole("link", { name: "Gerecht kiezen" })).toBeVisible();

  // Morgen staat er iets gepland waarvoor nog niet alles op de lijst staat; uit = geen melding.
  await page.goto("/boodschappen");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.getByRole("button", { name: "Ik ga winkelen" }).click();
  await expect(page.getByRole("button", { name: / niet gevonden$/ }).first()).toBeVisible();
  await expect(page.getByText(/nog nodig:/)).toHaveCount(0);
  await page.keyboard.press("Escape");

  await schakel(page, true);
  await page.goto("/");
  await expect(voorstellen.getByRole("button", { name: /^Niet nu: / }).first()).toBeVisible({
    timeout: 30_000,
  });
  void extern;
});

test("nieuwe gebruiker zonder modules: elke plek werkt, zonder zijscroll en zonder axe-fouten", async ({
  page,
  extern,
}) => {
  await resetNep();
  await meldAan(page);
  await zetKlok(page, 17);
  const plekken: [string, RegExp][] = [
    ["/", /Wat eten we vandaag\?|Vandaag/],
    ["/planner", /Weekmenu/],
    ["/boodschappen", /Boodschappen|Lijst/],
    ["/gerechten", /Keuken|Recepten|Gerechten/],
    ["/voorraad", /Voorraad|In huis/],
    ["/inspiratie", /Ontdek/],
  ];
  for (const [pad, kop] of plekken) {
    await page.goto(pad);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await expect(page.getByRole("heading", { name: kop }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/kon niet geladen worden|Er ging iets mis/)).toHaveCount(0);
    expect(await heeftHorizontaleScroll(page), `${pad}: scrolt opzij`).toBe(false);
    expect(await axeErnstig(page), `${pad}: axe`).toEqual([]);
  }
  void extern;
});
