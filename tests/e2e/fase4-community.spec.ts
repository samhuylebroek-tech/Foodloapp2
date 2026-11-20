/**
 * Fase 4 — community op een openbaar makerrecept (nep-Supabase, verzonnen mensen):
 * - reageren en "Ik heb het gemaakt" met foto (nep-opslag, niets naar buiten);
 * - melden → het Foodlo-team ziet het in de moderatiewachtrij (met foto) → verbergen;
 * - blokkeren en deblokkeren (Instellingen › Gegevens en privacy).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "@playwright/test";
import { expect, meldAan, nepDb, resetDemo, seedDb, test } from "./helpers";
import { EIGENAAR } from "./beheer-paden";

const IK = "11111111-1111-4111-8111-111111111111";
const TAJINE = "a7a7a7a7-0000-4000-8000-000000000003";
const GUST_REACTIE = "e9e9e9e9-0000-4000-8000-000000000003";
const FOTO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "demo-fotos",
  "stoofvlees.jpg",
);

async function alsBeheerder(browser: Browser): Promise<Page> {
  await seedDb({
    admin_users: [
      {
        user_id: EIGENAAR,
        role: "super_admin",
        active: true,
        can_view_private_content: false,
        note: "",
        read_only: false,
        mfa_required: false,
      },
    ],
    profiles: [{ id: EIGENAAR, display_name: "Eigenaar (demo)", onboarding_klaar: true }],
  });
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "localhost"
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  await meldAan(p, EIGENAAR);
  return p;
}

const mijn = async () =>
  ((await nepDb()).community_bijdragen ?? []).filter(
    (b) => b["user_id"] === IK && b["recipe_id"] === TAJINE,
  );

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async () => {
  await resetDemo();
});

test("reageren, 'Ik heb het gemaakt' met foto, melden → beheer ziet het → verbergen", async ({
  page,
  browser,
}) => {
  await meldAan(page);
  await page.goto(`/recepten/${TAJINE}`);
  const sectie = page.getByRole("region", { name: "Zo kookten anderen het" });
  // Een reactie van Gust (zonder sterren) en twee keer "maakte het".
  const gust = sectie.getByRole("listitem").filter({ hasText: "Kan dit ook met kikkererwten" });
  await expect(gust).toContainText("Gust");
  await expect(gust).toContainText("reageerde");

  // Reageren (geen sterren nodig).
  await sectie.getByRole("button", { name: "Reageren" }).click();
  await sectie.getByLabel("Je reactie of vraag").fill("Welke couscous gebruik je?");
  await sectie.getByRole("button", { name: "Delen" }).click();
  const reactie = sectie.getByRole("listitem").filter({ hasText: "Welke couscous gebruik je?" });
  await expect(reactie).toContainText("Jij");
  await expect(reactie).toContainText("reageerde");

  // Ik heb het gemaakt, met foto.
  await sectie.getByRole("button", { name: "Ik heb het gemaakt" }).click();
  await sectie.getByRole("button", { name: "5 sterren" }).click();
  await sectie.getByLabel("Eén zin over hoe het ging").fill("Met verse munt erbij, top.");
  await sectie.getByLabel("Foto kiezen").setInputFiles(FOTO);
  await expect(sectie.getByRole("img", { name: "Je gekozen foto" })).toBeVisible();
  await sectie.getByRole("button", { name: "Delen" }).click();
  const gemaakt = sectie.getByRole("listitem").filter({ hasText: "Met verse munt erbij, top." });
  await expect(gemaakt).toContainText("maakte het");
  const img = gemaakt.getByRole("img", { name: "Foto van jou" });
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect.poll(async () => (await mijn()).length).toBe(2);
  const rijen = await mijn();
  expect(rijen.map((b) => `${b["soort"]}/${b["sterren"]}`).sort()).toEqual([
    "gemaakt/5",
    "reactie/null",
  ]);
  const metFoto = rijen.find((b) => b["soort"] === "gemaakt")!;
  expect(String(metFoto["foto_url"])).toMatch(new RegExp(`^${IK}/[0-9a-f-]{36}\\.jpg$`));
  // Alleen de voornaam staat erbij.
  expect(rijen.every((b) => b["weergavenaam"] === "Marie")).toBe(true);

  // Melden van Gusts reactie.
  await gust.getByRole("button", { name: "Melden" }).click();
  const venster = page.getByRole("dialog", { name: "Wat is er mis?" });
  await venster.getByText("Ongepast of kwetsend").click();
  await venster.getByRole("button", { name: "Melding versturen" }).click();
  await expect(page.getByText("Het Foodlo-team bekijkt je melding")).toBeVisible();
  // Iemand anders meldt de foto van Marie (zo kan het team ook foto's beoordelen).
  await seedDb({
    content_meldingen: [
      {
        id: "e6e6e6e6-0000-4000-8000-000000000041",
        melder_id: "22222222-2222-4222-8222-222222222222",
        soort: "bijdrage",
        doel_id: metFoto["id"],
        reden: "anders",
        toelichting: "Klopt deze foto wel?",
        status: "open",
        created_at: new Date().toISOString(),
      },
    ],
  });

  // Het Foodlo-team ziet beide in de wachtrij en verbergt de reactie.
  const beheer = await alsBeheerder(browser);
  await beheer.goto("/beheer/moderatie");
  const melding = beheer.getByRole("article", { name: "Melding: Ongepast of kwetsend" });
  await expect(melding).toContainText("Reactie");
  await expect(melding).toContainText("Gust: Kan dit ook met kikkererwten");
  await melding.getByRole("button", { name: "Bijdrage verbergen" }).click();
  await expect(melding.getByRole("button", { name: "Bijdrage terugzetten" })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await nepDb()).community_bijdragen?.find((b) => b["id"] === GUST_REACTIE)?.["verborgen"],
    )
    .toBe(true);
  const fotoMelding = beheer.getByRole("article", { name: "Melding: Iets anders" });
  const fotoBeheer = fotoMelding.getByRole("img", { name: "Foto bij de gemelde bijdrage" });
  await expect(fotoBeheer).toBeVisible();
  await expect
    .poll(() => fotoBeheer.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await beheer.context().close();

  // Voor Marie is de verborgen reactie weg; haar eigen bijdragen blijven.
  await page.reload();
  await expect(sectie.getByText("Kan dit ook met kikkererwten")).toHaveCount(0);
  await expect(sectie.getByText("Met verse munt erbij, top.")).toBeVisible();
});

test("blokkeren verbergt iemands bijdragen; deblokkeren in Instellingen", async ({ page }) => {
  await meldAan(page);
  await page.goto(`/recepten/${TAJINE}`);
  const sectie = page.getByRole("region", { name: "Zo kookten anderen het" });
  const jan = sectie.getByRole("listitem").filter({ hasText: "Met wat extra kaneel" });
  await jan.getByRole("button", { name: "Blokkeren Jan" }).click();
  await expect(
    page.getByText("Jan is geblokkeerd. Je ziet hun bijdragen niet meer."),
  ).toBeVisible();
  await expect(sectie.getByText("Met wat extra kaneel")).toHaveCount(0);
  await expect(sectie).toContainText("1 bijdrage van iemand die je blokkeerde, is verborgen.");
  await expect
    .poll(async () =>
      ((await nepDb()).gebruiker_blokkades ?? []).map(
        (b) => `${b["blokkeerder_id"]}>${b["geblokkeerd_id"]}`,
      ),
    )
    .toEqual([`${IK}>22222222-2222-4222-8222-222222222222`]);

  await page.goto("/instellingen");
  const beheer = page.getByTestId("geblokkeerd-beheer");
  await beheer.getByText("Geblokkeerd in de community (1)").click();
  await beheer.getByRole("button", { name: "Deblokkeren Jan" }).click();
  await expect(page.getByText("Jan is niet meer geblokkeerd")).toBeVisible();
  await expect.poll(async () => ((await nepDb()).gebruiker_blokkades ?? []).length).toBe(0);

  await page.goto(`/recepten/${TAJINE}`);
  await expect(sectie.getByText("Met wat extra kaneel")).toBeVisible();
});
