/**
 * P6 — De 20 verplichte testen van de eigenaar, elk als eigen test met zijn titel.
 *
 * Elke test controleert de gebruikersstroom én de gegevens in de nep-databank, en waar het past
 * dat allergieën en harde dieetregels gerespecteerd worden. Demo-gezin "Thuis": Marie (ingelogd),
 * Jan, Lotte (noten, deelt dat niet) en opa Gust (vegetarisch, deelt dat wel).
 *
 * Projecten: telefoon, desktop, mobiel-360, tablet-768 en groot-duidelijk (390 px, thema "Extra
 * duidelijk", tekst 200 %). Nooit tegen productie: alle externe verzoeken worden geblokkeerd.
 */
import type { Browser, Page } from "@playwright/test";
import {
  axeErnstig,
  expect,
  meldAan,
  nepDb,
  resetDemo,
  resetNep,
  seedDb,
  test,
  zetKlok,
} from "./helpers";
import {
  alleenDeze,
  MA,
  naarSamenstellen,
  RECEPTEN as PEETERS,
  rid,
  VLEES_OF_VIS,
  VOLGENDE,
  voorstel,
  ZONDAG,
} from "./planner-scenario";

const NEP = "http://127.0.0.1:54439/rest/v1";
const MARIE = "11111111-1111-4111-8111-111111111111";
const JAN = "22222222-2222-4222-8222-222222222222";
const GEZIN = "abababab-0000-4000-8000-000000000001";
const LIJST = "22222222-2222-4222-8222-222222222222";
const GEZINSLIJST = "c9c9c9c9-0000-4000-8000-000000000000";
const HL = (n: number) => `aeaeaeae-0000-4000-8000-00000000000${n}`;
const GUST = HL(4);
const LOTTE = HL(3);
const R = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const PLAN_VANDAAG = "cccccccc-0000-4000-8000-000000000000"; // Stoofvlees met frietjes
const iso = (d: Date) => d.toLocaleDateString("sv-SE");
const dag = (plus: number) => {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  return iso(d);
};
// Demo-gerechten met gluten (bloem, bier, peperkoek, spaghetti).
const MET_GLUTEN = [
  "Stoofvlees met frietjes",
  "Witloof met hesp en kaassaus",
  "Spaghetti bolognese",
];
const VEGETARISCH_PEETERS = new Set(
  PEETERS.filter((r) => r.tags.includes("vegetarisch")).map((r) => rid(r.n)),
);

test.describe.configure({ timeout: 180_000 });

/** groot-duidelijk: thema "Extra duidelijk" en tekst 200 %, zoals een senior het instelt. */
test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "groot-duidelijk")
    await page.addInitScript(() => {
      window.localStorage.setItem("thema", "contrast");
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.fontSize = "200%";
      });
    });
});

const tabel = async (t: string) => (await nepDb())[t] ?? [];
const planRij = async (id: string) => (await tabel("meal_plan")).find((p) => p["id"] === id);

async function weekmenu(page: Page) {
  await page.goto("/planner");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible({ timeout: 60_000 });
}

/** Het actiemenu van een geplande maaltijd openen (desktop toont ook een raster: zichtbare eerst). */
async function planActie(page: Page, gerecht: string, menu: string) {
  await expect(async () => {
    if (!(await page.getByRole("menu").isVisible()))
      await page
        .getByRole("button", { name: `Acties voor ${gerecht}` })
        .filter({ visible: true })
        .first()
        .click();
    await expect(page.getByRole("menuitem", { name: menu })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("menuitem", { name: menu }).click();
}

/** "Gerecht toevoegen" → "Verder naar maaltijd": het venster met "Wie eet mee?". */
async function nieuwGerechtVenster(page: Page) {
  await weekmenu(page);
  await expect(async () => {
    if (!(await page.getByRole("dialog").isVisible()))
      await page.getByRole("button", { name: "Gerecht toevoegen" }).last().click();
    await expect(page.getByRole("button", { name: /Verder naar maaltijd/ })).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: /Verder naar maaltijd/ }).click();
  const venster = page.getByRole("dialog");
  await expect(venster.getByText("Wie eet mee?")).toBeVisible();
  return venster;
}

async function tweedeBrowser(page: Page, sub: string) {
  const browser = page.context().browser() as Browser;
  const ctx = await browser.newContext({
    baseURL: "http://127.0.0.1:4339",
    locale: "nl-BE",
    timezoneId: "Europe/Brussels",
    viewport: page.viewportSize() ?? { width: 412, height: 915 },
  });
  const p = await ctx.newPage();
  await p.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "localhost"
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  await meldAan(p, sub);
  return { p, ctx };
}

/** Een aanvul-scenario met twee recepten die ui delen, en pompoen die al deels in huis is. */
const PASTA = "aaaa0000-0000-4000-8000-0000000000a1";
const SOEP = "aaaa0000-0000-4000-8000-0000000000a2";
const STOOF = "aaaa0000-0000-4000-8000-0000000000a3";
async function zaaiAanvullen(voorraad: Record<string, unknown>[]) {
  await resetNep();
  const recept = (id: string, title: string) => ({
    id,
    user_id: MARIE,
    title,
    servings: 4,
    is_concept: false,
    tags: [],
    category: "hoofdgerecht",
    instructions: ["Koken."],
    deleted_at: null,
  });
  let p = 0;
  const ing = (recipe_id: string, name: string, quantity: number | null, unit: string) => ({
    id: crypto.randomUUID(),
    recipe_id,
    name,
    quantity,
    unit,
    position: p++,
  });
  const plan = (recipe_id: string, plus: number) => ({
    id: crypto.randomUUID(),
    user_id: MARIE,
    recipe_id,
    plan_date: dag(plus),
    meal_type: "avondeten",
    personen: 4,
    group_id: null,
  });
  await seedDb({
    recipes: [recept(PASTA, "Pasta"), recept(SOEP, "Pompoensoep"), recept(STOOF, "Stoofpot")],
    recipe_ingredients: [
      ing(PASTA, "spaghetti", 350, "g"),
      ing(PASTA, "ui", 2, ""),
      ing(SOEP, "pompoen", 2, "kg"),
      ing(SOEP, "ajuin", 1, "stuk"),
      ing(SOEP, "slagroom", 20, "cl"),
      ing(STOOF, "rundvlees", 800, "g"),
      ing(STOOF, "wortel", 500, "g"),
    ],
    meal_plan: [plan(PASTA, 1), plan(SOEP, 0), plan(STOOF, 2)],
    shopping_lists: [
      { id: LIJST, user_id: MARIE, name: "Boodschappen", created_at: "2026-11-01T10:00:00Z" },
    ],
    shopping_items: [],
    pantry_items: voorraad.map((v) => ({ id: crypto.randomUUID(), user_id: MARIE, ...v })),
  });
}
async function aanvullen(page: Page) {
  await page.goto("/aanvullen");
  await expect(page.getByRole("button", { name: /op mijn lijst/ })).toBeVisible({
    timeout: 60_000,
  });
}
type Rij = { name: string; quantity: number | null; unit: string };
const lijstPerNaam = async (listId = LIJST) =>
  Object.fromEntries(
    ((await tabel("shopping_items")) as unknown as (Rij & { list_id: string })[])
      .filter((i) => i.list_id === listId)
      .map((i) => [i.name, { name: i.name, quantity: i.quantity, unit: i.unit }]),
  ) as Record<string, Rij>;

/* ------------------------------------------------------------------------------------------ */

test("1. Een weekmenu maken", async ({ page, extern }) => {
  await resetDemo();
  await alleenDeze(PEETERS);
  await page.clock.setFixedTime(ZONDAG);
  await meldAan(page);
  await naarSamenstellen(page);
  await page.getByRole("button", { name: /^Stel mijn menu samen/ }).click();
  await expect(voorstel(page, MA).locator("[data-titel]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Bewaar dit menu" }).click();
  await expect(page.getByRole("heading", { name: "Je menu staat in Week" })).toBeVisible({
    timeout: 30_000,
  });
  // Gegevens: een week met gerechten, wie meeëet per maaltijd, en de lijst aangevuld.
  const gepland = (await tabel("meal_plan")).filter((p) =>
    VOLGENDE.includes(String(p["plan_date"])),
  );
  expect(gepland.length).toBeGreaterThanOrEqual(5);
  expect(new Set(gepland.map((p) => p["recipe_id"])).size).toBe(gepland.length);
  expect((await tabel("shopping_items")).length).toBeGreaterThan(0);
  // Veiligheid: eet Gust mee, dan vegetarisch; eet Lotte mee, dan geen hazelnootpesto.
  const eters = await tabel("maaltijd_eters");
  for (const p of gepland) {
    const rijen = eters.filter((e) => e["meal_plan_id"] === p["id"]).map((e) => e["lid_id"]);
    // Geen rijen = het hele gezin eet mee (zo leest de app het ook).
    const wie = rijen.length ? rijen : [HL(1), HL(2), LOTTE, GUST];
    if (wie.includes(GUST)) expect(VEGETARISCH_PEETERS.has(String(p["recipe_id"]))).toBe(true);
    if (wie.includes(LOTTE)) expect(p["recipe_id"]).not.toBe(rid(11));
  }
  void extern;
});

test("2. Een maaltijd vervangen", async ({ page, extern }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await weekmenu(page);
  await planActie(page, "Stoofvlees met frietjes", "Ander gerecht");
  const blad = page.getByRole("dialog", { name: "Ander gerecht" });
  await blad.getByRole("textbox", { name: "Zoek in je recepten" }).fill("pompoensoep");
  await blad
    .getByRole("button", { name: /Romige pompoensoep/ })
    .first()
    .click();
  await expect(page.getByText(/Romige pompoensoep in plaats van Stoofvlees/).first()).toBeVisible();
  await expect.poll(async () => (await planRij(PLAN_VANDAAG))?.["recipe_id"]).toBe(R(2));
  // Zelfde plek: dag en moment blijven, geen extra maaltijd erbij.
  const rij = (await planRij(PLAN_VANDAAG))!;
  expect(rij["plan_date"]).toBe(dag(0));
  expect(rij["meal_type"]).toBe("avondeten");
  expect((await tabel("meal_plan")).length).toBe(7);
  // Veilig voor Gust (vegetarisch): het nieuwe gerecht is vegetarisch.
  const recept = (await tabel("recipes")).find((r) => r["id"] === R(2))!;
  expect(recept["tags"]).toContain("vegetarisch");
  void extern;
});

test("3. Een maaltijd verplaatsen", async ({ page, extern }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await weekmenu(page);
  const naar = dag(1);
  await planActie(page, "Stoofvlees met frietjes", "Verplaatsen");
  const blad = page.getByRole("dialog", { name: "Verplaatsen" });
  await blad.getByLabel("Dag").fill(naar);
  await blad.getByRole("button", { name: "Verplaatsen", exact: true }).click();
  await expect(page.getByText(/^Verplaatst naar/).first()).toBeVisible();
  await expect.poll(async () => (await planRij(PLAN_VANDAAG))?.["plan_date"]).toBe(naar);
  // Dezelfde maaltijd (zelfde id, gerecht en porties), niet gekopieerd.
  const rij = (await planRij(PLAN_VANDAAG))!;
  expect(rij["recipe_id"]).toBe(R(1));
  expect(rij["personen"]).toBe(4);
  expect((await tabel("meal_plan")).filter((p) => p["recipe_id"] === R(1))).toHaveLength(1);
  void extern;
});

test("4. Porties wijzigen", async ({ page, extern }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await weekmenu(page);
  // Gust eet vandaag niet mee: 4 → 3 porties, en het stoofvlees botst niet meer met zijn dieet.
  await planActie(page, "Stoofvlees met frietjes", "Wie eet mee?");
  const blad = page.getByRole("dialog", { name: "Wie eet mee?" });
  await expect(blad.getByTestId("eters-oordeel")).toContainText("Niet geschikt voor Gust");
  await blad
    .getByRole("group", { name: "Wie eet mee: Stoofvlees met frietjes" })
    .getByRole("button", { name: "Gust" })
    .click();
  await expect(blad.getByTestId("eters-oordeel")).toHaveCount(0);
  await expect.poll(async () => (await planRij(PLAN_VANDAAG))?.["personen"]).toBe(3);
  const eters = (await tabel("maaltijd_eters")).filter((e) => e["meal_plan_id"] === PLAN_VANDAAG);
  expect(eters.map((e) => e["lid_id"]).sort()).toEqual([HL(1), HL(2), HL(3)]);
  // Op het recept: hoeveelheden voor 3 personen (1 kg voor 4 → 750 g).
  await page.keyboard.press("Escape");
  await page.goto(`/recepten/${R(1)}?personen=3`);
  const ingr = page.getByRole("region", { name: "Ingrediënten" });
  await expect(ingr).toContainText("3 personen");
  await expect(ingr).toContainText(/0,75\s?kg/);
  void extern;
});

test("5. Een allergie toevoegen", async ({ page, extern }) => {
  await resetDemo();
  await fetch(`${NEP}/meal_plan?id=neq.0`, { method: "DELETE" });
  await meldAan(page);
  await page.goto("/mijn-voeding");
  await page.getByRole("button", { name: "Gluten", exact: true }).click();
  await page.getByRole("button", { name: "Bewaren", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mogen we dit bewaren op je account?" }),
  ).toBeVisible();
  // Gevoelig gegeven: zonder toestemming nog niets op het account.
  expect(await tabel("persoonlijke_voeding")).toHaveLength(0);
  await page.getByRole("button", { name: "Ja, bewaar op mijn account" }).click();
  await expect(page.getByText(/Bewaard op je account/)).toBeVisible();
  await expect
    .poll(async () => (await tabel("persoonlijke_voeding"))[0]?.["allergieen"])
    .toEqual(["gluten"]);
  // Week: de voorstellen voor volgende week bevatten geen gluten.
  await weekmenu(page);
  const weekKnop = page.getByRole("button", { name: /— kies een week in de kalender$/ });
  await expect(async () => {
    if ((await weekKnop.innerText()).startsWith("Deze week"))
      await page.getByRole("button", { name: "Volgende week", exact: true }).click();
    expect(await weekKnop.innerText()).toMatch(/^Volgende week/);
  }).toPass({ timeout: 30_000 });
  const kaart = page.getByRole("region", { name: "Vul aan met voorstellen" });
  await expect(kaart.getByRole("button", { name: /^Plan / }).first()).toBeVisible({
    timeout: 30_000,
  });
  const titels = await kaart
    .getByRole("button", { name: /^Plan / })
    .evaluateAll((els) =>
      els.map((e) => (e.getAttribute("aria-label") ?? "").replace(/^Plan (.*) op .*$/, "$1")),
    );
  expect(titels.length).toBeGreaterThan(0);
  for (const t of MET_GLUTEN) expect(titels).not.toContain(t);
  void extern;
});

test("6. Een gezinslid toevoegen", async ({ page, extern }) => {
  await resetDemo();
  await meldAan(page);
  await page.goto("/gezin");
  await page.getByLabel("Iemand zonder account toevoegen").fill("Mila");
  await page.getByRole("radio", { name: "Een kind" }).click();
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(page.getByTestId("lidkaart").filter({ hasText: "Mila" })).toContainText(
    "Nog geen voorkeuren",
  );
  const lid = (await tabel("huishouden_leden")).find((l) => l["naam"] === "Mila");
  expect(lid).toMatchObject({ group_id: GEZIN, rol: "kind", user_id: null, beheerder_id: MARIE });
  // Plannen telt Mila meteen mee: 5 personen.
  const venster = await nieuwGerechtVenster(page);
  await expect(venster.getByRole("button", { name: "Mila", exact: true })).toBeVisible();
  await expect(venster.getByText("5 personen")).toBeVisible();
  void extern;
});

test("7. Een gezinslid vegetarisch instellen", async ({ page, extern }) => {
  await resetDemo();
  await meldAan(page);
  await page.goto("/gezin");
  await page.getByLabel("Iemand zonder account toevoegen").fill("Mila");
  await page.getByRole("radio", { name: "Een kind" }).click();
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  const mila = page.getByTestId("lidkaart").filter({ hasText: "Mila" });
  await mila.getByRole("button", { name: "Voorkeuren" }).click();
  const venster = page.getByRole("dialog");
  await venster.getByRole("radio", { name: "Vegetarisch" }).click();
  // Zonder toestemming kan je niet bewaren (gevoelig gegeven).
  await expect(venster.getByRole("button", { name: "Bewaren" })).toBeDisabled();
  await venster.getByText("Ik beheer dit voor Mila").click();
  await venster.getByRole("switch").click(); // delen met het gezin: reden zichtbaar
  await venster.getByRole("button", { name: "Bewaren" }).click();
  await expect(mila).toContainText("Vegetarisch");
  const lid = (await tabel("huishouden_leden")).find((l) => l["naam"] === "Mila")!;
  const v = (await tabel("lid_voeding")).find((r) => r["lid_id"] === lid["id"]);
  expect(v).toMatchObject({ dieet: "vegetarisch", delen_met_gezin: true, toestemming_door: MARIE });
  // Plannen: vlees is niet veilig voor Mila, vegetarisch wel.
  const plan = await nieuwGerechtVenster(page);
  await expect(plan.getByRole("button", { name: /Stoofvlees met frietjes/ })).toContainText(
    /Niet veilig voor .*Mila/,
  );
  await expect(plan.getByRole("button", { name: /Romige pompoensoep/ })).not.toContainText("Mila");
  void extern;
});

test("8. Een maaltijd plannen voor verschillende eters", async ({ page, extern }) => {
  await resetDemo();
  await meldAan(page);
  const venster = await nieuwGerechtVenster(page);
  await expect(venster.getByText("4 personen")).toBeVisible();
  // Gust eet niet mee: dan is stoofvlees wel veilig; Lotte (noten) eet mee.
  await venster.getByRole("button", { name: "Gust", exact: true }).click();
  await expect(venster.getByText("3 personen")).toBeVisible();
  const stoof = venster.getByRole("button", { name: /Stoofvlees met frietjes/ });
  await expect(stoof).not.toContainText("Niet veilig");
  const voor = (await tabel("meal_plan")).length;
  await stoof.click();
  await expect(page.getByText(/Stoofvlees met frietjes staat op/).first()).toBeVisible();
  await expect.poll(async () => (await tabel("meal_plan")).length).toBe(voor + 1);
  const nieuw = (await tabel("meal_plan")).find(
    (p) => !String(p["id"]).startsWith("cccccccc") && p["recipe_id"] === R(1),
  )!;
  expect(nieuw["personen"]).toBe(3);
  await expect
    .poll(async () =>
      (await tabel("maaltijd_eters"))
        .filter((e) => e["meal_plan_id"] === nieuw["id"])
        .map((e) => e["lid_id"])
        .sort(),
    )
    .toEqual([HL(1), HL(2), HL(3)]);
  void extern;
});

test("9. Ingrediënten uit meerdere recepten samenvoegen", async ({ page, extern }) => {
  await zaaiAanvullen([]);
  await meldAan(page);
  await aanvullen(page);
  await page.getByRole("button", { name: /op mijn lijst/ }).click();
  await expect.poll(async () => Object.keys(await lijstPerNaam()).length).toBeGreaterThan(3);
  const l = await lijstPerNaam();
  // ui (pasta, 2) + ajuin (soep, 1) = één regel van 3; geen dubbele regels.
  const ui = Object.keys(l).filter((n) => /^(ui|ajuin|uien)$/.test(n));
  expect(ui).toHaveLength(1);
  expect(l[ui[0]!]!.quantity).toBe(3);
  const namen = ((await tabel("shopping_items")) as unknown as Rij[]).map((i) => i.name);
  expect(new Set(namen).size).toBe(namen.length);
  void extern;
});

test("10. Geregistreerde voorraad aftrekken", async ({ page, extern }) => {
  // 1 pompoen (≈ 1,2 kg) en 300 g rundvlees in huis.
  await zaaiAanvullen([
    { naam: "pompoen", hoeveelheid: 1, eenheid: "" },
    { naam: "rundvlees", hoeveelheid: 300, eenheid: "g" },
  ]);
  await meldAan(page);
  await aanvullen(page);
  await expect(page.getByRole("checkbox", { name: /pompoen/ })).toContainText(
    "nodig 2 kg, 1,2 kg in huis",
  );
  await page.getByRole("button", { name: /op mijn lijst/ }).click();
  await expect.poll(async () => (await lijstPerNaam())["pompoen"]?.quantity).toBe(0.8);
  const l = await lijstPerNaam();
  expect(l["pompoen"]).toMatchObject({ quantity: 0.8, unit: "kg" });
  expect(l["rundvlees"]).toMatchObject({ quantity: 500, unit: "g" });
  // De voorraad zelf blijft ongewijzigd (pas na koken of winkelen).
  const voorraad = await tabel("pantry_items");
  expect(voorraad.find((v) => v["naam"] === "rundvlees")?.["hoeveelheid"]).toBe(300);
  void extern;
});

test("11. Onbekende voorraad correct behandelen", async ({ page, extern }) => {
  // Wortel staat in de voorraad zonder hoeveelheid; slagroom in een andere eenheid ("pak").
  await zaaiAanvullen([
    { naam: "wortel", hoeveelheid: null, eenheid: null },
    { naam: "slagroom", hoeveelheid: 1, eenheid: "pak" },
  ]);
  await meldAan(page);
  await aanvullen(page);
  await page.getByRole("button", { name: /op mijn lijst/ }).click();
  await expect.poll(async () => Object.keys(await lijstPerNaam()).length).toBeGreaterThan(2);
  const l = await lijstPerNaam();
  // Niet gokken: aanwezig = genoeg, niet dubbel kopen …
  expect(l["wortel"]).toBeUndefined();
  expect(l["slagroom"]).toBeUndefined();
  // … en wat niet in de voorraad staat, gaat volledig op de lijst.
  expect(l["rundvlees"]).toMatchObject({ quantity: 800, unit: "g" });
  // De onbekende hoeveelheid wordt nooit verzonnen of overschreven.
  const wortel = (await tabel("pantry_items")).find((v) => v["naam"] === "wortel")!;
  expect(wortel["hoeveelheid"]).toBeNull();
  void extern;
});

test("12. Een product als gekocht markeren", async ({ page, extern }) => {
  await resetDemo();
  await meldAan(page);
  await page.goto("/boodschappen");
  const melk = page.getByRole("checkbox", { name: "melk als gekocht aanvinken" });
  await melk.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await melk.click();
  await expect
    .poll(
      async () =>
        (await tabel("shopping_items")).find(
          (i) => i["id"] === "ffffffff-0000-4000-8000-000000000000",
        )?.["checked"],
    )
    .toBe(true);
  await expect(page.getByText("melk gekocht").first()).toBeVisible();
  // Na herladen blijft het gekocht (in je kar).
  await page.reload();
  await expect(page.getByText(/te kopen · 3 in je kar/)).toBeVisible({ timeout: 30_000 });
  void extern;
});

test("13. Een recept wijzigen", async ({ page, extern }) => {
  await resetDemo();
  await meldAan(page);
  await page.goto(`/recepten/${R(3)}/bewerken`);
  const naam = page.getByLabel("Naam van het gerecht");
  await expect(naam).toHaveValue("Zalm met citroen en dille", { timeout: 60_000 });
  await naam.fill("Zalm met citroen, dille en hazelnoten");
  const ingr = page.getByLabel(/Ingrediënten — één per regel/);
  await ingr.fill(`${await ingr.inputValue()}\n50 g hazelnoten`);
  await page
    .getByRole("button", { name: /^(Klaar|Bewaren)$/ })
    .filter({ visible: true })
    .first()
    .click();
  // Controle vóór bewaren: hazelnoten botsen met Lotte (noten, niet gedeeld) — zonder reden.
  const controle = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Klopt alles?" }) });
  const let_op = controle.getByRole("note", { name: "Niet geschikt voor wie meeëet" });
  await expect(let_op).toContainText("Lotte");
  await expect(let_op).not.toContainText(/noten/i);
  await controle.getByRole("button", { name: "Bewaren", exact: true }).click();
  await expect
    .poll(async () => (await tabel("recipes")).find((r) => r["id"] === R(3))?.["title"])
    .toBe("Zalm met citroen, dille en hazelnoten");
  await expect
    .poll(async () =>
      (await tabel("recipe_ingredients"))
        .filter((i) => i["recipe_id"] === R(3))
        .map((i) => i["name"]),
    )
    .toContain("hazelnoten");
  // Het origineel blijft bewaard als versie (niets stil overschreven).
  await expect.poll(async () => (await tabel("recipe_versions")).length).toBeGreaterThan(0);
  // Veiligheid: Lotte (noten, niet gedeeld) — het recept zegt "niet veilig", zonder reden.
  await page.goto(`/recepten/${R(3)}`);
  await expect(page.getByText(/Niet (veilig|geschikt) voor .*Lotte/).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Lotte: /)).toHaveCount(0);
  void extern;
});

test("14. Een boodschappenlijst delen", async ({ page, context, extern }) => {
  await resetDemo();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await meldAan(page);
  await page.goto("/boodschappen");
  await page.getByRole("button", { name: "Meer opties voor deze lijst" }).click();
  await page.getByRole("button", { name: "Lijst delen" }).click();
  const venster = page.getByRole("dialog", { name: "Lijst delen" });
  await venster.getByRole("button", { name: "Deel met een link" }).click();
  await expect(venster.getByText(/\/uitnodiging\?code=/)).toBeVisible();
  await expect(venster.getByText(/nog niet aanvaard/)).toBeVisible();
  // Gegevens: alleen de boodschappen worden gedeeld, geen recepten of planning.
  const delen = (await tabel("shares")).filter((s) => s["owner_id"] === MARIE);
  expect(delen).toHaveLength(1);
  expect(delen[0]).toMatchObject({
    shopping_view: true,
    shopping_edit: true,
    recipes_view: false,
    planner_view: false,
  });
  // Stoppen met delen werkt ook.
  await venster.getByRole("button", { name: "Stop delen" }).click();
  await expect.poll(async () => (await tabel("shares")).length).toBe(0);
  void extern;
});

test("15. Het budget wijzigen", async ({ page, extern }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/instellingen");
  const veld = page.getByLabel("Wat wil je per week uitgeven aan eten? (in euro)");
  await veld.fill("veel");
  await page.getByRole("button", { name: "Bewaar budget" }).click();
  await expect(page.getByRole("alert")).toContainText("Typ een bedrag in euro");
  await veld.fill("10");
  await page.getByRole("button", { name: "Bewaar budget" }).click();
  await expect(page.getByText("Weekbudget bewaard: € 10,00")).toBeVisible();
  await page.goto("/planner");
  const budget = page.getByRole("region", { name: "Budget deze week" });
  await expect(budget).toContainText("van € 10,00");
  await expect(budget.getByRole("status")).toContainText("boven je weekbudget");
  // Gegevens: het budget staat bewaard (op het account of, zonder tabel, op dit toestel).
  const opslag =
    JSON.stringify(await nepDb()) + (await page.evaluate(() => JSON.stringify(localStorage)));
  expect(opslag).toMatch(/budget/i);
  void extern;
});

test("16. Een goedkopere week voorstellen", async ({ page, extern }) => {
  await resetDemo();
  await alleenDeze(PEETERS);
  await page.clock.setFixedTime(ZONDAG);
  await meldAan(page);
  const PLAN = "c2c2c2c2-0000-4000-8000-000000000001";
  await seedDb({
    meal_plan: [
      {
        id: PLAN,
        user_id: MARIE,
        recipe_id: rid(2), // stoofvlees
        plan_date: iso(ZONDAG),
        meal_type: "avondeten",
        personen: 3,
        custom_title: null,
        soort: null,
        group_id: null,
      },
    ],
  });
  const maandag = iso(new Date(ZONDAG.getTime() - 6 * 86400000));
  await page.goto(`/week-samenstellen?goedkoper=1&week=${maandag}`);
  await expect(page.getByRole("heading", { name: "Maak je week goedkoper", level: 1 })).toBeVisible(
    {
      timeout: 60_000,
    },
  );
  const wissels = page.getByRole("list", { name: "Voorgestelde wissels" });
  await expect(wissels).toContainText("Stoofvlees met frietjes →", { timeout: 30_000 });
  // Veiligheid: iedereen eet mee (ook Gust en Lotte) → vegetarisch en zonder noten.
  const tekst = await wissels.innerText();
  for (const t of [
    ...VLEES_OF_VIS.filter((x) => x !== "Stoofvlees met frietjes"),
    "Pasta met hazelnootpesto",
  ])
    expect(tekst).not.toContain(`→ ${t}`);
  await page.getByRole("button", { name: /^Wissel 1 gerecht/ }).click();
  await expect(page.getByRole("heading", { name: "Gewisseld" })).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await planRij(PLAN))?.["recipe_id"]).not.toBe(rid(2));
  expect(VEGETARISCH_PEETERS.has(String((await planRij(PLAN))?.["recipe_id"]))).toBe(true);
  void extern;
});

test("17. Een maaltijd met restjes voorstellen", async ({ page, extern }) => {
  await resetDemo();
  await fetch(`${NEP}/meal_plan?plan_date=eq.${dag(0)}`, { method: "DELETE" });
  await zetKlok(page, 17);
  await meldAan(page);
  // Twee restjes; Marie heeft een glutenallergie → de spaghetti (gluten) wordt niet voorgesteld.
  await page.addInitScript(
    ([id]) => {
      window.localStorage.setItem(
        `foodlo:kennismaking:${id}`,
        JSON.stringify({ allergieen: ["gluten"] }),
      );
      const sleutel = `foodlo:restjes:${id}`;
      if (!window.localStorage.getItem(sleutel))
        window.localStorage.setItem(
          sleutel,
          JSON.stringify([
            {
              id: "r-1",
              titel: "Spaghetti bolognese",
              receptId: "aaaaaaaa-0000-4000-8000-000000000004",
              porties: 2,
              gekookt: Date.now() - 86400000,
            },
            {
              id: "r-2",
              titel: "Romige pompoensoep",
              receptId: "aaaaaaaa-0000-4000-8000-000000000002",
              porties: 3,
              gekookt: Date.now() - 86400000,
            },
          ]),
        );
    },
    [MARIE],
  );
  const lijstVoor = (await tabel("shopping_items")).length;
  await page.goto("/");
  const kaart = page.getByRole("region", { name: "Nog restjes" });
  await expect(kaart).toContainText("Romige pompoensoep", { timeout: 30_000 });
  await expect(kaart).not.toContainText("Spaghetti bolognese");
  await kaart.getByRole("button", { name: "Eet vanavond restjes" }).click();
  await expect
    .poll(async () =>
      (await tabel("meal_plan"))
        .filter((p) => String(p["custom_title"] ?? "").startsWith("Restjes: "))
        .map((p) => [p["custom_title"], p["plan_date"]]),
    )
    .toEqual([["Restjes: Romige pompoensoep", dag(0)]]);
  // Restjes: niets extra op de lijst.
  expect((await tabel("shopping_items")).length).toBe(lijstVoor);
  void extern;
});

test("18. Een weekplanning terugdraaien", async ({ page, extern }) => {
  await resetDemo();
  await alleenDeze(PEETERS);
  await page.clock.setFixedTime(ZONDAG);
  await meldAan(page);
  const lijstVoor = ((await tabel("shopping_items")) as unknown as Rij[])
    .map((i) => `${i.name}|${i.quantity}`)
    .sort();
  await naarSamenstellen(page);
  await page.getByRole("button", { name: /^Stel mijn menu samen/ }).click();
  await expect(voorstel(page, MA).locator("[data-titel]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Bewaar dit menu" }).click();
  await expect(page.getByRole("heading", { name: "Je menu staat in Week" })).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(async () => (await tabel("meal_plan")).length).toBeGreaterThanOrEqual(5);
  // Eén "Ongedaan maken" zet menu, mee-eters en lijst terug.
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect(page.getByText("Menu teruggezet").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await tabel("meal_plan")).length).toBe(0);
  const lijstNa = ((await tabel("shopping_items")) as unknown as Rij[])
    .map((i) => `${i.name}|${i.quantity}`)
    .sort();
  expect(lijstNa).toEqual(lijstVoor);
  void extern;
});

test("19. Gelijktijdige gezinswijzigingen verwerken", async ({ page, extern }) => {
  await resetDemo();
  const PLAN = "c5c5c5c5-0000-4000-8000-000000000001";
  await seedDb({
    meal_plan: [
      {
        id: PLAN,
        user_id: MARIE,
        group_id: GEZIN,
        recipe_id: R(1),
        custom_title: null,
        soort: null,
        personen: 4,
        plan_date: dag(0),
        meal_type: "avondeten",
        created_at: "2026-11-01T10:00:00Z",
      },
    ],
  });
  await meldAan(page);
  const jan = await tweedeBrowser(page, JAN);
  try {
    // A. Beiden vullen tegelijk de gezinslijst aan: niets gaat verloren.
    await page.goto("/boodschappen?lijst=gezin");
    await jan.p.goto("/boodschappen?lijst=gezin");
    const veldM = page.getByRole("textbox", { name: "Iets toevoegen" });
    const veldJ = jan.p.getByRole("textbox", { name: "Iets toevoegen" });
    await expect(page.getByText("volkorenbrood").first()).toBeVisible({ timeout: 30_000 });
    await expect(jan.p.getByText("volkorenbrood").first()).toBeVisible({ timeout: 30_000 });
    await veldM.fill("eieren");
    await veldJ.fill("boter");
    await Promise.all([veldM.press("Enter"), veldJ.press("Enter")]);
    await expect
      .poll(async () => Object.keys(await lijstPerNaam(GEZINSLIJST)).sort())
      .toEqual(["appels", "boter", "eieren", "jonge kaas", "volkorenbrood"]);
    // Jan ziet het product van Marie zonder te herladen.
    await expect(jan.p.getByText("eieren").first()).toBeVisible({ timeout: 30_000 });

    // B. Beiden veranderen dezelfde gezinsmaaltijd: wie tweede is, krijgt een keuze.
    await page.goto("/planner?weergave=gezin");
    await jan.p.goto("/planner?weergave=gezin");
    const kies = async (p: Page, nieuw: string) => {
      await planActie(p, "Stoofvlees met frietjes", "Ander gerecht");
      const blad = p.getByRole("dialog", { name: "Ander gerecht" });
      await blad.getByRole("textbox", { name: "Zoek in je recepten" }).fill(nieuw);
      return () =>
        blad
          .getByRole("button", { name: new RegExp(nieuw, "i") })
          .first()
          .click();
    };
    const marieKiest = await kies(page, "Griekse salade");
    const janKiest = await kies(jan.p, "Romige pompoensoep");
    await janKiest();
    await expect.poll(async () => (await planRij(PLAN))?.["recipe_id"]).toBe(R(2));
    await marieKiest();
    const keuze = page.getByTestId("conflict-keuze");
    await expect(keuze).toBeVisible();
    await expect(keuze.getByRole("heading")).toContainText("Jan veranderde");
    // Niet stil overschreven: de keuze van Jan staat er nog.
    expect((await planRij(PLAN))?.["recipe_id"]).toBe(R(2));
    await keuze.getByRole("button", { name: "Houd die van Jan" }).click();
    await expect(keuze).toBeHidden();
    expect((await planRij(PLAN))?.["recipe_id"]).toBe(R(2));
  } finally {
    await jan.ctx.close();
  }
  void extern;
});

test("20. Offline en verbindingsherstel testen", async ({ page, context, extern }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  // Eerst online, zoals in het echt: de app (service worker) is geïnstalleerd en je opent Week
  // en Lijst. Dat is de laatst bekende stand.
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 })
    .toBe(true);
  const naar = async (naam: RegExp) =>
    page.getByRole("link", { name: naam }).filter({ visible: true }).first().click();
  await naar(/^Week/);
  await expect(page).toHaveURL(/\/planner/);
  // Wachten op het weekmenu zelf (Vandaag toont het stoofvlees ook).
  await expect(
    page
      .getByRole("button", { name: "Acties voor Stoofvlees met frietjes" })
      .filter({ visible: true })
      .first(),
  ).toBeVisible({ timeout: 60_000 });
  await naar(/^Lijst/);
  await expect(page).toHaveURL(/\/boodschappen/);
  await expect(page.getByText("donker bier").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800); // offline-cache bewaren (gebundeld per 0,5 s)

  await context.setOffline(true);
  const band = page.getByTestId("offline-band");
  await expect(band).toContainText(
    "Je bent offline — wijzigingen worden bewaard en straks verstuurd.",
  );
  // Afvinken en toevoegen gaan in de wachtrij: nog niets in de databank.
  const vink = async (naam: string) => {
    const v = page.getByRole("checkbox", { name: `${naam} als gekocht aanvinken` });
    await v.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await v.click();
  };
  await vink("melk");
  await vink("citroen");
  await page.getByRole("textbox", { name: "Iets toevoegen" }).fill("250 g boter");
  await page.getByRole("textbox", { name: "Iets toevoegen" }).press("Enter");
  await expect(band).toContainText("3 wijzigingen wachten om verstuurd te worden.");
  await expect(page.getByText("Wacht op verbinding").first()).toBeVisible();
  const db = async () => (await tabel("shopping_items")).filter((i) => i["list_id"] === LIJST);
  expect((await db()).find((i) => i["name"] === "melk")?.["checked"]).toBe(false);
  expect((await db()).some((i) => i["name"] === "boter")).toBe(false);
  // Laatst bekende planning blijft zichtbaar (in de app naar Week).
  await naar(/^Week/);
  await expect(page).toHaveURL(/\/planner/);
  await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible();
  await expect(
    page.getByText("Stoofvlees met frietjes").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(band).toContainText("Je bent offline");
  // Intussen haalt een gezinslid (ander toestel) de citroen van de lijst.
  await fetch(`${NEP}/shopping_items?id=eq.ffffffff-0000-4000-8000-000000000005`, {
    method: "DELETE",
  });
  // Terug naar de lijst (vorige pagina, zoals de terugknop van de telefoon).
  await page.goBack();
  await expect(page).toHaveURL(/\/boodschappen/);
  await expect(page.getByText("donker bier").first()).toBeVisible();

  // Verbinding terug: alles verstuurd, eerlijke melding over de citroen, niets stil hersteld.
  await context.setOffline(false);
  await expect(page.getByText("Je wijzigingen zijn bewaard en verstuurd").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(/1 product werd intussen van de lijst gehaald/).first(),
  ).toBeVisible();
  await expect(band).not.toContainText("offline");
  await expect
    .poll(async () => (await db()).find((i) => i["name"] === "melk")?.["checked"])
    .toBe(true);
  expect((await db()).some((i) => /citroen/.test(String(i["name"])))).toBe(false);
  expect((await db()).filter((i) => i["name"] === "boter")).toHaveLength(1);
  expect(
    await page.evaluate(() => localStorage.getItem("foodlo-boodschappen-wachtrij")),
  ).toBeNull();
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});
