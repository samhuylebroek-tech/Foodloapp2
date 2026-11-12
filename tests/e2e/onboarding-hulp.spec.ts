/**
 * Smart Onboarding en Help Center, zoals een gebruiker ze doorloopt. Nep-Supabase, verzonnen
 * gegevens. Echte functionaliteit: de oefeningen worden herkend aan echte rijen in de databank.
 */
import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  meldAan,
  nepDb,
  resetDemo,
  test,
  zetKlok,
} from "./helpers";

const MARIE = "11111111-1111-4111-8111-111111111111";
const NIEUW = "abcdef00-0000-4000-8000-0000000000aa";
const STOOFVLEES = "aaaaaaaa-0000-4000-8000-000000000001";

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await zetKlok(page, 14);
});

test("Help Center: vraag in gewone taal → antwoord met bron; onbekende vraag → eerlijk geen antwoord", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.goto("/hulp");
  await expect(page.getByRole("heading", { level: 1, name: "Hulp" })).toBeVisible();
  // Eerlijk label: de uitleg is (nog) niet door een mens nagelezen.
  await expect(page.getByRole("note")).toContainText("nog niet door een mens nagelezen");
  const veld = page.getByLabel("Zoek of stel je vraag");

  // Tikfout in de zoekterm: toch het juiste artikel.
  await veld.fill("winkelmoduss");
  await expect(
    page.getByRole("list", { name: "Zoekresultaten" }).getByRole("link").first(),
  ).toHaveText("Winkelen met de winkelmodus");

  // Vraag: het antwoord komt letterlijk uit het artikel, met de bron erbij.
  await veld.fill("ik heb geen internet in de winkel en mijn lijst is niet bewaard");
  await page.getByRole("button", { name: "Vraag" }).click();
  const antwoord = page.locator("[data-antwoord]");
  await expect(antwoord).toContainText('Uit: Ik zie "nog niet bewaard" bij mijn lijst');
  await expect(antwoord).toContainText("tot vijf keer opnieuw");

  // Geen passend artikel: niets verzinnen, verwijzen naar support.
  await veld.fill("kan ik bitcoin minen met foodlo");
  await page.getByRole("button", { name: "Vraag" }).click();
  await expect(antwoord).toContainText("Daar heb ik nog geen uitleg over.");
  await expect(antwoord.getByRole("link", { name: "Vraag het aan support" })).toHaveAttribute(
    "href",
    "/feedback",
  );

  expect(await heeftHorizontaleScroll(page)).toBe(false);
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});

test("contextuele hulp: vanaf Voorraad naar de uitleg van dat scherm, en 'Doe het nu' terug", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.goto("/voorraad");
  await page.getByRole("link", { name: "Hulp bij dit scherm" }).click();
  await expect(page).toHaveURL(/\/hulp\?module=voorraad/);
  const hier = page.getByRole("region", { name: "Hulp bij dit scherm: Voorraad" });
  await hier.getByRole("link", { name: "Je voorraad bijhouden" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Je voorraad bijhouden" }),
  ).toBeVisible();
  await expect(page.getByText("Ondertitels lezen")).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);
  await page.getByRole("link", { name: /Doe het nu/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Voorraad", exact: true })).toBeVisible();
  void extern;
});

test("tutorials: per module, met ondertitels als WebVTT", async ({ page, extern }) => {
  await meldAan(page);
  await page.goto("/hulp/tutorials");
  const kaart = page.getByRole("listitem").filter({ hasText: "Winkelen met de winkelmodus" });
  const [bestand] = await Promise.all([
    page.waitForEvent("download"),
    kaart.getByRole("button", { name: "Ondertitels (.vtt)" }).click(),
  ]);
  const { readFileSync } = await import("node:fs");
  const vtt = readFileSync(await bestand.path(), "utf8");
  expect(vtt.startsWith("WEBVTT")).toBe(true);
  expect(vtt).toContain("Ik ga winkelen");
  expect(await heeftHorizontaleScroll(page)).toBe(false);
  void extern;
});

test("kennismaking: kort en persoonlijk; allergieën blijven op het toestel, kooktijd gaat naar het weekmenu", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.goto("/kennismaking");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Even kennismaken" })).toBeVisible();
  await page.getByRole("button", { name: "Ik kook graag en veel" }).click();
  await page.getByRole("button", { name: "Tot 30 minuten" }).click();
  await page.getByRole("button", { name: "Noten" }).click();
  await expect(page.getByRole("button", { name: "Noten" })).toHaveAttribute("aria-pressed", "true");
  expect(await axeErnstig(page)).toEqual([]);
  await page.getByRole("button", { name: "Bewaren en rondleiding starten" }).click();

  // Ervaren kok: korte rondleiding (7 stappen).
  const venster = page.getByRole("dialog", { name: "Rondleiding" });
  await expect(venster.getByText("Stap 1 van 7")).toBeVisible();

  // Kooktijd op het account; allergieën niet.
  await expect
    .poll(async () => {
      const p = (await nepDb())["profiles"]!.find((r) => r["id"] === MARIE)!;
      return (p["weekmenu"] as Record<string, unknown> | undefined)?.["maxMinuten"];
    })
    .toBe(30);
  const profiel = JSON.stringify((await nepDb())["profiles"]!.find((r) => r["id"] === MARIE));
  expect(profiel).not.toMatch(/allergie|noten/i);
  const lokaal = await page.evaluate(
    (id) => window.localStorage.getItem(`foodlo:kennismaking:${id}`),
    MARIE,
  );
  expect(JSON.parse(lokaal!).allergieen).toEqual(["noten"]);
  void extern;
});

test("rondleiding: pauzeren met 'Later verder', hervatten vanaf Vandaag, ook na herladen", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.goto("/kennismaking");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Ik ben nieuw in de keuken" }).click();
  await page.getByRole("button", { name: "Bewaren en rondleiding starten" }).click();
  const venster = page.getByRole("dialog", { name: "Rondleiding" });
  await expect(venster.getByText("Stap 1 van 10")).toBeVisible();
  // Focus staat op de uitleg (schermlezer leest ze meteen voor).
  await expect(venster.getByRole("heading", { name: "Vandaag" })).toBeFocused();
  await venster.getByRole("button", { name: "Volgende" }).click();
  await venster.getByRole("button", { name: "Volgende" }).click();
  await expect(venster.getByText("Stap 3 van 10")).toBeVisible();
  await venster.getByRole("button", { name: "Later verder" }).click();
  await expect(venster).toHaveCount(0);

  await page.goto("/");
  await page.reload();
  const kaart = page.getByRole("region", { name: "Wegwijs in Foodlo" });
  await kaart.getByRole("button", { name: "Ga verder met de rondleiding (stap 3)" }).click();
  await expect(venster.getByText("Stap 3 van 10")).toBeVisible();
  // Escape = later verder (toetsenbord).
  await page.keyboard.press("Escape");
  await expect(venster).toHaveCount(0);
  void extern;
});

test("allergiewaarschuwing op een recept: alleen voor wie dat allergeen koos", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.addInitScript((id) => {
    window.localStorage.setItem(
      `foodlo:kennismaking:${id}`,
      JSON.stringify({ allergieen: ["melk"] }),
    );
  }, MARIE);
  await page.goto(`/recepten/${STOOFVLEES}`);
  const waarschuwing = page.getByRole("note", { name: "Allergieën" });
  await expect(waarschuwing).toContainText("Melk (lactose)");
  await expect(waarschuwing).toContainText("boter");
  await expect(waarschuwing).toContainText("Lees altijd het etiket");
  expect(await axeErnstig(page)).toEqual([]);

  await page.addInitScript((id) => {
    window.localStorage.setItem(`foodlo:kennismaking:${id}`, JSON.stringify({ allergieen: [] }));
  }, MARIE);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("note", { name: "Allergieën" })).toHaveCount(0);
  void extern;
});

test("eerste stappen: een nieuw account begint op 0; een echte voorraadactie telt meteen", async ({
  page,
  extern,
}) => {
  await meldAan(page, NIEUW);
  await page.goto("/eerste-stappen");
  await expect(page.getByText("0 van 6 gedaan")).toBeVisible();
  await page
    .locator('[data-oefening="voorraad"]')
    .getByRole("link", { name: "Naar je voorraad" })
    .click();
  await page.getByLabel("Nieuw product").fill("500 g rijst");
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "In huis", exact: true }).getByText("rijst"),
  ).toBeVisible();
  await page.goto("/eerste-stappen");
  await expect(page.getByText("1 van 6 gedaan")).toBeVisible();
  await expect(page.locator('[data-oefening="voorraad"]')).toHaveAttribute("data-gedaan", "true");
  expect(await heeftHorizontaleScroll(page)).toBe(false);
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});

test("eerste stappen: kookstand starten wordt herkend", async ({ page, extern }) => {
  await meldAan(page);
  await page.goto("/eerste-stappen");
  await expect(page.locator('[data-oefening="koken"]')).toHaveAttribute("data-gedaan", "false");
  await page.goto(`/recepten/${STOOFVLEES}`);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  await page.goto("/eerste-stappen");
  await expect(page.locator('[data-oefening="koken"]')).toHaveAttribute("data-gedaan", "true");
  void extern;
});

test("welkom → kennismaking; bestaande gebruikers zien geen Wegwijs-kaart", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.goto("/");
  await expect(page.locator("[data-nu]")).toBeVisible();
  await expect(page.getByRole("region", { name: "Wegwijs in Foodlo" })).toHaveCount(0);
  await page.goto("/welkom");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Klaar" }).click();
  await expect(page).toHaveURL(/\/kennismaking/);
  await page.getByRole("button", { name: "Overslaan" }).click();
  await expect(page.getByRole("region", { name: "Wegwijs in Foodlo" })).toBeVisible();
  void extern;
});

test("Control Center → Hulpinhoud: concepten zichtbaar als concept, supportvragen gegroepeerd per artikel", async ({
  page,
  extern,
}) => {
  const { seedEigenaar, EIGENAAR } = await import("./beheer-paden");
  const { seedDb } = await import("./helpers");
  await seedEigenaar();
  await seedDb({
    feedback: [
      {
        id: "fb000000-0000-4000-8000-000000000001",
        user_id: MARIE,
        kind: "vraag",
        message: "Hoe nodig ik mijn vrouw uit in het gezin?",
        status: "nieuw",
        created_at: "2026-11-10T10:00:00Z",
      },
      {
        id: "fb000000-0000-4000-8000-000000000002",
        user_id: MARIE,
        kind: "vraag",
        message: "Gezin uitnodigen lukt niet",
        status: "nieuw",
        created_at: "2026-11-10T11:00:00Z",
      },
      {
        id: "fb000000-0000-4000-8000-000000000003",
        user_id: MARIE,
        kind: "idee",
        message: "Kunnen jullie bitcoin toevoegen?",
        status: "nieuw",
        created_at: "2026-11-10T12:00:00Z",
      },
    ],
  });
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/hulp");
  await expect(page.getByRole("heading", { name: "Hulpinhoud" })).toBeVisible();
  await expect(page.getByText("Concept (niet nagelezen)")).toBeVisible();
  await expect(page.locator('[data-groep="gezin-uitnodigen"]')).toContainText(
    "Je gezin uitnodigen · 2",
  );
  await expect(page.locator('[data-groep="zonder-artikel"]')).toContainText("bitcoin");
  void extern;
});

test("afmelden wist dieet en allergieën van het toestel (gedeelde toestellen)", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.addInitScript((id) => {
    if (!window.sessionStorage.getItem("kennis-gezet")) {
      window.sessionStorage.setItem("kennis-gezet", "1");
      window.localStorage.setItem(
        `foodlo:kennismaking:${id}`,
        JSON.stringify({ allergieen: ["noten"] }),
      );
    }
  }, MARIE);
  await page.goto("/instellingen");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Afmelden" }).click();
  await expect(page).toHaveURL(/\/aanmelden/);
  await expect
    .poll(() =>
      page.evaluate((id) => window.localStorage.getItem(`foodlo:kennismaking:${id}`), MARIE),
    )
    .toBeNull();
  void extern;
});
