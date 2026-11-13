/**
 * Fase C (minder verspilling, usecase 6): verse producten die al even in huis zijn.
 * Keuken toont "Al X dagen in huis" en "Gebruik eerst"; Vandaag geeft de reden; bijkopen zet de
 * datum terug op vandaag (en ongedaan maken zet hem terug). Nepdata (demo), vaste klok.
 */
import {
  expect,
  meldAan,
  nepDb,
  resetDemo,
  test,
  zetKlok,
  axeErnstig,
  voorraadBijhouden,
} from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
// BUG-140: rekenen vanaf dezelfde vaste klok als de browser (zetKlok 17 u), niet vanaf "nu".
// Anders werd "5 dagen geleden" na 17 u "4 dagen en 17 uur" → "Al 4 dagen in huis".
const klok = () => {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d.getTime();
};
const geleden = (dagen: number) => new Date(klok() - dagen * 86400000).toISOString();

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  // Rundvlees (vlees-vis, drempel 2 dagen) al 5 dagen in huis; de rest zonder datum.
  const res = await fetch(`${NEP}/pantry_items?naam=eq.rundvlees`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ created_at: geleden(9), updated_at: geleden(5) }),
  });
  expect(res.ok).toBe(true);
  await meldAan(page);
  await voorraadBijhouden(page);
  await zetKlok(page, 17);
});

test("Keuken: 'Al 5 dagen in huis' en 'Gebruik eerst'; recept dat het opmaakt staat bovenaan", async ({
  page,
  extern,
}) => {
  await page.goto("/voorraad");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const rij = page.getByRole("listitem").filter({ hasText: /^rundvlees/ });
  await expect(rij.getByText("Al 5 dagen in huis")).toBeVisible();
  const notitie = page.getByRole("note", { name: "Gebruik eerst" });
  await expect(notitie).toContainText("Gebruik eerst: rundvlees");
  const recepten = page.getByRole("list", { name: "Recepten met wat je in huis hebt" });
  await expect(recepten.getByRole("link").first()).toContainText("Stoofvlees met frietjes");
  // Bijna verse producten (bv. pompoen) krijgen geen label.
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: /^pompoen/ })
      .getByText(/dagen in huis/),
  ).toHaveCount(0);
  expect(await axeErnstig(page)).toEqual([]);

  // "Meer" = bijgekocht: het label verdwijnt.
  await page.getByRole("button", { name: "Meer: rundvlees" }).click();
  await expect(rij.getByText("Al 5 dagen in huis")).toHaveCount(0);
  await expect(notitie).toHaveCount(0);
  void extern;
});

test("Vandaag: de reden noemt wat al even in huis is", async ({ page, extern }) => {
  await fetch(`${NEP}/meal_plan?plan_date=eq.${new Date().toLocaleDateString("sv-SE")}`, {
    method: "DELETE",
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const voorstellen = page.getByRole("region", { name: "Met wat je in huis hebt" });
  await expect(voorstellen.getByText("Gebruikt je rundvlees (al 5 dagen in huis)")).toBeVisible({
    timeout: 30_000,
  });
  void extern;
});

test("Slimme voorstellen uit: wel het feit, geen 'Gebruik eerst'-notitie", async ({
  page,
  extern,
}) => {
  await page.goto("/instellingen");
  await page.getByRole("switch", { name: "Slimme voorstellen" }).click();
  await page.goto("/voorraad");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByText("Al 5 dagen in huis")).toBeVisible();
  await expect(page.getByRole("note", { name: "Gebruik eerst" })).toHaveCount(0);
  void extern;
});

test("Klaar met winkelen zet de datum op vandaag; ongedaan maken zet hem terug", async ({
  page,
  extern,
}) => {
  const lijst = (await nepDb()).shopping_lists?.[0]?.["id"];
  const res = await fetch(`${NEP}/shopping_items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: "dddddddd-0000-4000-8000-0000000000ee",
      list_id: lijst,
      name: "rundvlees",
      quantity: 1,
      unit: "kg",
      checked: true,
      recipe_id: null,
      note: null,
      created_at: new Date().toISOString(),
    }),
  });
  expect(res.ok).toBe(true);
  const datum = async () =>
    String(
      (await nepDb()).pantry_items?.find((p) => p["naam"] === "rundvlees")?.["updated_at"] ?? "",
    );
  const oud = await datum();

  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "Klaar met winkelen" }).click();
  await expect(page.getByText(/in je voorraad gezet/)).toBeVisible();
  await expect.poll(datum).not.toBe(oud);
  // De app gebruikt de klok van de browser (vast op 17 u, zetKlok); vergelijk daarmee (BUG-140).
  expect(Math.abs(klok() - Date.parse(await datum()))).toBeLessThan(5 * 60_000);

  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).click();
  await expect.poll(datum).toBe(oud);
  void extern;
});

test("Vandaag: 'Gebruik eerst' met een gerecht dat het opmaakt bovenaan, en een zoekidee als geen recept past", async ({
  page,
  extern,
}) => {
  await fetch(`${NEP}/meal_plan?plan_date=eq.${new Date().toLocaleDateString("sv-SE")}`, {
    method: "DELETE",
  });
  // Spinazie: geen enkel eigen recept gebruikt het (wel een idee in Ontdek).
  await fetch(`${NEP}/pantry_items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: "99999999-0000-4000-8000-0000000000aa",
      user_id: "11111111-1111-4111-8111-111111111111",
      naam: "spinazie",
      hoeveelheid: 1,
      eenheid: "zak",
      created_at: geleden(6),
      updated_at: geleden(6),
    }),
  });
  await page.goto("/");
  const voorstellen = page.getByRole("region", { name: "Met wat je in huis hebt" });
  const notitie = voorstellen.getByRole("note", { name: "Gebruik eerst" });
  await expect(notitie).toContainText("rundvlees (al 5 dagen in huis)", { timeout: 30_000 });
  await expect(notitie).toContainText("spinazie (al 6 dagen in huis)");
  await expect(voorstellen.getByRole("listitem").first()).toContainText("Stoofvlees met frietjes");
  expect(await axeErnstig(page)).toEqual([]);

  await notitie.getByRole("link", { name: "Zoek een idee met spinazie" }).click();
  await expect(page.getByRole("textbox", { name: "Zoeken in inspiratie" })).toHaveValue("spinazie");
  await expect(page.getByRole("link", { name: /Stoemp met spinazie en spek/ })).toBeVisible();
  void extern;
});
