/**
 * Mobiel-eerst: elk gebruikersscherm op de zes gangbaarste telefoonbreedtes.
 * - nooit horizontaal scrollen;
 * - geen aanraakdoel kleiner dan 24×24 px (WCAG 2.2 AA, 2.5.8); doelen onder 44 px
 *   worden gelogd als "KLEIN|..." voor het verslag (streefwaarde, geen harde eis);
 * - op 390 px: geen ernstige axe-meldingen.
 * Gesimuleerde schermen in Chromium — geen echte toestellen.
 */
import type { Page } from "@playwright/test";
import { axeErnstig, expect, heeftHorizontaleScroll, meldAan, resetDemo, test } from "./helpers";

const BREEDTES = [360, 375, 390, 393, 412, 430];
const RECEPT = "aaaaaaaa-0000-4000-8000-000000000001";
const PADEN = [
  "/",
  "/gerechten",
  `/recepten/${RECEPT}`,
  `/recepten/${RECEPT}?koken=true`,
  "/recepten/nieuw",
  "/planner",
  "/boodschappen",
  "/aanvullen",
  "/voorraad",
  "/meer",
  "/instellingen",
  "/gezin",
  "/vrienden",
  "/kaarten",
  "/meldingen",
  "/credits",
  "/feedback",
  "/info",
  "/inspiratie",
];

async function doelen(page: Page, min: number) {
  return page.evaluate((min) => {
    const els = [
      ...document.querySelectorAll<HTMLElement>(
        "button, a[href], input:not([type=hidden]), select, [role=button], [role=checkbox], [role=switch], [role=tab]",
      ),
    ];
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none") return false;
        if (r.width <= 1 && r.height <= 1) return false; // alleen voor schermlezers
        if (el.closest("p, li > span")?.tagName === "P" && el.tagName === "A") return false; // link in lopende tekst (uitzondering 2.5.8)
        // Een schakelaar met een groter onzichtbaar raakvlak (::before) telt mee.
        const voor = getComputedStyle(el, "::before");
        const extra = voor.content !== "none" && voor.position === "absolute" ? 16 : 0;
        return r.height + extra < min || r.width + extra < min;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`,
      );
  }, min);
}

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

for (const pad of PADEN) {
  test(`mobiele breedtes: ${pad}`, async ({ page, extern }) => {
    for (const breedte of BREEDTES) {
      await page.setViewportSize({ width: breedte, height: 800 });
      await page.goto(pad);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page
        .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, {
          timeout: 15_000,
        })
        .catch(() => undefined);
      expect(await heeftHorizontaleScroll(page), `${pad} @ ${breedte}px scrolt opzij`).toBe(false);
      expect(await doelen(page, 24), `${pad} @ ${breedte}px: te kleine doelen`).toEqual([]);
      if (breedte === 390) {
        for (const k of await doelen(page, 44)) console.log(`KLEIN|${pad}|${k}`);
        expect(await axeErnstig(page), `${pad} @ 390px`).toEqual([]);
      }
    }
    void extern;
  });
}
