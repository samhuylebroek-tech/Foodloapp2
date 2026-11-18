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
  storing,
  test,
  zetKlok,
  voorraadBijhouden,
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
  // Geen product twee keer door Foodlo. (Een eigen regel blijft ongemoeid; wat Foodlo extra
  // nodig heeft, staat dan op een eigen regel "voor <gerecht>" — WP5, eigen boodschappen beschermd.)
  const foodlo = ((await nepDb()).shopping_items ?? [])
    .filter((i) => !i["checked"] && i["recipe_id"])
    .map((i) => String(i["name"]));
  expect(new Set(foodlo).size, "geen product twee keer van Foodlo op de lijst").toBe(foodlo.length);
  void extern;
});

test("de volledige kringloop: aanvullen → winkelen → voorraad → koken → voorraad bijgewerkt", async ({
  page,
  extern,
}) => {
  // P3: "Voorraad bijwerken?" na het koken verschijnt alleen als je je voorraad bijhoudt.
  await voorraadBijhouden(page);
  // 1. Vandaag (WP3) zegt wat er voor vanavond ontbreekt; één tik zet het op de lijst.
  await zetKlok(page);
  await page.goto("/");
  const nu = page.locator("[data-nu]");
  await expect(nu).toHaveAttribute("data-nu", "aanvullen");
  await nu.getByRole("button", { name: "Zet op mijn lijst" }).click();
  await expect(page.getByText(/op je lijst/).first()).toBeVisible();
  // Daarna is de volgende stap: winkelen. En pas nu toont "Daarna" de rest van de week.
  await expect(nu).toHaveAttribute("data-nu", "winkelen");
  const daarna = page.getByRole("region", { name: "Daarna" });
  await daarna.getByRole("button", { name: "Zet op mijn lijst" }).click();
  await expect(daarna.getByRole("button", { name: "Zet op mijn lijst" })).toHaveCount(0);

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

  // 4. Koken: Foodlo stelt voor wat eraf gaat (P3: pas na bevestiging); het specifieke product
  //    gaat eerst op.
  await page.goto(STOOFVLEES);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Klaar met koken" }).click();
  await page.getByRole("button", { name: "5 sterren" }).click();
  await expect.poll(stoofvlees).toBe(1000);
  await page
    .getByRole("button", { name: /^Haal \d+ (product|producten) uit je voorraad$/ })
    .click();
  await expect(page.getByText(/Voorraad bijgewerkt/).first()).toBeVisible();
  await expect.poll(stoofvlees).toBeUndefined();
  expect(await voorraad()).toContain("rundvlees");

  // 5. Vergissing? Eén tik zet het terug.
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
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

test("WP2 wat eten we vanavond: één tik plant het en zet alleen het tekort op de lijst", async ({
  page,
  extern,
}) => {
  // Niets gepland voor vandaag.
  const vandaag = new Date().toLocaleDateString("sv-SE");
  await fetch(`http://127.0.0.1:54439/rest/v1/meal_plan?plan_date=eq.${vandaag}`, {
    method: "DELETE",
  });
  const lijstVoor = (await open()).length;
  // Deze gebruiker houdt zijn voorraad bij (voorraadbeheer is optioneel).
  await voorraadBijhouden(page);
  await zetKlok(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Wat eten we vandaag?" })).toBeVisible();
  const voorstellen = page.getByRole("region", { name: "Met wat je in huis hebt" });
  const knoppen = voorstellen.getByRole("button", { name: /^Kook .* vanavond$/ });
  await expect(knoppen.first()).toBeVisible();
  expect(await knoppen.count()).toBeLessThanOrEqual(3);
  expect(await axeErnstig(page)).toEqual([]);

  await knoppen.first().click();
  await expect(page.getByText(/staat op vanavond/)).toBeVisible();
  await expect
    .poll(async () => (await nepDb()).meal_plan?.filter((m) => m["plan_date"] === vandaag).length)
    .toBe(1);
  // Het menu van vandaag staat nu in de band.
  await expect(page.getByRole("link", { name: "Start koken" })).toBeVisible();
  const lijstNa = (await open()).length;
  expect(lijstNa).toBeGreaterThanOrEqual(lijstVoor);

  // Ongedaan maken: plan weg en lijst zoals voordien.
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).click();
  await expect
    .poll(async () => (await nepDb()).meal_plan?.filter((m) => m["plan_date"] === vandaag).length)
    .toBe(0);
  await expect.poll(async () => (await open()).length).toBe(lijstVoor);
  void extern;
});

// ---------------------------------------------------------------- betrouwbaarheid
// Gesimuleerde databankfouten (nep-Supabase /__storing): nooit half uitgevoerd werk.

test.describe("betrouwbaarheid: fouten, dubbel tikken, alles-of-niets", () => {
  const vandaag = () => new Date().toLocaleDateString("sv-SE");
  const planVandaag = async () =>
    (await nepDb()).meal_plan?.filter((m) => m["plan_date"] === vandaag()).length ?? 0;
  const lijstSnapshot = async () =>
    JSON.stringify(
      ((await nepDb()).shopping_items ?? [])
        .map((i) => [i["name"], i["quantity"], i["checked"]])
        .sort(),
    );
  const voorraadSnapshot = async () =>
    JSON.stringify(
      ((await nepDb()).pantry_items ?? []).map((p) => [p["naam"], p["hoeveelheid"]]).sort(),
    );

  test.beforeEach(async ({ page }) => {
    // Vaste klok (14 u): na 21 u kijkt Vandaag bewust naar morgen (WP3), dan is er geen
    // "Kook … vanavond". Zonder vaste klok faalden deze tests 's avonds (regressie C1, 21:37).
    await zetKlok(page, 14);
    await fetch(`http://127.0.0.1:54439/rest/v1/meal_plan?plan_date=eq.${vandaag()}`, {
      method: "DELETE",
    });
  });

  test("kook vanavond: lijst opslaan mislukt → planning teruggedraaid, lijst onveranderd", async ({
    page,
    extern,
  }) => {
    const lijstVoor = await lijstSnapshot();
    await page.goto("/");
    const knop = page.getByRole("button", { name: /^Kook .* vanavond$/ }).first();
    await expect(knop).toBeVisible();
    await storing({ pad: "/rest/v1/shopping_items", methode: "POST", soort: "fout", keer: 5 });
    await knop.click();
    await expect(page.getByText(/Er is niets veranderd/)).toBeVisible();
    expect(await planVandaag(), "geen halve actie: planning weg").toBe(0);
    expect(await lijstSnapshot(), "lijst onveranderd").toBe(lijstVoor);
    void extern;
  });

  test("kook vanavond: ook terugdraaien mislukt → eerlijke melding, geen 'niets veranderd'", async ({
    page,
    extern,
  }) => {
    await page.goto("/");
    const knop = page.getByRole("button", { name: /^Kook .* vanavond$/ }).first();
    await expect(knop).toBeVisible();
    await storing({ pad: "/rest/v1/shopping_items", methode: "POST", soort: "fout", keer: 5 });
    await storing({ pad: "/rest/v1/meal_plan", methode: "DELETE", soort: "fout", keer: 5 });
    await knop.click();
    await expect(page.getByText(/lukte maar half/)).toBeVisible();
    await expect(page.getByText(/Er is niets veranderd/)).toHaveCount(0);
    // De planning bleef staan (terugdraaien kon niet) — en de app zegt dat ook.
    expect(await planVandaag()).toBe(1);
    void extern;
  });

  test("kook vanavond: dubbel tikken plant maar één keer", async ({ page, extern }) => {
    await page.goto("/");
    const knop = page.getByRole("button", { name: /^Kook .* vanavond$/ }).first();
    await expect(knop).toBeVisible();
    await knop.dblclick();
    await expect(page.getByText(/staat (al )?op vanavond/).first()).toBeVisible();
    await expect.poll(planVandaag).toBe(1);
    await page.waitForTimeout(800);
    expect(await planVandaag()).toBe(1);
    void extern;
  });

  test("aanvullen: tweede schrijfstap mislukt → bijgetelde regels teruggezet", async ({
    page,
    extern,
  }) => {
    const lijstVoor = await lijstSnapshot();
    await page.goto("/aanvullen");
    await expect(page.getByRole("button", { name: /^Zet \d+ op mijn lijst$/ })).toBeVisible();
    await storing({ pad: "/rest/v1/shopping_items", methode: "POST", soort: "fout", keer: 5 });
    await page.getByRole("button", { name: /^Zet \d+ op mijn lijst$/ }).click();
    await expect(page.getByText(/lukte niet/)).toBeVisible();
    expect(await lijstSnapshot()).toBe(lijstVoor);
    void extern;
  });

  test("klaar met winkelen: opruimen mislukt → voorraad teruggezet, lijst blijft", async ({
    page,
    extern,
  }) => {
    const lijstVoor = await lijstSnapshot();
    const voorraadVoor = await voorraadSnapshot();
    await page.goto("/boodschappen");
    await storing({ pad: "/rest/v1/shopping_items", methode: "DELETE", soort: "fout", keer: 5 });
    await page.getByRole("button", { name: "Klaar met winkelen" }).click();
    await expect(page.getByText(/Je lijst blijft staan/)).toBeVisible();
    expect(await voorraadSnapshot(), "voorraad teruggezet").toBe(voorraadVoor);
    expect(await lijstSnapshot(), "lijst onveranderd").toBe(lijstVoor);
    void extern;
  });

  test("klaar met winkelen: dubbel tikken verwerkt maar één keer", async ({ page, extern }) => {
    await page.goto("/boodschappen");
    await page.getByRole("button", { name: "Klaar met winkelen" }).dblclick();
    await expect(page.getByText(/in je voorraad gezet/).first()).toBeVisible();
    await page.waitForTimeout(800);
    const namen = ((await nepDb()).pantry_items ?? []).map((p) => String(p["naam"]));
    expect(namen.filter((n) => n === "zalmfilet")).toHaveLength(1);
    void extern;
  });
});
