/**
 * WP3 — Vandaag: één kaart met wat nú telt en één knop. Nepdata (demo), vaste klok.
 */
import { axeErnstig, expect, meldAan, resetDemo, test, zetKlok } from "./helpers";

const STOOFVLEES = "aaaaaaaa-0000-4000-8000-000000000001";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("14 u: wat ontbreekt voor vanavond, met één hoofdknop en hooguit één tweede", async ({
  page,
  extern,
}) => {
  await zetKlok(page, 14);
  await page.goto("/");
  const nu = page.locator("[data-nu]");
  await expect(nu).toHaveAttribute("data-nu", "aanvullen");
  await expect(nu.getByText(/^Nog nodig: /)).toBeVisible();
  // Eén hoofdactie + hooguit één tweede: niet meer keuzes dan nodig.
  expect(await nu.locator("a, button").count()).toBeLessThanOrEqual(2);
  // "Daarna" herhaalt niet wat de kaart al zegt (geen tweede 'ontbreken voor vanavond').
  const daarna = page.getByRole("region", { name: "Daarna" });
  await expect(daarna.getByText(/ontbreken voor je komende maaltijden/)).toHaveCount(0);
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});

test("22 u: Vandaag kijkt al naar morgen", async ({ page, extern }) => {
  await zetKlok(page, 22);
  await page.goto("/");
  const nu = page.locator("[data-nu]");
  await expect(nu).toHaveAttribute("data-nu", "morgen");
  await expect(nu.getByText("Morgen", { exact: true })).toBeVisible();
  void extern;
});

test("aan het koken: Vandaag biedt 'Ga verder met koken' aan", async ({ page, extern }) => {
  await zetKlok(page, 17);
  await page.addInitScript(
    ([id]) => {
      window.localStorage.setItem(
        `foodlo:kookstand:${id}`,
        JSON.stringify({ stap: 1, tijd: Date.now() }),
      );
    },
    [STOOFVLEES],
  );
  await page.goto("/");
  const nu = page.locator("[data-nu]");
  await expect(nu).toHaveAttribute("data-nu", "hervatten");
  await expect(nu.getByText("Je was aan het koken")).toBeVisible();
  await expect(nu.getByText(/^Stap 2 van \d+$/)).toBeVisible();
  await nu.getByRole("link", { name: "Ga verder met koken" }).click();
  await expect(page).toHaveURL(new RegExp(`/recepten/${STOOFVLEES}`));
  void extern;
});
