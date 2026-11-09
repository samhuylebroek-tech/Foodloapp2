/**
 * V2-kringloop: plannen → lijst min voorraad → kopen → voorraad → koken → voorraad.
 * Acceptatiecriteria K2, K4–K7 (docs/foodloapp-v2/PRODUCT-HERONTWERP.md) en de
 * volledige ervaring van begin tot einde, met dubbele acties en ongedaan maken.
 * Tegen de nep-Supabase met demogegevens — geen echte database.
 */
import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  meldAan,
  nepDb,
  resetDemo,
  test,
} from "./helpers";

const STOOFVLEES = "/recepten/aaaaaaaa-0000-4000-8000-000000000001";
const open = async () =>
  ((await nepDb()).shopping_items ?? []).filter((i) => !i["checked"]).map((i) => String(i["name"]));
const voorraad = async () => ((await nepDb()).pantry_items ?? []).map((p) => String(p["naam"]));

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("S1 slim aanvullen: in huis apart, weglaten met één tik, rest op de lijst (K2, K4, K7)", async ({
  page,
  extern,
}) => {
  await page.goto("/planner");
  await page.getByRole("link", { name: "Slim aanvullen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Slim aanvullen" })).toBeVisible();

  // Wat in huis is (pompoen) staat apart en niet aangevinkt; niet bij "nog kopen".
  await expect(
    page
      .getByRole("list", { name: "Heb je al in huis" })
      .getByRole("checkbox", { name: "pompoen" }),
  ).toHaveAttribute("aria-checked", "false");
  const teKopen = page.locator('ul[aria-label^="Nog kopen"]').getByRole("checkbox");
  await expect(teKopen.filter({ hasText: /^pompoen/ })).toHaveCount(0);
  // Wat al op de lijst staat (donker bier) wordt niet opnieuw voorgesteld.
  await expect(teKopen.filter({ hasText: /^donker bier/ })).toHaveCount(0);

  expect(await axeErnstig(page)).toEqual([]);
  expect(await heeftHorizontaleScroll(page)).toBe(false);

  const voor = (await open()).length;
  const aantal = await teKopen.count();
  await teKopen.first().click(); // weglaten
  await page.getByRole("button", { name: `Zet ${aantal - 1} op mijn lijst` }).click();
  await expect(
    page.getByRole("heading", { name: `${aantal - 1} dingen staan op je lijst` }),
  ).toBeVisible();
  // Een tekort bij iets dat al op de lijst stond, wordt bijgeteld (geen tweede regel).
  const na = (await open()).length;
  expect(na).toBeGreaterThan(voor);
  expect(na).toBeLessThanOrEqual(voor + aantal - 1);
  void extern;
});

test("dubbel aanvullen (ook vanuit een tweede venster) maakt geen dubbels", async ({
  page,
  context,
  extern,
}) => {
  const tweede = await context.newPage();
  await page.goto("/aanvullen");
  await tweede.goto("/aanvullen");
  await expect(page.getByRole("button", { name: /^Zet \d+ op mijn lijst$/ })).toBeVisible();
  await expect(tweede.getByRole("button", { name: /^Zet \d+ op mijn lijst$/ })).toBeVisible();

  await page.getByRole("button", { name: /^Zet \d+ op mijn lijst$/ }).click();
  await expect(page.getByRole("heading", { name: /op je lijst/ })).toBeVisible();
  const naEerste = (await open()).length;

  // Het tweede venster toont nog de oude berekening; Foodlo rekent opnieuw vóór het schrijft.
  await tweede.getByRole("button", { name: /^Zet \d+ op mijn lijst$/ }).click();
  await expect(tweede.getByText("Alles staat al op je lijst")).toBeVisible();
  expect((await open()).length).toBe(naEerste);
  const namen = await open();
  expect(new Set(namen).size, "geen product twee keer op de lijst").toBe(namen.length);
  void extern;
});

test("de volledige kringloop: aanvullen → winkelen → voorraad → koken → voorraad bijgewerkt", async ({
  page,
  extern,
}) => {
  // 1. Vandaag zegt wat er ontbreekt; één tik zet het op de lijst.
  await page.goto("/");
  const kaart = page.getByRole("region", { name: "Boodschappen voor je komende maaltijden" });
  await expect(kaart).toBeVisible();
  await kaart.getByRole("button", { name: "Zet op mijn lijst" }).click();
  await expect(page.getByText(/dingen op je lijst/).first()).toBeVisible();
  await expect(kaart).toHaveCount(0); // niets meer te doen
  await expect(page.getByText("Alles voor je komende maaltijden staat klaar")).toBeVisible();

  // 2. In de winkel: alles afvinken, per afdeling.
  await page.goto("/boodschappen");
  const vinkAlles = page.getByRole("button", { name: /^Alles in .* afvinken$/ });
  await expect(vinkAlles.first()).toBeVisible();
  while ((await vinkAlles.count()) > 0) {
    await vinkAlles.first().click();
    await page.waitForTimeout(150);
  }
  await expect.poll(async () => (await open()).length).toBe(0);

  // 3. Klaar met winkelen: geen vraag, alles naar de voorraad, lijst leeg — en terug te draaien.
  await page.getByRole("button", { name: "Klaar met winkelen" }).click();
  await expect(page.getByText(/in je voorraad gezet/)).toBeVisible();
  await expect.poll(voorraad).toEqual(expect.arrayContaining(["zalmfilet", "boter", "frambozen"]));
  await expect.poll(async () => (await nepDb()).shopping_items?.length ?? 0).toBe(0);
  const stoofvlees = async () =>
    (await nepDb()).pantry_items?.find((p) => p["naam"] === "rundvlees (stoofvlees)")?.[
      "hoeveelheid"
    ];
  // Gekocht "rundvlees (stoofvlees)" krijgt een eigen regel naast het algemene "rundvlees".
  await expect.poll(stoofvlees).toBe(1000);

  // 4. Koken: de voorraad wordt vanzelf bijgewerkt; het specifieke product gaat eerst op.
  await page.goto(STOOFVLEES);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Klaar met koken" }).click();
  await page.getByRole("button", { name: "5 sterren" }).click();
  await expect(page.getByText(/Voorraad bijgewerkt/)).toBeVisible();
  await expect.poll(stoofvlees).toBeUndefined();
  expect(await voorraad()).toContain("rundvlees");

  // 5. Vergissing? Eén tik zet het terug.
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).click();
  await expect.poll(stoofvlees).toBe(1000);
  void extern;
});

test("klaar met winkelen ongedaan maken zet lijst en voorraad terug (K5)", async ({
  page,
  extern,
}) => {
  const voorVoorraad = (await voorraad()).length;
  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "Klaar met winkelen" }).click();
  await expect.poll(voorraad).toEqual(expect.arrayContaining(["zalmfilet", "koffie"]));
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).click();
  await expect.poll(async () => (await voorraad()).length).toBe(voorVoorraad);
  await expect
    .poll(async () => (await nepDb()).shopping_items?.filter((i) => i["checked"]).length)
    .toBe(2);
  void extern;
});
