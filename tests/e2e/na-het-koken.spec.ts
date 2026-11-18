/**
 * P3 — Na het koken (nepdata, demo): "Klaar met koken" met restje, voorraad bijwerken (pas na
 * bevestiging, met ongedaan maken), sterren en notitie; "Gekookt" vanaf Vandaag; "Later"
 * verandert niets; een bewaard restje komt terug op Vandaag en op een Restjesdag in Week.
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import {
  axeErnstig,
  expect,
  meldAan,
  nepDb,
  resetDemo,
  seedDb,
  test,
  voorraadBijhouden,
  zetKlok,
} from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const STOOFVLEES = "aaaaaaaa-0000-4000-8000-000000000001"; // vandaag gepland, 6 stappen
const ZALM = "aaaaaaaa-0000-4000-8000-000000000003"; // 4 stappen
const RESTJES = `foodlo:restjes:${DEMO_USER_ID}`;
const vandaag = () => new Date().toLocaleDateString("sv-SE");

const voorraad = async () =>
  Object.fromEntries(
    ((await nepDb()).pantry_items ?? []).map((p) => [String(p["naam"]), p["hoeveelheid"]]),
  );
const restjesOpToestel = (page: Page) =>
  page.evaluate((s) => JSON.parse(window.localStorage.getItem(s) ?? "[]"), RESTJES) as Promise<
    { titel: string; porties: number }[]
  >;

test.describe.configure({ timeout: 150_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await zetKlok(page, 17);
});

test("koken → Klaar → restje bewaren → komt terug op Vandaag en op een Restjesdag", async ({
  page,
  extern,
}) => {
  // Niets gepland vandaag: Vandaag stelt dan restjes voor.
  await fetch(`${NEP}/meal_plan?plan_date=eq.${vandaag()}`, { method: "DELETE" });
  await page.goto(`/recepten/${ZALM}`);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Klaar met koken" }).click();
  await expect(page.getByRole("heading", { name: "Smakelijk gegeten?" })).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);

  const over = page.getByRole("group", { name: "Blijft er iets over?" });
  await over.getByLabel("Naam van het restje").fill("Zalm van woensdag");
  await expect(over.getByTestId("restje-richtwaarde")).toContainText(
    "Meestal 2 à 3 dagen in de koelkast",
  );
  await over.getByRole("button", { name: "2 porties" }).click();
  await expect.poll(async () => (await restjesOpToestel(page)).length).toBe(1);
  expect((await restjesOpToestel(page))[0]).toMatchObject({
    titel: "Zalm van woensdag",
    porties: 2,
  });
  await page.getByRole("button", { name: "4 sterren" }).click();
  await expect
    .poll(
      async () => (await nepDb()).recipe_ratings?.find((r) => r["recipe_id"] === ZALM)?.["stars"],
    )
    .toBe(4);
  await page.getByLabel("Notitie bij het recept").fill("Volgende keer meer dille.");
  await page.getByRole("button", { name: "Klaar", exact: true }).click();
  await expect.poll(async () => (await nepDb()).kookmomenten?.length ?? 0).toBe(1);
  expect((await nepDb()).kookmomenten![0]).toMatchObject({
    recipe_id: ZALM,
    notitie: "Volgende keer meer dille.",
  });
  // Terug op het recept: de notitie staat erbij, alleen voor jou.
  await expect(page.getByRole("region", { name: "Jouw kooknotities" })).toContainText(
    "Volgende keer meer dille.",
  );

  // Vandaag: het restje wordt voorgesteld.
  await page.goto("/");
  await expect(page.locator("[data-nu]")).toHaveAttribute("data-nu", "kiezen");
  await expect(page.getByRole("region", { name: "Nog restjes" })).toContainText(
    "Zalm van woensdag",
  );

  // Week: op een Restjesdag noemt het voorstel het restje (morgen is het nog goed).
  const morgen = new Date();
  morgen.setDate(morgen.getDate() + 1);
  const m = morgen.toLocaleDateString("sv-SE");
  await page.goto("/week-samenstellen");
  await expect(page.getByRole("heading", { name: "Stel je week samen", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  const dag = page.locator(`li[data-dag="${m}"]`);
  await expect(page.locator("li[data-dag]").first()).toBeVisible({ timeout: 30_000 });
  if (!(await dag.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Volgende week", exact: true }).click();
  await expect(dag).toBeVisible({ timeout: 30_000 });
  // Morgen staat al iets gepland (demo): eerst "Plannen" aanzetten.
  const plannen = dag.getByRole("checkbox", { name: "Plannen" });
  if (!(await plannen.isChecked())) await plannen.check();
  await dag.getByRole("button", { name: "Restjesdag" }).click();
  await page.getByRole("button", { name: /^Stel mijn menu samen/ }).click();
  const voorstel = page.locator(`li[data-voorstel="${m}"]`).first();
  await expect(voorstel).toHaveAttribute("data-status", "restjes", { timeout: 30_000 });
  await expect(voorstel.locator("[data-restjes-dag]")).toContainText("Zalm van woensdag");
  void extern;
});

test("voorraad bijwerken: voorstel, aanpassen, pas na bevestiging, één keer ongedaan maken", async ({
  page,
  extern,
}) => {
  await voorraadBijhouden(page);
  // Een product in een eenheid die Foodlo niet kan omrekenen: dan vraagt het.
  await seedDb({
    pantry_items: [
      {
        id: "99999999-0000-4000-8000-0000000000aa",
        user_id: DEMO_USER_ID,
        naam: "laurierblaadjes",
        hoeveelheid: 1,
        eenheid: "zakje",
      },
    ],
  });
  const voor = await voorraad();
  await page.goto(`/recepten/${STOOFVLEES}?klaar=1`);
  const sectie = page.getByRole("region", { name: "Voorraad bijwerken?" });
  await expect(sectie).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);

  const rund = sectie.locator('[data-aftrek="rundvlees"]');
  const uien = sectie.locator('[data-aftrek="uien"]');
  const laurier = sectie.locator('[data-aftrek="laurierblaadjes"]');
  await expect(rund).toContainText("gebruikt: 1 kg");
  await expect(uien).toContainText("gebruikt: 3");
  await expect(laurier).toContainText("Hoeveel gebruikte je?");
  await expect(laurier.getByRole("checkbox")).not.toBeChecked();
  // Niets veranderd zolang je niet bevestigt.
  expect(await voorraad()).toEqual(voor);

  // Maar 2 uien gebruikt.
  await uien.getByRole("spinbutton").fill("2");
  await expect(uien).toContainText("Daarna nog 2");
  await sectie.getByRole("button", { name: "Haal 2 producten uit je voorraad" }).click();
  await expect(sectie.getByRole("status")).toContainText(
    "Voorraad bijgewerkt: rundvlees op, uien minder",
  );
  await expect
    .poll(voorraad)
    .toEqual({
      ...Object.fromEntries(Object.entries(voor).filter(([k]) => k !== "rundvlees")),
      uien: 2,
    });

  // Eén keer ongedaan maken: alles terug, ook het opgebruikte product (zelfde id).
  await sectie.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(sectie.getByRole("status")).toContainText("Je voorraad staat terug");
  await expect.poll(voorraad).toEqual(voor);
  expect(
    (await nepDb()).pantry_items!.some(
      (p) => p["id"] === "99999999-0000-4000-8000-000000000004" && p["naam"] === "rundvlees",
    ),
  ).toBe(true);
  await expect(sectie.getByRole("button", { name: "Ongedaan maken" })).toHaveCount(0);
  void extern;
});

test("'Later' verandert niets", async ({ page, extern }) => {
  await voorraadBijhouden(page);
  const voor = await nepDb();
  await page.goto(`/recepten/${STOOFVLEES}?klaar=1`);
  await expect(page.getByRole("heading", { name: "Smakelijk gegeten?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Voorraad bijwerken?" })).toBeVisible();
  await page.getByRole("button", { name: "Later" }).click();
  await expect(page.getByRole("button", { name: "Start koken" }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/klaar=/);
  const na = await nepDb();
  expect(na.pantry_items).toEqual(voor.pantry_items);
  expect(na.recipe_ratings ?? []).toEqual(voor.recipe_ratings ?? []);
  expect(na.kookmomenten ?? []).toEqual([]);
  expect(await restjesOpToestel(page)).toEqual([]);
  void extern;
});

test("Vandaag: 'Gekookt' opent Klaar met koken en markeert de geplande maaltijd", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  const nu = page.locator("[data-nu]");
  await expect(nu).toHaveAttribute("data-nu", /aanvullen|winkelen|koken/);
  await page.getByRole("link", { name: "Gekookt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Smakelijk gegeten?" })).toBeVisible();
  await expect(page.getByText("Gekookt: “Stoofvlees met frietjes”")).toBeVisible();
  // Niet nu: een week niet voorstellen (met ongedaan maken in de melding).
  await page.getByRole("button", { name: "Niet nu" }).click();
  await expect(page.getByRole("button", { name: "Niet nu" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Klaar", exact: true }).click();
  await expect.poll(async () => (await nepDb()).kookmomenten?.length ?? 0).toBe(1);
  const plan = (await nepDb()).meal_plan!.find(
    (p) => p["plan_date"] === vandaag() && p["recipe_id"] === STOOFVLEES,
  );
  expect((await nepDb()).kookmomenten![0]!["meal_plan_id"]).toBe(plan!["id"]);

  await page.goto("/");
  await expect(nu).toHaveAttribute("data-nu", "gekookt");
  await expect(nu).toContainText("Gekookt. Smakelijk!");
  void extern;
});
