/**
 * P1 Slimme planner — scenario gezin Peeters (nep-databank).
 * Marie, Jan, Lotte (noten, deelt het niet) en opa Gust (vegetarisch) die alleen woensdag en
 * zondag meeëet. Maandag weinig tijd, dinsdag niemand thuis. Klok: een zondag, zodat "volgende
 * week" begint binnen de 7 dagen waarin de lijst meegaat.
 */
import type { Locator, Page } from "@playwright/test";
import { axeErnstig, expect, meldAan, nepDb, resetDemo, seedDb, test } from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const MARIE = "11111111-1111-4111-8111-111111111111";

const iso = (d: Date) => d.toLocaleDateString("sv-SE");
function zondag(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setHours(14, 0, 0, 0);
  return d;
}
const ZONDAG = zondag();
const VOLGENDE = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(ZONDAG);
  d.setDate(d.getDate() + 1 + i);
  return iso(d);
});
const [MA, DI, WO, DO, VR, ZA, ZO] = VOLGENDE as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

type R = {
  n: number;
  title: string;
  min: number;
  tags: string[];
  ingr: [string, number, string][];
  stappen?: string[];
};
const RECEPTEN: R[] = [
  {
    n: 1,
    title: "Kip met rijst",
    min: 25,
    tags: [],
    ingr: [
      ["kipfilet", 600, "g"],
      ["rijst", 300, "g"],
      ["paprika", 2, ""],
    ],
  },
  {
    n: 2,
    title: "Stoofvlees met frietjes",
    min: 170,
    tags: [],
    ingr: [
      ["rundvlees", 1000, "g"],
      ["uien", 3, ""],
      ["bier", 50, "cl"],
    ],
  },
  {
    n: 3,
    title: "Spaghetti bolognese",
    min: 60,
    tags: [],
    ingr: [
      ["spaghetti", 400, "g"],
      ["rundergehakt", 500, "g"],
      ["passata", 70, "cl"],
    ],
  },
  {
    n: 4,
    title: "Pasta met tomaat",
    min: 20,
    tags: ["vegetarisch"],
    ingr: [
      ["pasta", 400, "g"],
      ["passata", 50, "cl"],
    ],
  },
  {
    n: 5,
    title: "Pompoensoep",
    min: 35,
    tags: ["vegetarisch"],
    ingr: [
      ["pompoen", 1, "kg"],
      ["ui", 1, ""],
      ["room", 20, "cl"],
    ],
  },
  {
    n: 6,
    title: "Omelet met spinazie",
    min: 15,
    tags: ["vegetarisch"],
    ingr: [
      ["eieren", 8, ""],
      ["spinazie", 300, "g"],
    ],
  },
  {
    n: 7,
    title: "Groentecurry",
    min: 40,
    tags: ["vegetarisch"],
    ingr: [
      ["kikkererwten", 400, "g"],
      ["kokosmelk", 40, "cl"],
      ["spinazie", 200, "g"],
    ],
  },
  {
    n: 8,
    title: "Krokante frietjes",
    min: 25,
    tags: ["vegetarisch"],
    ingr: [["aardappelen", 1000, "g"]],
    stappen: ["Snij de aardappelen.", "Bak 20 minuten in de airfryer op 180 graden."],
  },
  {
    n: 9,
    title: "Zalm met krieltjes",
    min: 25,
    tags: ["vis"],
    ingr: [
      ["zalmfilet", 4, "stuk(s)"],
      ["krieltjes", 800, "g"],
    ],
  },
  {
    n: 10,
    title: "Linzenstoof",
    min: 45,
    tags: ["vegetarisch"],
    ingr: [
      ["linzen", 300, "g"],
      ["wortel", 3, ""],
      ["ui", 1, ""],
    ],
  },
  {
    n: 11,
    title: "Pasta met hazelnootpesto",
    min: 20,
    tags: ["vegetarisch"],
    ingr: [
      ["pasta", 400, "g"],
      ["hazelnoten", 60, "g"],
    ],
  },
];
const VLEES_OF_VIS = [
  "Kip met rijst",
  "Stoofvlees met frietjes",
  "Spaghetti bolognese",
  "Zalm met krieltjes",
];
const rid = (n: number) => `a1a1a1a1-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

async function alleenDeze(welke: R[]) {
  await fetch(`${NEP}/recipes?id=neq.0`, { method: "DELETE" });
  await fetch(`${NEP}/recipe_ingredients?id=neq.0`, { method: "DELETE" });
  await fetch(`${NEP}/meal_plan?id=neq.0`, { method: "DELETE" });
  await seedDb({
    recipes: welke.map((r) => ({
      id: rid(r.n),
      user_id: MARIE,
      title: r.title,
      description: "",
      servings: 4,
      prep_minutes: Math.min(r.min, 10),
      cook_minutes: Math.max(0, r.min - 10),
      difficulty: "makkelijk",
      is_concept: false,
      tags: r.tags,
      category: "hoofdgerecht",
      instructions: r.stappen ?? ["Maak alles klaar en dien op."],
      image_url: null,
      deleted_at: null,
      created_at: `2026-11-01T10:00:${String(r.n).padStart(2, "0")}Z`,
    })),
    recipe_ingredients: welke.flatMap((r) =>
      r.ingr.map(([name, quantity, unit], p) => ({
        id: `b1b1b1b1-00${String(r.n).padStart(2, "0")}-4000-8000-00000000000${p}`,
        recipe_id: rid(r.n),
        name,
        quantity,
        unit,
        position: p,
      })),
    ),
  });
}

async function naarSamenstellen(page: Page) {
  await page.goto("/planner");
  await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Stel mijn week samen" }).click();
  await expect(page.getByRole("heading", { name: "Stel je week samen", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Volgende week", exact: true }).click();
  await expect(page.locator(`li[data-dag="${MA}"]`)).toBeVisible({ timeout: 30_000 });
}

const dag = (page: Page, d: string) => page.locator(`li[data-dag="${d}"]`);
const voorstel = (page: Page, d: string) => page.locator(`li[data-voorstel="${d}"]`);
const titel = async (l: Locator) => ((await l.locator("[data-titel]").innerText()) ?? "").trim();
const kost = async (l: Locator) => Number(await l.locator("[data-kost]").getAttribute("data-kost"));
const planVolgendeWeek = async () =>
  ((await nepDb()).meal_plan ?? []).filter((p) => VOLGENDE.includes(String(p["plan_date"])));

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
  for (const d of [MA, DO, VR, ZA])
    await dag(page, d)
      .getByRole("button", { name: /^Gust eet mee op/ })
      .click();
  await expect(dag(page, DO)).toContainText("Staat al: Stoofvlees met frietjes");
  const plannen = dag(page, DO).getByRole("checkbox", { name: "Plannen" });
  await expect(plannen).not.toBeChecked();
  await plannen.check();
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
  await expect(page.getByText(/Dit menu ≈ € .* \(schatting\)/)).toBeVisible();
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
