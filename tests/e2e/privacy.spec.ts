/**
 * Privacy in de browser (BUG-107): geen verzoek naar Google Fonts; de lettertypen komen uit de
 * eigen bundel en worden echt gebruikt. Nep-Supabase, fictieve gegevens.
 */
import { expect, meldAan, resetDemo, test, zetKlok } from "./helpers";

test("lettertypen zelf gehost: geen Google Fonts, Fraunces en Figtree geladen", async ({
  page,
  extern,
}) => {
  const verzoeken: string[] = [];
  page.on("request", (r) => verzoeken.push(r.url()));
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(verzoeken.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
  expect(extern.filter((h) => /google/.test(h))).toEqual([]);
  const geladen = await page.evaluate(() => ({
    fraunces: document.fonts.check('600 32px "Fraunces Variable"'),
    figtree: document.fonts.check('400 16px "Figtree Variable"'),
    familie: getComputedStyle(document.body).fontFamily,
  }));
  expect(geladen.fraunces, "Fraunces Variable geladen").toBe(true);
  expect(geladen.figtree, "Figtree Variable geladen").toBe(true);
  expect(geladen.familie).toContain("Figtree Variable");
});
