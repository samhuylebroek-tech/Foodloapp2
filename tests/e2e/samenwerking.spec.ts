/**
 * P5 — Samenwerking in het gezin (nep-databank, demo-gezin "Thuis": Marie en Jan).
 * Twee browsers tegelijk: Marie (demo@foodlo.be) en Jan (tweede gezinslid).
 * - Conflict: beiden veranderen dezelfde gezinsmaaltijd → wie tweede is, krijgt een keuze;
 *   "Zet de mijne" + één "Ongedaan maken" en "Houd die van Jan" werken, niets gaat verloren.
 * - Lijst verdelen: Marie laat Jan iets halen → Jan ziet het in "Mijn deel" en in de winkel.
 * - Meldingen: Jan krijgt een melding (bel), kan ze lezen; soort uit → geen melding.
 */
import type { Browser, Page } from "@playwright/test";
import { expect, meldAan, nepDb, resetDemo, seedDb, test } from "./helpers";

const JAN = "22222222-2222-4222-8222-222222222222";
const GEZIN = "abababab-0000-4000-8000-000000000001";
const PLAN = "c5c5c5c5-0000-4000-8000-000000000001";
const R = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const vandaag = new Date().toLocaleDateString("sv-SE");
const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const dag = DAGEN[new Date(`${vandaag}T12:00:00`).getDay()]!;

test.describe.configure({ timeout: 120_000 });

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

async function planRij() {
  return (await nepDb())["meal_plan"]!.find((r) => r["id"] === PLAN)!;
}

test.beforeEach(async () => {
  await resetDemo();
  await seedDb({
    meal_plan: [
      {
        id: PLAN,
        user_id: "11111111-1111-4111-8111-111111111111",
        group_id: GEZIN,
        recipe_id: R(1),
        custom_title: null,
        soort: null,
        personen: 4,
        plan_date: vandaag,
        meal_type: "avondeten",
        created_at: "2026-11-01T10:00:00Z",
      },
    ],
  });
});

async function kiesAnderGerecht(p: Page, nu: string, nieuw: string) {
  await p
    .getByRole("button", { name: `Acties voor ${nu}` })
    .first()
    .click();
  await p.getByRole("menuitem", { name: "Ander gerecht" }).click();
  const blad = p.getByRole("dialog", { name: "Ander gerecht" });
  await expect(blad).toBeVisible();
  await blad.getByRole("textbox", { name: "Zoek in je recepten" }).fill(nieuw);
  return {
    blad,
    kies: () =>
      blad
        .getByRole("button", { name: new RegExp(nieuw, "i") })
        .first()
        .click(),
  };
}

test("tegelijk dezelfde dag veranderen: keuze, Zet de mijne + ongedaan maken, Houd die van Jan", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  const jan = await tweedeBrowser(page, JAN);
  try {
    await page.goto("/planner?weergave=gezin");
    await jan.p.goto("/planner?weergave=gezin");
    await expect(
      page.getByText("Stoofvlees met frietjes").filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      jan.p.getByText("Stoofvlees met frietjes").filter({ visible: true }).first(),
    ).toBeVisible();

    // Marie opent "Ander gerecht" en twijfelt nog …
    const marie = await kiesAnderGerecht(page, "Stoofvlees met frietjes", "Griekse salade");
    // … intussen kiest Jan op zijn telefoon spaghetti.
    const j = await kiesAnderGerecht(jan.p, "Stoofvlees met frietjes", "Spaghetti bolognese");
    await j.kies();
    await expect.poll(async () => (await planRij())["recipe_id"]).toBe(R(4));

    // Marie kiest: niet stil overschreven, maar een keuze.
    await marie.kies();
    const keuze = page.getByTestId("conflict-keuze");
    await expect(keuze).toBeVisible();
    await expect(keuze.getByRole("heading")).toHaveText(
      `Jan veranderde ${dag} net in Spaghetti bolognese`,
    );
    expect((await planRij())["recipe_id"]).toBe(R(4));
    await keuze.getByRole("button", { name: "Bekijk allebei" }).click();
    const beide = keuze.getByRole("definition");
    await expect(beide.first()).toHaveText("Spaghetti bolognese");
    await expect(beide.nth(1)).toHaveText("Griekse salade");
    await expect(keuze.getByRole("button", { name: `Allebei op ${dag}` })).toBeVisible();
    await keuze.getByRole("button", { name: "Zet de mijne" }).click();
    await expect(keuze).toBeHidden();
    await expect.poll(async () => (await planRij())["recipe_id"]).toBe(R(6));

    // Jan hoort dat zijn keuze vervangen is (melding "Tegelijk gewijzigd").
    await expect
      .poll(async () =>
        ((await nepDb())["app_meldingen"] ?? [])
          .filter((m) => m["user_id"] === JAN && m["soort"] === "conflict")
          .map((m) => m["tekst"]),
      )
      .toEqual([`Marie zette ${dag} toch op Griekse salade (jij had Spaghetti bolognese gekozen)`]);

    // Eén "Ongedaan maken" zet de versie van Jan terug.
    await page.getByRole("button", { name: "Ongedaan maken" }).last().click();
    await expect.poll(async () => (await planRij())["recipe_id"]).toBe(R(4));

    // Tweede ronde: Marie houdt die van Jan → er verandert niets.
    await page.reload();
    await expect(
      page.getByText("Spaghetti bolognese").filter({ visible: true }).first(),
    ).toBeVisible();
    const m2 = await kiesAnderGerecht(page, "Spaghetti bolognese", "Witloof");
    await jan.p.reload();
    const j2 = await kiesAnderGerecht(jan.p, "Spaghetti bolognese", "Pompoensoep");
    await j2.kies();
    await expect.poll(async () => (await planRij())["recipe_id"]).toBe(R(2));
    await m2.kies();
    await expect(keuze.getByRole("heading")).toHaveText(
      `Jan veranderde ${dag} net in Romige pompoensoep`,
    );
    await keuze.getByRole("button", { name: "Houd die van Jan" }).click();
    await expect(keuze).toBeHidden();
    expect((await planRij())["recipe_id"]).toBe(R(2));
    await expect(
      page.getByText("Romige pompoensoep").filter({ visible: true }).first(),
    ).toBeVisible();

    // "Wie veranderde wat" op Week (gezin): Jan en Marie staan erin.
    await page.reload();
    const log = page.getByRole("region", { name: "Wie veranderde wat" });
    await expect(log).toContainText("Jan");
    await log.getByText("Toon").click();
    await expect(log.getByTestId("activiteit-lijst")).toContainText(
      `Jan veranderde ${dag} in Romige pompoensoep`,
    );
  } finally {
    await jan.ctx.close();
  }
  expect(extern).toEqual([]);
});
