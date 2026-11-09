/**
 * V2-kringloop (prototype): plannen → lijst min voorraad → kopen → voorraad → koken.
 * Acceptatiecriteria K2, K4–K7 uit docs/foodloapp-v2/PRODUCT-HERONTWERP.md.
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

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("S1 slim aanvullen: voorraad apart, één tik zet precies de rest op de lijst (K2, K4, K7)", async ({
  page,
  extern,
}) => {
  const voor = (await nepDb()).shopping_items?.length ?? 0;
  await page.goto("/planner");
  await page.getByRole("link", { name: "Slim aanvullen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Slim aanvullen" })).toBeVisible();

  // Wat al in de voorraad zit (pompoen) staat apart en niet aangevinkt.
  const inHuis = page.getByRole("list", { name: "Heb je al in je voorraad" });
  await expect(inHuis.getByRole("checkbox", { name: /^pompoen / })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  const kopen = page.getByRole("list", { name: "Nog kopen" });
  await expect(kopen.getByRole("checkbox", { name: /^pompoen / })).toHaveCount(0);
  // Wat al op de lijst staat (melk is geen ingrediënt, donker bier wel) wordt niet opnieuw voorgesteld.
  await expect(kopen.getByRole("checkbox", { name: /^donker bier/ })).toHaveCount(0);

  expect(await axeErnstig(page)).toEqual([]);
  expect(await heeftHorizontaleScroll(page)).toBe(false);

  // Eén item weglaten, dan de rest in één tik op de lijst.
  const aantalKopen = await kopen.getByRole("checkbox").count();
  expect(aantalKopen).toBeGreaterThan(1);
  await kopen.getByRole("checkbox").first().click();
  const knop = page.getByRole("button", { name: /^Zet \d+ dingen? op mijn lijst$/ });
  await expect(knop).toHaveText(new RegExp(`Zet ${aantalKopen - 1} `));
  await knop.click();
  await expect(page.getByText(/staan? op je lijst/).first()).toBeVisible();
  await expect
    .poll(async () => (await nepDb()).shopping_items?.length ?? 0)
    .toBe(voor + aantalKopen - 1);
  void extern;
});

test("S2 klaar met winkelen: afgevinkte boodschappen naar de voorraad, lijst opgeruimd (K5)", async ({
  page,
  extern,
}) => {
  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "Klaar met winkelen" }).click();
  const venster = page.getByRole("dialog", { name: "Wat zet je in je voorraad?" });
  await expect(venster.getByRole("checkbox", { name: /^zalmfilet/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(await axeErnstig(page)).toEqual([]);
  await venster.getByRole("button", { name: /In voorraad \(2\)/ }).click();
  await expect
    .poll(async () => (await nepDb()).pantry_items?.map((p) => p["naam"]))
    .toEqual(expect.arrayContaining(["zalmfilet", "koffie"]));
  await expect
    .poll(async () => (await nepDb()).shopping_items?.filter((i) => i["checked"]).length)
    .toBe(0);
  void extern;
});

test("S3 na het koken: gebruikte voorraad weg, met keuze (K6)", async ({ page, extern }) => {
  await page.goto(STOOFVLEES);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Klaar met koken" }).click();
  await page.getByRole("button", { name: "4 sterren" }).click();
  await expect(page.getByRole("heading", { name: "Wat heb je opgebruikt?" })).toBeVisible();
  // Uien laten staan, rundvlees is op.
  await page.getByRole("checkbox", { name: /^uien/ }).click();
  await expect(page.getByRole("checkbox", { name: /^uien/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect(await axeErnstig(page)).toEqual([]);
  await page.getByRole("button", { name: "Voorraad bijwerken" }).click();
  await expect
    .poll(async () => (await nepDb()).pantry_items?.map((p) => p["naam"]))
    .toEqual(expect.not.arrayContaining(["rundvlees"]));
  expect((await nepDb()).pantry_items?.map((p) => p["naam"])).toContain("uien");
  void extern;
});
