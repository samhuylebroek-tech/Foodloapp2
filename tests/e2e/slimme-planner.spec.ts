/**
 * P1 Slimme planner — scenario gezin Peeters (nep-databank).
 * Marie, Jan, Lotte (noten, deelt het niet) en opa Gust (vegetarisch) die alleen woensdag en
 * zondag meeëet. Maandag weinig tijd, dinsdag niemand thuis. Klok: een zondag, zodat "volgende
 * week" begint binnen de 7 dagen waarin de lijst meegaat.
 */
import { axeErnstig, expect, meldAan, nepDb, resetDemo, seedDb, test } from "./helpers";
import {
  alleenDeze,
  dag,
  DI,
  DO,
  iso,
  kost,
  MA,
  MARIE,
  naarSamenstellen,
  planVolgendeWeek,
  RECEPTEN,
  rid,
  titel,
  VLEES_OF_VIS,
  VOLGENDE,
  voorstel,
  VR,
  WO,
  ZA,
  ZO,
  ZONDAG,
} from "./planner-scenario";

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await alleenDeze(RECEPTEN);
  await page.clock.setFixedTime(ZONDAG);
  await meldAan(page);
});

test("scenario Peeters: week samenstellen, goedkoper, bewaren en ongedaan maken", async ({
  page,
  extern,
}) => {
  // Er staat al iets op donderdag: dat wordt niet zomaar overschreven.
  await seedDb({
    meal_plan: [
      {
        id: "c1c1c1c1-0000-4000-8000-000000000001",
        user_id: MARIE,
        recipe_id: rid(2),
        plan_date: DO,
        meal_type: "avondeten",
        personen: 3,
        custom_title: null,
        soort: null,
        group_id: null,
      },
    ],
  });
  await naarSamenstellen(page);

  // Weekcontext.
  await dag(page, MA).getByRole("button", { name: "Weinig tijd" }).click();
  await dag(page, DI).getByRole("button", { name: "Niet thuis" }).click();
  await expect(dag(page, DO)).toContainText("Staat al: Stoofvlees met frietjes");
  const plannen = dag(page, DO).getByRole("checkbox", { name: "Plannen" });
  await expect(plannen).not.toBeChecked();
  await plannen.check();
  for (const d of [MA, DO, VR, ZA])
    await dag(page, d)
      .getByRole("button", { name: /^Gust eet mee op/ })
      .click();
  expect(await axeErnstig(page)).toEqual([]);
  await page.getByRole("button", { name: /^Stel mijn menu samen \(7 dagen\)$/ }).click();

  // Voorstel.
  await expect(voorstel(page, MA).locator("[data-titel]")).toBeVisible({ timeout: 30_000 });
  await expect(voorstel(page, DI)).toHaveAttribute("data-status", "niet-thuis");
  const maMin = Number(
    await voorstel(page, MA).locator("[data-minuten]").getAttribute("data-minuten"),
  );
  expect(maMin).toBeGreaterThan(0);
  expect(maMin).toBeLessThanOrEqual(30);
  for (const d of [WO, ZO]) expect(VLEES_OF_VIS).not.toContain(await titel(voorstel(page, d)));
  const alleTitels = await page.locator("[data-titel]").allInnerTexts();
  expect(alleTitels).not.toContain("Krokante frietjes"); // geen airfryer
  expect(alleTitels).not.toContain("Pasta met hazelnootpesto"); // Lotte
  for (const r of await page.locator('ul[aria-label="Waarom"]').allInnerTexts())
    expect(r.trim().length).toBeGreaterThan(0);
  await expect(page.getByText(/Dit menu ≈ €\s[\d,]+ \(schatting\)/)).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);

  // Goedkoper: op de duurste dag (niet wo/zo) is het alternatief goedkoper.
  let duurste = MA;
  let hoogste = -1;
  for (const d of [MA, DO, VR, ZA]) {
    const k = await kost(voorstel(page, d));
    if (k > hoogste) [duurste, hoogste] = [d, k];
  }
  await voorstel(page, duurste)
    .getByRole("button", { name: /^Goedkoper gerecht voor/ })
    .click();
  await expect(voorstel(page, duurste).getByRole("status")).toBeVisible();
  const nieuwKost = await kost(voorstel(page, duurste));
  const melding = await voorstel(page, duurste).getByRole("status").innerText();
  if (/^Goedkoper:/.test(melding)) expect(nieuwKost).toBeLessThan(hoogste);
  else expect(melding).toContain("Geen goedkoper gerecht");
  // Ook een alternatief op woensdag blijft vegetarisch (Gust eet mee).
  await voorstel(page, WO)
    .getByRole("button", { name: /^Past beter gerecht voor/ })
    .click();
  expect(VLEES_OF_VIS).not.toContain(await titel(voorstel(page, WO)));

  // Bewaren: eerst de vraag over donderdag.
  const lijstVoor = ((await nepDb()).shopping_items ?? [])
    .map((i) => `${i["name"]}|${i["quantity"]}`)
    .sort();
  await page.getByRole("button", { name: "Bewaar dit menu" }).click();
  const vraag = page.getByRole("alertdialog");
  await expect(vraag).toContainText("Stoofvlees met frietjes");
  await vraag.getByRole("button", { name: "Ja, vervang ze" }).click();
  await expect(page.getByRole("heading", { name: "Je menu staat in Week" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Menu bewaard · lijst: \d+ erbij/).first()).toBeVisible();
  await expect.poll(async () => (await planVolgendeWeek()).length).toBe(6);
  const gepland = await planVolgendeWeek();
  expect(gepland.some((p) => p["plan_date"] === DI)).toBe(false);
  expect(gepland.find((p) => p["plan_date"] === DO)?.["id"]).toBe(
    "c1c1c1c1-0000-4000-8000-000000000001",
  );
  // Porties uit het aantal eters: woensdag 4 (met Gust), vrijdag 3.
  expect(gepland.find((p) => p["plan_date"] === WO)?.["personen"]).toBe(4);
  expect(gepland.find((p) => p["plan_date"] === VR)?.["personen"]).toBe(3);
  const lijstNa = ((await nepDb()).shopping_items ?? []).length;
  expect(lijstNa).toBeGreaterThan(lijstVoor.length);
  // Wie meeëet is per maaltijd bewaard (vrijdag zonder Gust).
  const vrId = gepland.find((p) => p["plan_date"] === VR)?.["id"];
  const etersVr = ((await nepDb()).maaltijd_eters ?? []).filter((e) => e["meal_plan_id"] === vrId);
  expect(etersVr.length).toBe(3);

  // Ongedaan maken: menu én lijst terug.
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect(page.getByText("Menu teruggezet").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await planVolgendeWeek()).length).toBe(1);
  const doNa = (await planVolgendeWeek())[0]!;
  expect(doNa["recipe_id"]).toBe(rid(2));
  const lijstTerug = ((await nepDb()).shopping_items ?? [])
    .map((i) => `${i["name"]}|${i["quantity"]}`)
    .sort();
  expect(lijstTerug).toEqual(lijstVoor);
  void extern;
});

test("airfryer: niet voorgesteld zonder airfryer, wel na Mijn keuken; lege dag versoepelen", async ({
  page,
  extern,
}) => {
  await alleenDeze(RECEPTEN.filter((r) => r.n === 8 || r.n === 4));
  await naarSamenstellen(page);
  await expect(page.getByText("Toestellen: oven en kookplaat aangenomen.")).toBeVisible();
  await page.getByRole("button", { name: /^Stel mijn menu samen/ }).click();
  await expect(voorstel(page, MA).locator("[data-titel]")).toBeVisible({ timeout: 30_000 });
  expect(await page.locator("[data-titel]").allInnerTexts()).not.toContain("Krokante frietjes");
  // Eén recept voor 7 dagen: de andere dagen zeggen eerlijk waarom ze leeg zijn.
  const leeg = page.locator('li[data-status="leeg"]').first();
  await expect(leeg).toContainText("staan deze week al op het menu");
  await leeg.getByRole("button", { name: "Mag een gerecht twee keer in de week" }).click();
  await expect(page.locator('li[data-status="leeg"]')).toHaveCount(0);

  // Airfryer aanvinken in Mijn keuken.
  await page.goto("/mijn-keuken");
  await expect(page.getByText(/neemt aan dat je een oven en een kookplaat hebt/)).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Airfryer", exact: true }).click();
  await page.getByRole("button", { name: "Bewaar mijn keuken" }).click();
  await expect(page.getByText("Je keuken is bewaard").first()).toBeVisible();
  await expect
    .poll(async () => ((await nepDb()).planprofiel ?? [])[0]?.["apparatuur"])
    .toEqual(["oven", "kookplaat", "airfryer"]);
  expect(await axeErnstig(page)).toEqual([]);

  await naarSamenstellen(page);
  await page.getByRole("button", { name: /^Stel mijn menu samen/ }).click();
  await expect(voorstel(page, MA).locator("[data-titel]")).toBeVisible({ timeout: 30_000 });
  expect(await page.locator("[data-titel]").allInnerTexts()).toContain("Krokante frietjes");
  void extern;
});

test("Maak mijn week goedkoper: verschillen tonen, wisselen en ongedaan maken", async ({
  page,
  extern,
}) => {
  const MAANDAG = iso(new Date(ZONDAG.getTime() - 6 * 86400000));
  await seedDb({
    meal_plan: [
      {
        id: "c2c2c2c2-0000-4000-8000-000000000001",
        user_id: MARIE,
        recipe_id: rid(2),
        plan_date: iso(ZONDAG),
        meal_type: "avondeten",
        personen: 3,
        custom_title: null,
        soort: null,
        group_id: null,
      },
    ],
  });
  await page.goto(`/week-samenstellen?goedkoper=1&week=${MAANDAG}`);
  await expect(page.getByRole("heading", { name: "Maak je week goedkoper", level: 1 })).toBeVisible(
    {
      timeout: 60_000,
    },
  );
  const wissels = page.getByRole("list", { name: "Voorgestelde wissels" });
  await expect(wissels).toContainText("Stoofvlees met frietjes →", { timeout: 30_000 });
  // Iedereen eet mee (ook Gust): het alternatief is vegetarisch en zonder noten.
  const tekst = await wissels.innerText();
  for (const t of [
    ...VLEES_OF_VIS.filter((x) => x !== "Stoofvlees met frietjes"),
    "Pasta met hazelnootpesto",
  ])
    expect(tekst).not.toContain(`→ ${t}`);
  expect(await axeErnstig(page)).toEqual([]);
  await page.getByRole("button", { name: /^Wissel 1 gerecht/ }).click();
  await expect(page.getByRole("heading", { name: "Gewisseld" })).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () =>
        ((await nepDb()).meal_plan ?? []).find(
          (p) => p["id"] === "c2c2c2c2-0000-4000-8000-000000000001",
        )?.["recipe_id"],
    )
    .not.toBe(rid(2));
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect
    .poll(
      async () =>
        ((await nepDb()).meal_plan ?? []).find(
          (p) => p["id"] === "c2c2c2c2-0000-4000-8000-000000000001",
        )?.["recipe_id"],
    )
    .toBe(rid(2));
  void extern;
});
