/**
 * Fase 8 — Privacy & toestemmingen en Aanmelden en beveiliging. Nep-Supabase, verzonnen gegevens.
 * - Intrekken toont eerst de gevolgen, werkt meteen en blijft na herladen.
 * - Gezondheid: van het account gewist, op dit toestel bewaard (bestaande regel).
 * - Analyse: bestaande gebruiksgegevens gewist en er wordt niets meer gemeten.
 * - Community: eigen bijdragen en foto's gewist.
 * - Sessies: echt aanmelden op twee toestellen, het andere afmelden (één of alle).
 */
import type { Browser, Page } from "@playwright/test";
import { expect, meldAan, nepDb, resetDemo, seedDb, test, zetKlok } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const RECEPT = "aaaaaaaa-0000-4000-8000-000000000001";

test.describe.configure({ timeout: 120_000 });

async function zaai() {
  await resetDemo();
  await seedDb({
    persoonlijke_voeding: [
      {
        user_id: IK,
        allergieen: ["noten"],
        intoleranties: [],
        dieet: null,
        vermijd: [],
        toestemming_op: "2026-11-02T10:00:00Z",
      },
    ],
    community_bijdragen: [
      {
        id: "f8100000-0000-4000-8000-000000000001",
        user_id: IK,
        recipe_id: RECEPT,
        soort: "gemaakt",
        sterren: 5,
        tekst: "Heerlijk gemaakt",
        foto_url: `${IK}/f8100000-0000-4000-8000-000000000002.jpg`,
        created_at: "2026-11-03T18:00:00Z",
      },
    ],
    usage_events: [
      { id: "f8100000-0000-4000-8000-000000000003", user_id: IK, event: "recept.open" },
    ],
    __opslag: [
      { bucket_id: "community-fotos", name: `${IK}/f8100000-0000-4000-8000-000000000002.jpg` },
    ],
  });
}

const kaart = (page: Page, id: string) => page.getByTestId(`toestemming-${id}`);

test("AI uitzetten: eerst de gevolgen, dan uit — ook na herladen en op het account", async ({
  page,
  extern,
}) => {
  await zaai();
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/instellingen");
  await page.getByRole("link", { name: /Privacy & toestemmingen/ }).click();
  await expect(page).toHaveURL(/\/instellingen\/privacy/);
  const ai = kaart(page, "ai");
  await expect(ai.getByTestId("toestemming-ai-stand")).toHaveText("Aan · minimaal");
  await expect(ai).toContainText("Nooit je allergieën");
  await ai.getByRole("button", { name: "AI uitzetten" }).click();
  await expect(ai.getByText("Wat gebeurt er met je gegevens?")).toBeVisible();
  await expect(ai).toContainText("Er gaat niets meer naar de AI-dienst");
  await ai.getByRole("button", { name: "Ja, zet AI uit" }).click();
  await expect(ai.getByTestId("toestemming-ai-stand")).toHaveText("Uit");
  await expect
    .poll(async () =>
      ((await nepDb())["toestemmingen"] ?? [])
        .filter((r) => r["user_id"] === IK && r["soort"] === "ai")
        .map((r) => r["aan"]),
    )
    .toEqual([false]);
  await page.reload();
  await expect(kaart(page, "ai").getByTestId("toestemming-ai-stand")).toHaveText("Uit");
  await kaart(page, "ai")
    .getByRole("button", { name: /AI weer aanzetten/ })
    .click();
  await expect(kaart(page, "ai").getByTestId("toestemming-ai-stand")).toHaveText("Aan · minimaal");
  void extern;
});

test("allergieën: intrekken wist ze van het account, op dit toestel blijven ze (veiligheid)", async ({
  page,
  extern,
}) => {
  await zaai();
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/instellingen/privacy");
  const g = kaart(page, "gezondheid");
  await expect(g.getByTestId("toestemming-gezondheid-stand")).toHaveText("Op je account");
  await expect(g).toContainText("02/11/2026");
  await g.getByRole("button", { name: "Toestemming intrekken" }).click();
  await expect(g).toContainText("Op dit toestel blijven ze staan");
  await g.getByRole("button", { name: "Ja, wis van mijn account" }).click();
  await expect(g.getByTestId("toestemming-gezondheid-stand")).toHaveText("Alleen op dit toestel");
  const db = await nepDb();
  expect((db["persoonlijke_voeding"] ?? []).filter((r) => r["user_id"] === IK)).toEqual([]);
  const toestel = await page.evaluate(
    (id) => localStorage.getItem(`foodlo:kennismaking:${id}`) ?? "",
    IK,
  );
  expect(toestel).toContain("noten");
  void extern;
});

test("analyse en community intrekken: bestaande gegevens gewist, niets meer gemeten of gedeeld", async ({
  page,
  extern,
}) => {
  await zaai();
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/instellingen/privacy");
  const a = kaart(page, "analyse");
  await a.getByRole("button", { name: "Intrekken en wissen" }).click();
  await expect(a).toContainText("Je bestaande gebruiksgegevens worden meteen gewist");
  await a.getByRole("button", { name: "Ja, stop en wis" }).click();
  await expect(a.getByTestId("toestemming-analyse-stand")).toHaveText("Uit");
  await expect
    .poll(
      async () => ((await nepDb())["usage_events"] ?? []).filter((r) => r["user_id"] === IK).length,
    )
    .toBe(0);
  // Een volledige herlaadbeurt meet normaal "app.open": nu niet meer.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.waitForTimeout(800);
  expect(((await nepDb())["usage_events"] ?? []).filter((r) => r["user_id"] === IK)).toEqual([]);

  await page.goto("/instellingen/privacy");
  const c = kaart(page, "community");
  await expect(c).toContainText("1 bijdrage");
  await c.getByRole("button", { name: "Intrekken en wissen" }).click();
  await expect(c).toContainText("definitief gewist");
  await c.getByRole("button", { name: "Ja, wis mijn bijdragen" }).click();
  await expect(c.getByTestId("toestemming-community-stand")).toHaveText("Uit");
  await expect
    .poll(
      async () =>
        ((await nepDb())["community_bijdragen"] ?? []).filter((r) => r["user_id"] === IK).length,
    )
    .toBe(0);
  const db = await nepDb();
  expect(
    (db["__opslag"] ?? []).filter(
      (o) => String(o["name"]).startsWith(`${IK}/`) && o["bucket_id"] === "community-fotos",
    ),
  ).toEqual([]);
  void extern;
});

/** Tweede toestel met een ECHTE aanmelding (wachtwoord), zodat er een eigen sessie is. */
async function meldAanMetWachtwoord(page: Page) {
  await page.goto("/aanmelden");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mailadres").fill("demo@foodlo.be");
  await page.getByLabel("Wachtwoord", { exact: true }).fill("demo1234");
  await expect(page.getByLabel("E-mailadres")).toHaveValue("demo@foodlo.be");
  await page.getByRole("button", { name: "Aanmelden", exact: true }).click();
  await expect(page).not.toHaveURL(/\/aanmelden/, { timeout: 20_000 });
}

async function tweedeToestel(page: Page) {
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
  return { p, ctx };
}

test("sessies: twee toestellen zien, het andere afmelden; daar moet je opnieuw aanmelden", async ({
  page,
  extern,
}) => {
  await resetDemo();
  await meldAanMetWachtwoord(page);
  const { p: ander, ctx } = await tweedeToestel(page);
  await meldAanMetWachtwoord(ander);

  await page.goto("/instellingen/beveiliging");
  const lijst = page.getByTestId("sessies");
  await expect(lijst.getByRole("listitem")).toHaveCount(2);
  await expect(lijst).toContainText("Dit toestel");
  // Eén sessie apart afmelden (de andere, niet dit toestel).
  await lijst.getByRole("button", { name: /^Afmelden op / }).click();
  await expect(lijst.getByRole("listitem")).toHaveCount(1);

  await ander.reload();
  await expect(ander).toHaveURL(/\/aanmelden/, { timeout: 20_000 });
  await expect(ander.getByRole("status")).toContainText("Je bent afgemeld op dit toestel");

  // Opnieuw aanmelden op het andere toestel, dan "alle andere toestellen".
  await meldAanMetWachtwoord(ander);
  await page.reload();
  await expect(page.getByTestId("sessies").getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: "Afmelden op alle andere toestellen" }).click();
  await expect(page.getByText("Je bent afgemeld op al je andere toestellen")).toBeVisible();
  await expect(page.getByTestId("sessies").getByRole("listitem")).toHaveCount(1);
  await ander.reload();
  await expect(ander).toHaveURL(/\/aanmelden/, { timeout: 20_000 });
  // Dit toestel blijft aangemeld.
  await page.reload();
  await expect(page).toHaveURL(/\/instellingen\/beveiliging/);
  await expect(page.getByRole("heading", { name: "Tweestapsverificatie (2FA)" })).toBeVisible();
  await ctx.close();
  void extern;
});
