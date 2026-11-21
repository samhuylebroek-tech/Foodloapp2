/**
 * Werkstroom A: voorstellen houden rekening met wie meeeet (voorstel 0010, alleen nep-databank).
 * Demo-gezin: Lotte (kind, beheerd door Jan) is allergisch voor noten en deelt dat niet;
 * Gust (beheerd door Marie) is vegetarisch en deelt dat wel.
 */
import { expect, meldAan, resetDemo, seedDb, test, zetKlok } from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const MARIE = "11111111-1111-4111-8111-111111111111";
const vandaag = () => new Date().toLocaleDateString("sv-SE");

const RECEPTEN = [
  {
    id: "aaaaaaaa-0000-4000-8000-0000000000e1",
    title: "Pasta met hazelnootpesto",
    tags: [],
    ingr: ["spaghetti", "hazelnoten", "basilicum"],
  },
  {
    id: "aaaaaaaa-0000-4000-8000-0000000000e2",
    title: "Kipcurry met rijst",
    tags: [],
    ingr: ["kipfilet", "rijst", "currypasta"],
  },
  {
    id: "aaaaaaaa-0000-4000-8000-0000000000e3",
    title: "Tomatensoep met basilicum",
    tags: ["vegetarisch"],
    ingr: ["tomaten", "ui", "selder"],
  },
];

async function alleenDeze(welke: typeof RECEPTEN) {
  // Alleen onze recepten: zo weten we zeker wat Foodlo zou voorstellen.
  await fetch(`${NEP}/recipes?is_concept=eq.false`, { method: "DELETE" });
  await fetch(`${NEP}/meal_plan?plan_date=eq.${vandaag()}`, { method: "DELETE" });
  await seedDb({
    recipes: welke.map((r, i) => ({
      id: r.id,
      user_id: MARIE,
      title: r.title,
      servings: 4,
      prep_minutes: 10,
      cook_minutes: 15,
      is_concept: false,
      tags: r.tags,
      category: "hoofdgerecht",
      instructions: ["Kook alles."],
      image_url: null,
      deleted_at: null,
      created_at: `2026-11-1${i}T10:00:00Z`,
    })),
    recipe_ingredients: welke.flatMap((r, n) =>
      r.ingr.map((name, position) => ({
        id: `aaaaaaaa-0e${n}0-4000-8000-00000000000${position}`,
        recipe_id: r.id,
        name,
        quantity: 100,
        unit: "g",
        position,
      })),
    ),
  });
}

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await zetKlok(page, 17);
});

test("Vandaag: geen voorstel dat niet veilig is voor een mee-eter", async ({ page, extern }) => {
  await alleenDeze(RECEPTEN);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const voorstellen = page.getByRole("region", {
    name: /Met wat je in huis hebt|Ideeën voor vanavond/,
  });
  await expect(
    voorstellen.getByRole("button", { name: "Kook Tomatensoep met basilicum vanavond" }),
  ).toBeVisible();
  await expect(
    voorstellen.getByRole("button", { name: "Kook Pasta met hazelnootpesto vanavond" }),
  ).toHaveCount(0);
  await expect(
    voorstellen.getByRole("button", { name: "Kook Kipcurry met rijst vanavond" }),
  ).toHaveCount(0);
  await expect(voorstellen.getByTestId("voor-wie")).toHaveText(
    "Rekening gehouden met Marie, Jan, Lotte en Gust.",
  );
  await expect(voorstellen.getByTestId("niet-geschikt")).toHaveCount(0);
  void extern;
});

test("Vandaag: past niets voor iedereen, dan staat erbij voor wie niet (zonder geheime reden)", async ({
  page,
  extern,
}) => {
  await alleenDeze(RECEPTEN.slice(0, 2));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const voorstellen = page.getByRole("region", {
    name: /Met wat je in huis hebt|Ideeën voor vanavond/,
  });
  const pesto = voorstellen.getByRole("listitem").filter({ hasText: "Pasta met hazelnootpesto" });
  await expect(pesto.getByTestId("niet-geschikt")).toHaveText("Niet geschikt voor Lotte");
  // Lotte deelt haar allergie niet: Marie ziet niet waarom.
  await expect(pesto).not.toContainText(/noten/i);
  const curry = voorstellen.getByRole("listitem").filter({ hasText: "Kipcurry met rijst" });
  // Gust deelt zijn dieet: dan mag de reden erbij.
  await expect(curry.getByTestId("niet-geschikt")).toHaveText(
    "Niet geschikt voor Gust (Gust: past niet bij vegetarisch)",
  );
  void extern;
});

test("Week: 'Laat Foodlo kiezen' vraagt wie meeeet en stelt niets onveiligs voor", async ({
  page,
  extern,
}) => {
  await alleenDeze(RECEPTEN);
  // Een lege week, zodat elke dag een voorstel krijgt.
  await fetch(`${NEP}/meal_plan?user_id=eq.${MARIE}`, { method: "DELETE" });
  await page.goto("/planner");
  await page
    .getByRole("button", { name: /Laat Foodlo kiezen/ })
    .first()
    .click();
  const wie = page.getByRole("group", { name: "Wie eet mee?" });
  await expect(wie.getByRole("button", { name: "Lotte" })).toHaveAttribute("aria-pressed", "true");
  // Gust eet deze week niet mee: dan mag de kipcurry wel, de pesto (Lotte) nog altijd niet.
  await wie.getByRole("button", { name: "Gust" }).click();
  await expect(wie.getByRole("button", { name: "Gust" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Laat Foodlo kiezen" }).last().click();
  await expect(page.getByText(/Dag 1 van \d+/)).toBeVisible();
  const gezien = new Set<string>();
  const aantal = Number((await page.getByText(/Dag 1 van \d+/).innerText()).match(/van (\d+)/)![1]);
  for (let n = 0; n < aantal; n++) {
    gezien.add(await page.locator("h4").first().innerText());
    if (n < aantal - 1)
      await page.getByRole("button", { name: "Volgende dag", exact: true }).click();
  }
  expect([...gezien]).not.toContain("Pasta met hazelnootpesto");
  expect([...gezien].some((t) => /Kipcurry|Tomatensoep/.test(t))).toBe(true);

  // Zelf kiezen kan wel, maar dan staat er duidelijk voor wie het niet geschikt is.
  await page.getByRole("button", { name: "Ik wil iets anders" }).click();
  await page.getByPlaceholder("Zoek in mijn recepten").fill("hazelnoot");
  await page
    .getByRole("button", { name: /Pasta met hazelnootpesto/ })
    .first()
    .click();
  await expect(page.getByTestId("niet-geschikt")).toHaveText("Niet geschikt voor Lotte");
  void extern;
});

test("Vandaag: 'Wie eet mee vanavond?' aanpassen verandert de voorstellen", async ({
  page,
  extern,
}) => {
  await alleenDeze(RECEPTEN);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const voorstellen = page.getByRole("region", {
    name: /Met wat je in huis hebt|Ideeën voor vanavond/,
  });
  const curry = voorstellen.getByRole("button", { name: "Kook Kipcurry met rijst vanavond" });
  await expect(curry).toHaveCount(0);
  await voorstellen.getByRole("button", { name: "Wie eet mee vanavond?" }).click();
  await voorstellen
    .getByRole("group", { name: "Wie eet mee vanavond?" })
    .getByRole("button", { name: "Gust" })
    .click();
  await expect(voorstellen.getByTestId("voor-wie")).toHaveText(
    "Rekening gehouden met Marie, Jan en Lotte.",
  );
  await expect(curry).toBeVisible();
  // Blijft vandaag bewaard op dit toestel.
  await page.reload();
  await expect(curry).toBeVisible();
  await expect(
    voorstellen.getByRole("button", { name: "Kook Pasta met hazelnootpesto vanavond" }),
  ).toHaveCount(0);
  void extern;
});
