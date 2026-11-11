/**
 * WP3 — Vandaag: één kaart met wat nú telt en één knop. Nepdata (demo), vaste klok.
 */
import { axeErnstig, expect, meldAan, nepLog, resetDemo, test, zetKlok } from "./helpers";

// Vastgelegd op de code vóór BUG-118 (identieke schermtekst om 8, 14 en 22 u).
const VANDAAG_NOG_NODIG = "Nog nodig: boter, laurierblaadjes en 2 andere.";
const VANDAAG_TE_KOPEN = "6 dingen op je boodschappenlijst";

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

// BUG-118: Vandaag las voorraad, lijst, weekmenu en ingrediënten 2–3× (Vandaag, aanvulkaart en
// Slim aanvullen elk apart). Nu delen ze één stand. Wat je ziet moet exact gelijk blijven.
test("Vandaag: elke basisvraag naar de databank maar één keer, en dezelfde inhoud", async ({
  page,
  extern,
}) => {
  await zetKlok(page, 14);
  await page.goto("/");
  const nu = page.locator("[data-nu]");
  await expect(nu).toHaveAttribute("data-nu", "aanvullen");
  await page.waitForLoadState("networkidle");
  // Inhoud: dezelfde ontbrekende producten als vóór de wijziging (vaste demogegevens).
  await expect(nu.getByText(/^Nog nodig: /)).toHaveText(VANDAAG_NOG_NODIG);
  await expect(page.locator("main")).toContainText(VANDAAG_TE_KOPEN);

  const tel = new Map<string, number>();
  for (const l of await nepLog()) {
    if (l.method !== "GET" || !l.path.startsWith("/rest/v1/")) continue;
    const t = l.path.slice("/rest/v1/".length);
    if (!BASIS.includes(t)) continue;
    const k = `${t}?${l.query.replace(/^\?/, "")}`;
    tel.set(k, (tel.get(k) ?? 0) + 1);
  }
  const dubbel = [...tel.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${n}× ${k}`);
  expect(dubbel).toEqual([]);
  // En ze zijn er wel (de test meet echt iets).
  for (const t of BASIS) expect([...tel.keys()].some((k) => k.startsWith(`${t}?`))).toBe(true);
  void extern;
});
const BASIS = [
  "shopping_lists",
  "pantry_items",
  "shopping_items",
  "meal_plan",
  "recipe_ingredients",
];

// Gedeelde stand mag niet verouderen: wat je in de voorraad zet, telt meteen op Vandaag
// (zonder herladen, via het menu terug).
test("Vandaag ververst na een voorraadwijziging in de app", async ({ page, extern }) => {
  await zetKlok(page, 14);
  await page.goto("/");
  const nu = page.locator("[data-nu]");
  await expect(nu.getByText(/^Nog nodig: /)).toHaveText(VANDAAG_NOG_NODIG);
  await page
    .getByRole("link", { name: /Keuken/ })
    .first()
    .click();
  await page
    .getByRole("navigation", { name: "Keuken" })
    .getByRole("link", { name: /^Voorraad/ })
    .click();
  await page.getByLabel("Nieuw product").fill("boter");
  await page.getByLabel("Nieuw product").press("Enter");
  const inHuis = page.getByRole("list", { name: "In huis", exact: true });
  await expect(inHuis.getByText("boter", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: /Vandaag/ })
    .first()
    .click();
  await expect(nu.getByText(/^Nog nodig: /)).not.toContainText("boter");
  void extern;
});
