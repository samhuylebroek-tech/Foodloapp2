/**
 * Productbeslissing 2026-11-12: voorraad en restjes zijn optioneel. Drie situaties:
 * 1. geen voorraad: toch voorstellen (Vandaag en Week), geen fout, geen leeg scherm;
 * 2. wel boodschappen, voorraad niet bijgehouden: niets "in huis", geen Gebruik eerst; een recente
 *    aankoop hooguit als "Je kocht onlangs …";
 * 3. voorraad bijgehouden (zelf iets toegevoegd): "Met wat je in huis hebt".
 * Geen geregistreerde restjes = geen restjes. Nepdata (demo).
 */
import { alleenIkEetMee, expect, meldAan, resetDemo, test, zetKlok } from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const vandaag = () => new Date().toLocaleDateString("sv-SE");
const voorstellen = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: /Met wat je in huis hebt|Ideeën voor vanavond/ });

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await fetch(`${NEP}/meal_plan?id=neq.0`, { method: "DELETE" });
  await meldAan(page);
  await zetKlok(page, 17);
});

test("1. zonder voorraad: voorstellen met redenen op Vandaag en in Week, zonder fout", async ({
  page,
  extern,
}) => {
  await fetch(`${NEP}/pantry_items?id=neq.0`, { method: "DELETE" });
  await page.goto("/");
  await expect(
    voorstellen(page)
      .getByRole("button", { name: /^Niet nu: / })
      .first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("region", { name: "Met wat je in huis hebt" })).toHaveCount(0);
  await expect(page.getByText(/Gebruikt je|dagen in huis|Nog restjes/)).toHaveCount(0);
  await expect(page.getByText(/kon niet geladen worden|Er ging iets mis/)).toHaveCount(0);

  await page.goto("/planner");
  await expect(page.getByRole("region", { name: "Vul aan met voorstellen" })).toBeVisible({
    timeout: 30_000,
  });
  void extern;
});

test("2. voorraad niet bijgehouden: niets 'in huis', geen Gebruik eerst; recente aankoop als hint", async ({
  page,
  extern,
}) => {
  await alleenIkEetMee(page); // gaat over rundvlees, niet over vegetarische Gust
  // Zoals na "Klaar met winkelen": rundvlees vandaag gekocht, spinazie al lang geleden.
  await fetch(`${NEP}/pantry_items?naam=eq.rundvlees`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
  await page.goto("/");
  const v = voorstellen(page);
  await expect(v.getByRole("button", { name: /^Niet nu: / }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("region", { name: "Met wat je in huis hebt" })).toHaveCount(0);
  await expect(v.getByText(/Gebruikt je/)).toHaveCount(0);
  await expect(v.getByText("Je kocht onlangs rundvlees").first()).toBeVisible();

  await page.goto("/voorraad");
  await expect(page.getByText(/Je voorraad bijhouden is niet nodig/)).toBeVisible();
  await expect(page.getByText(/dagen in huis/)).toHaveCount(0);
  await expect(page.getByRole("note", { name: "Gebruik eerst" })).toHaveCount(0);
  void extern;
});

test("3. zelf iets in de voorraad zetten = bijhouden: 'Met wat je in huis hebt'; en weer uit te zetten", async ({
  page,
  extern,
}) => {
  await page.goto("/voorraad");
  await page.getByLabel("Nieuw product").fill("1 kg wortelen");
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(page.getByText(/Je houdt je voorraad bij/)).toBeVisible();

  await page.goto("/");
  await expect(
    page
      .getByRole("region", { name: "Met wat je in huis hebt" })
      .getByRole("button", { name: /^Niet nu: / })
      .first(),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/instellingen");
  const knop = page.getByRole("switch", { name: /Ik houd mijn voorraad bij/ });
  await expect(knop).toHaveAttribute("aria-checked", "true");
  await knop.click();
  await page.goto("/");
  await expect(
    voorstellen(page)
      .getByRole("button", { name: /^Niet nu: / })
      .first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("region", { name: "Met wat je in huis hebt" })).toHaveCount(0);
  void extern;
});
