/**
 * Fase 1 — veiligheid overal gelijk, voor iedereen die meeëet (alleen nep-databank).
 * Demo-gezin: Gust (vegetarisch, deelt) eet standaard mee, ook vandaag met "Stoofvlees met
 * frietjes". Lotte (notenallergie, deelt niet) en Jan (liever geen gember, deelt) eten ook mee.
 */
import { expect, meldAan, nepDb, resetDemo, test, zetKlok } from "./helpers";

const STOOF = "aaaaaaaa-0000-4000-8000-000000000001";
const PLAN_VANDAAG = "cccccccc-0000-4000-8000-000000000000";

const etersVan = async (planId: string) =>
  ((await nepDb()).maaltijd_eters ?? [])
    .filter((e) => e.meal_plan_id === planId)
    .map((e) => String(e.lid_id))
    .sort();

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await zetKlok(page, 14);
});

test("Vandaag: waarschuwing voor Gust, weg na 'Gust eet niet mee', terug na ongedaan maken", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  const held = page.locator('section[aria-labelledby="vandaag-groet"]');
  await expect(held.getByRole("heading", { name: "Stoofvlees met frietjes" })).toBeVisible();
  const oordeel = held.getByTestId("eters-oordeel");
  await expect(oordeel).toHaveAttribute("data-niveau", "hard");
  await expect(oordeel).toContainText("Niet geschikt voor Gust");
  await expect(oordeel).toContainText("Gust: past niet bij vegetarisch");
  // Lotte deelt haar allergie niet: geen woord over noten.
  await expect(held).not.toContainText(/noten/i);
  await expect(held.getByTestId("eet-mee")).toHaveText("Eet mee: Marie, Jan, Lotte en Gust");

  await held.getByRole("button", { name: "Gust eet niet mee" }).click();
  await expect(oordeel).toHaveCount(0);
  await expect(held.getByTestId("eet-mee")).toHaveText("Eet mee: Marie, Jan en Lotte");
  await expect
    .poll(() => etersVan(PLAN_VANDAAG))
    .toEqual([
      "aeaeaeae-0000-4000-8000-000000000001",
      "aeaeaeae-0000-4000-8000-000000000002",
      "aeaeaeae-0000-4000-8000-000000000003",
    ]);

  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(held.getByTestId("eters-oordeel")).toContainText("Niet geschikt voor Gust");
  await expect.poll(() => etersVan(PLAN_VANDAAG)).toEqual([]);
  void extern;
});

test("Vandaag: 'Wie eet mee?' en het oordeel blijven na herladen", async ({ page, extern }) => {
  await page.goto("/");
  const held = page.locator('section[aria-labelledby="vandaag-groet"]');
  await held.getByRole("button", { name: "Wie eet mee?" }).click();
  const keuze = held.getByRole("group", { name: "Wie eet mee: Stoofvlees met frietjes" });
  await keuze.getByRole("button", { name: "Gust" }).click();
  await expect(keuze.getByRole("button", { name: "Gust" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.reload();
  await expect(held.getByTestId("eet-mee")).toHaveText("Eet mee: Marie, Jan en Lotte");
  await expect(held.getByTestId("eters-oordeel")).toHaveCount(0);
  void extern;
});

test("kookstand: banner bij de start en markering bij het ingrediënt", async ({ page, extern }) => {
  await page.goto(`/recepten/${STOOF}?koken=1&plan=${PLAN_VANDAAG}`);
  const banner = page.getByTestId("kook-waarschuwing");
  await expect(banner).toContainText("Let op: past niet bij vegetarisch — Gust eet mee");
  await expect(banner).toHaveAttribute("data-niveau", "hard");
  const rund = page.getByRole("listitem").filter({ hasText: "rundvlees (stoofvlees)" }).first();
  await expect(rund.getByTestId("ingredient-botsing")).toHaveText("Niet voor Gust");
  // Uien botsen niet.
  await expect(
    page.getByRole("listitem").filter({ hasText: /^uien/ }).getByTestId("ingredient-botsing"),
  ).toHaveCount(0);

  // "Vervanger zoeken" opent de kookassistent bij dat ingrediënt.
  await banner.getByRole("button", { name: "Vervanger zoeken" }).click();
  const assistent = page.getByRole("dialog");
  await expect(assistent).toContainText(/champignons|Kikkererwten/i);

  // "Gust eet niet mee" haalt de banner weg (en ongedaan maken zet hem terug).
  await page.keyboard.press("Escape");
  await banner.getByRole("button", { name: "Gust eet niet mee" }).click();
  await expect(page.getByTestId("kook-waarschuwing")).toHaveCount(0);
  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(page.getByTestId("kook-waarschuwing")).toBeVisible();
  void extern;
});

test("boodschappen: markering bij een product dat botst, vervanger met ongedaan maken", async ({
  page,
  extern,
}) => {
  await page.goto("/boodschappen");
  const rij = page.getByRole("listitem").filter({ hasText: "rundvlees (stoofvlees)" }).first();
  const label = rij.getByTestId("lijst-botsing");
  await expect(label).toContainText("Niet voor Gust: past niet bij vegetarisch");
  await expect(label).toHaveAttribute("data-niveau", "hard");
  // Een product zonder botsing heeft geen markering.
  await expect(
    page.getByRole("listitem").filter({ hasText: "donker bier" }).getByTestId("lijst-botsing"),
  ).toHaveCount(0);

  await rij.getByRole("button", { name: "Vervanger zoeken voor rundvlees (stoofvlees)" }).click();
  const blad = page.getByRole("dialog", { name: /Vervanger voor rundvlees/ });
  await expect(blad).toContainText("Kikkererwten");
  await blad.getByRole("button", { name: "Zet Kikkererwten op mijn lijst" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Kikkererwten" }).first(),
  ).toBeVisible();
  await expect
    .poll(async () => ((await nepDb()).shopping_items ?? []).some((i) => i.name === "Kikkererwten"))
    .toBe(true);
  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect
    .poll(async () =>
      ((await nepDb()).shopping_items ?? []).some((i) => i.name === "rundvlees (stoofvlees)"),
    )
    .toBe(true);
  void extern;
});

test("Week: wie eet mee bewaren in het dagdetail, ook na herladen", async ({ page, extern }) => {
  await page.goto("/planner");
  await page
    .getByRole("button", { name: "Acties voor Stoofvlees met frietjes" })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Wie eet mee?" }).click();
  const blad = page.getByRole("dialog", { name: "Wie eet mee?" });
  await expect(blad.getByTestId("eters-oordeel")).toContainText("Niet geschikt voor Gust");
  const keuze = blad.getByRole("group", { name: "Wie eet mee: Stoofvlees met frietjes" });
  await keuze.getByRole("button", { name: "Gust" }).click();
  await expect(blad.getByTestId("eters-oordeel")).toHaveCount(0);
  await expect.poll(() => etersVan(PLAN_VANDAAG)).toHaveLength(3);

  await page.reload();
  // De kaart van vandaag toont nu wie meeëet (initialen) en geen waarschuwing meer.
  await expect(page.locator("[data-testid=mee-eters]:visible").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Acties voor Stoofvlees met frietjes" })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Wie eet mee?" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Wie eet mee?" })
      .getByRole("group", { name: "Wie eet mee: Stoofvlees met frietjes" })
      .getByRole("button", { name: "Gust" }),
  ).toHaveAttribute("aria-pressed", "false");
  void extern;
});

test("recept: zachte voorkeur ziet er anders uit dan een harde botsing", async ({
  page,
  extern,
}) => {
  // Pompoensoep met gember staat gepland voor het hele gezin; Jan eet liever geen gember.
  await page.goto("/recepten/aaaaaaaa-0000-4000-8000-000000000002");
  const zacht = page.getByTestId("eters-oordeel");
  await expect(zacht).toHaveAttribute("data-niveau", "zacht");
  await expect(zacht).toContainText("Liever niet voor Jan");
  await expect(zacht).toContainText("Jan: liever geen gember");
  await expect(zacht).not.toContainText("Niet geschikt");
  const gember = page
    .getByRole("listitem")
    .filter({ hasText: /^gember/ })
    .first();
  await expect(gember.getByTestId("ingredient-botsing")).toHaveAttribute("data-niveau", "zacht");
  // Stoofvlees: hard voor Gust.
  await page.goto(`/recepten/${STOOF}`);
  await expect(page.getByTestId("eters-oordeel")).toHaveAttribute("data-niveau", "hard");
  void extern;
});

test("weekvoorstel: de gekozen mee-eters worden bij elke maaltijd bewaard", async ({
  page,
  extern,
}) => {
  await fetch(
    "http://127.0.0.1:54439/rest/v1/meal_plan?user_id=eq.11111111-1111-4111-8111-111111111111",
    { method: "DELETE" },
  );
  await page.goto("/planner");
  await page
    .getByRole("button", { name: /Laat Foodlo kiezen/ })
    .first()
    .click();
  const wie = page.getByRole("group", { name: "Wie eet mee?" });
  await wie.getByRole("button", { name: "Gust" }).click();
  await expect(wie.getByRole("button", { name: "Gust" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Laat Foodlo kiezen" }).last().click();
  await expect(page.getByText(/Dag 1 van \d+/)).toBeVisible();
  const aantal = Number((await page.getByText(/Dag 1 van \d+/).innerText()).match(/van (\d+)/)![1]);
  for (let n = 0; n < aantal; n++) {
    const kies = page.getByRole("button", { name: "Deze dag kiezen" });
    if (await kies.isVisible()) await kies.click();
    if (n < aantal - 1) await page.getByRole("button", { name: "Volgende dag" }).click();
  }
  await page.getByRole("button", { name: /^Zet [1-9]\d* (dag|dagen) in mijn weekmenu/ }).click();
  await expect
    .poll(async () => ((await nepDb()).meal_plan ?? []).length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const db = await nepDb();
      const plannen = (db.meal_plan ?? []).map((p) => String(p.id));
      return plannen.every((id) => {
        const rijen = (db.maaltijd_eters ?? []).filter((e) => e.meal_plan_id === id);
        return (
          rijen.length === 3 &&
          !rijen.some((e) => e.lid_id === "aeaeaeae-0000-4000-8000-000000000004")
        );
      });
    })
    .toBe(true);
  void extern;
});
