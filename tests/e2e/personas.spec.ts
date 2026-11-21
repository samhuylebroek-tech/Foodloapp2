/**
 * GESIMULEERDE persona-walkthroughs (geen onderzoek met echte deelnemers).
 * Elke taak telt het aantal interacties (tikken/typen) en controleert het
 * resultaat in de nep-database. Persona A: telefoon 390 px. Persona B: desktop.
 * Resultaten worden gelogd als "PERSONA|<taak>|<stappen>" voor het verslag.
 */
import type { Locator, Page } from "@playwright/test";
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test, zetKlok } from "./helpers";

function teller(page: Page) {
  let stappen = 0;
  return {
    tik: async (l: Locator) => {
      stappen++;
      await l.click();
    },
    typ: async (l: Locator, tekst: string) => {
      stappen++;
      await l.fill(tekst);
    },
    aantal: () => stappen,
    meld: (taak: string) => console.log(`PERSONA|${taak}|${stappen}`),
    page,
  };
}

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test.describe("Persona A — moeder van 70, telefoon", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 500, "alleen op telefoon");

  test("A1+A2: recept vinden en als favoriet bewaren", async ({ page, extern }) => {
    const s = teller(page);
    await page.goto("/");
    // V2: recepten zitten in "Keuken" (onderbalk).
    await s.tik(page.getByRole("link", { name: /^Keuken/ }));
    await s.typ(page.getByLabel("Zoeken"), "zalm");
    await s.tik(page.getByRole("link", { name: /Zalm met citroen en dille/ }).first());
    await expect(
      page.getByRole("heading", { level: 1, name: "Zalm met citroen en dille" }),
    ).toBeVisible();
    s.meld("A1 recept vinden");
    await s.tik(page.getByRole("button", { name: "Favoriet" }));
    await expect
      .poll(async () =>
        (await nepDb()).favorites?.some(
          (f) => f["recipe_id"] === "aaaaaaaa-0000-4000-8000-000000000003",
        ),
      )
      .toBe(true);
    s.meld("A1+A2 vinden en bewaren");
    void extern;
  });

  test("A3: recept op een dag in het weekmenu zetten", async ({ page, extern }) => {
    const s = teller(page);
    await page.goto("/recepten/aaaaaaaa-0000-4000-8000-000000000004");
    await s.tik(page.getByRole("button", { name: "Inplannen" }));
    await s.tik(page.getByRole("button", { name: "Zet in planning" }));
    await expect
      .poll(
        async () =>
          (await nepDb()).meal_plan?.filter(
            (m) => m["recipe_id"] === "aaaaaaaa-0000-4000-8000-000000000004",
          ).length,
      )
      .toBeGreaterThan(0);
    s.meld("A3 inplannen vanuit recept");
    void extern;
  });

  test("A4: boodschappenlijst bekijken en iets afvinken", async ({ page, extern }) => {
    const s = teller(page);
    await page.goto("/");
    await s.tik(page.getByRole("link", { name: /^Lijst/ }));
    await expect(page.getByRole("heading", { level: 1, name: "Boodschappen" })).toBeVisible();
    await s.tik(page.getByRole("checkbox", { name: "melk als gekocht aanvinken" }));
    await expect
      .poll(
        async () => (await nepDb()).shopping_items?.find((i) => i["name"] === "melk")?.["checked"],
      )
      .toBe(true);
    s.meld("A4 lijst openen en afvinken");
    void extern;
  });

  test("A5: voorraad vinden via Nieuw", async ({ page, extern }) => {
    const s = teller(page);
    await page.goto("/");
    await s.tik(page.getByRole("button", { name: "Nieuw" }));
    await s.tik(page.getByRole("link", { name: /Iets in de voorraad/ }));
    await expect(
      page.getByRole("list", { name: "In huis", exact: true }).getByText("pompoen"),
    ).toBeVisible();
    s.meld("A5 voorraad vinden");
    void extern;
  });

  test("A6: vanaf Vandaag beginnen met koken en een timer zetten", async ({ page, extern }) => {
    const s = teller(page);
    await zetKlok(page);
    await page.goto("/");
    await s.tik(page.getByRole("link", { name: "Start koken" }));
    await s.tik(page.getByRole("button", { name: "Begin met koken" }));
    for (let i = 0; i < 5; i++) await s.tik(page.getByRole("button", { name: "Volgende" }));
    await s.tik(page.getByRole("button", { name: /^Timer / }));
    await expect(page.getByRole("timer")).toBeVisible();
    s.meld("A6 koken + timer (6 stappen)");
    expect(await axeErnstig(page)).toEqual([]);
    void extern;
  });

  test("A7: een vergissing herstellen (per ongeluk verwijderd)", async ({ page, extern }) => {
    const s = teller(page);
    await page.goto("/voorraad");
    await s.tik(page.getByRole("button", { name: "Verwijderen: uien" }));
    await s.tik(page.getByRole("button", { name: "Ongedaan maken" }));
    await expect(
      page.getByRole("list", { name: "In huis", exact: true }).getByText("uien"),
    ).toBeVisible();
    s.meld("A7 vergissing herstellen");
    void extern;
  });
});

test.describe("Persona B — foodcreator van 20, desktop", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, "alleen op desktop");

  test("B1: recept-import starten (link, foto of tekst)", async ({ page, extern }) => {
    const s = teller(page);
    await page.goto("/");
    await s.tik(page.getByRole("button", { name: "Nieuw" }));
    await s.tik(page.getByRole("link", { name: /Recept toevoegen/ }));
    await expect(page.getByRole("button", { name: /Link plakken/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByLabel("Link naar het recept")).toBeVisible();
    s.meld("B1 bij link-import geraken");
    void extern;
  });

  test("B2: collecties gebruiken om recepten te ordenen", async ({ page, extern }) => {
    const s = teller(page);
    await page.goto("/");
    await s.tik(page.getByRole("link", { name: /^Keuken/ }).first());
    await s.tik(page.getByRole("button", { name: /^Snel klaar/ }));
    await expect(page.getByRole("button", { name: /^Snel klaar/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText("Stoofvlees met frietjes")).toHaveCount(0);
    s.meld("B2 collectie openen");
    void extern;
  });

  test("B4: recept delen", async ({ page, context, extern }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const s = teller(page);
    await page.goto("/recepten/aaaaaaaa-0000-4000-8000-000000000001");
    await s.tik(page.getByRole("button", { name: "Delen" }));
    await s.tik(page.getByRole("button", { name: "Link kopiëren" }));
    await expect(page.getByText("Link gekopieerd")).toBeVisible();
    s.meld("B4 delen");
    void extern;
  });

  test("B5: weekmenu opbouwen in het weekraster", async ({ page, extern }) => {
    const s = teller(page);
    await page.goto("/");
    await s.tik(page.getByRole("link", { name: /^Week \(Weekmenu\)/ }).first());
    const raster = page.getByRole("region", { name: "Weekoverzicht" });
    await expect(raster).toBeVisible();
    await s.tik(raster.getByRole("button", { name: /Gerecht toevoegen: ontbijt/ }).first());
    await s.tik(page.getByRole("dialog").getByRole("button", { name: /Griekse salade/ }));
    // V2 (WP4): geen vraag meer; de lijst wordt meteen bijgestuurd (één tik minder).
    await expect(page.getByText(/Griekse salade staat op/)).toBeVisible();
    await expect(raster.getByText("Griekse salade").first()).toBeVisible();
    s.meld("B5 gerecht in weekraster");
    expect(await axeErnstig(page)).toEqual([]);
    void extern;
  });
});
