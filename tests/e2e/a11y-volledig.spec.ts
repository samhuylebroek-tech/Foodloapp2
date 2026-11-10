/**
 * Toegankelijkheid als harde regressiepoort (naast mobiel-breedtes, dat de gebruikersschermen
 * op 360–430 px controleert):
 * 1. alle beheerschermen: geen ernstige axe-meldingen, niet horizontaal scrollen op 320/390 px;
 * 2. open vensters en onderbladen (catalogus, lijstmenu, winkelmodus, receptformulier, ...);
 * 3. de losse schermen privacy en installeren.
 * Chromium met axe-core: dat vervangt geen test met VoiceOver of TalkBack op een echt toestel
 * (zie docs/foodloapp-v2/TOEGANKELIJKHEID-PROTOCOL.md).
 */
import { axeErnstig, expect, heeftHorizontaleScroll, meldAan, resetDemo, test } from "./helpers";
import { BEHEER_PADEN, EIGENAAR, seedEigenaar } from "./beheer-paden";

test.describe.configure({ timeout: 600_000 });

async function wacht(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, {
      timeout: 15_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

test("beheer: axe en geen horizontaal scrollen", async ({ page }) => {
  await resetDemo();
  await seedEigenaar();
  await meldAan(page, EIGENAAR);
  const fouten: string[] = [];
  for (const breedte of [320, 390]) {
    await page.setViewportSize({ width: breedte, height: 844 });
    for (const [naam, pad] of BEHEER_PADEN) {
      await page.goto(pad);
      await wacht(page);
      if (await heeftHorizontaleScroll(page)) fouten.push(`${naam} @ ${breedte}: scrolt opzij`);
      if (breedte === 390)
        for (const a of await axeErnstig(page)) fouten.push(`${naam} @ ${breedte}: ${a}`);
    }
  }
  expect(fouten).toEqual([]);
});

test("vensters, onderbladen en losse schermen: axe", async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  const SCENARIOS: [string, string, (() => Promise<unknown>) | null][] = [
    [
      "catalogus",
      "/boodschappen",
      () => page.getByRole("button", { name: "Producten kiezen" }).first().click(),
    ],
    [
      "lijstmenu",
      "/boodschappen",
      () => page.getByRole("button", { name: "Meer opties voor deze lijst" }).click(),
    ],
    [
      "winkelmodus",
      "/boodschappen",
      () => page.getByRole("button", { name: "Ik ga winkelen" }).click(),
    ],
    [
      "recept-zelf-typen",
      "/recepten/nieuw",
      () => page.getByRole("button", { name: /Zelf typen/ }).click(),
    ],
    ["privacy", "/privacy", null],
    ["installeren", "/installeren", null],
  ];
  const fouten: string[] = [];
  for (const [naam, pad, actie] of SCENARIOS) {
    await page.goto(pad);
    await wacht(page);
    if (actie) await actie();
    await page.waitForTimeout(700);
    for (const a of await axeErnstig(page)) fouten.push(`${naam}: ${a}`);
  }
  expect(fouten).toEqual([]);
});
