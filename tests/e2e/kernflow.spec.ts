/**
 * Kernflow: aanmelden → recept → weekmenu → boodschappenlijst.
 * Draait tegen de NEP-Supabase (tests/e2e/fake-supabase.mjs) met een testgebruiker;
 * er wordt nooit een echte database of echt account gebruikt.
 */
import type { Page } from "@playwright/test";
import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  meldAan,
  nepDb,
  nepLog,
  resetDemo,
  resetNep,
  seedDb,
  storing,
  test,
} from "./helpers";

const GEBRUIKER = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";

type Rij = Record<string, unknown>;

async function rijen(tabel: string): Promise<Rij[]> {
  return (await nepDb())[tabel] ?? [];
}

async function vulReceptIn(page: Page, titel = "Stoofvlees van oma") {
  await page.goto("/recepten/nieuw");
  await expect(page.getByLabel("Naam van het gerecht")).toBeEditable();
  await page.getByLabel("Naam van het gerecht").fill(titel);
  await page
    .getByLabel(/Ingrediënten — één per regel/)
    .fill("1 kg rundvlees\n2 uien\n1 el. bloem\n2-3 laurierblaadjes");
  await page
    .getByLabel(/Bereiding — één stap per regel/)
    .fill("Bak het vlees aan.\nVoeg de uien toe.\nLaat 2 uur zachtjes stoven.");
}

async function bewaarRecept(page: Page) {
  await page.getByRole("button", { name: "Klaar", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "Klopt alles?" });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Bewaren", exact: true }).click();
  await page.waitForURL(/\/recepten\/[0-9a-f-]{36}$/);
}

const definitief = (r: Rij[]) => r.filter((x) => x["is_concept"] === false);

test.beforeEach(async ({ page }) => {
  await resetNep();
  await meldAan(page);
});

test.describe("Kernflow", () => {
  test("aanmelden → recept → weekmenu → boodschappenlijst", async ({ page, extern }) => {
    // Bestaande lijst: melk en uien staan er al (nog te kopen), knoflook is al gekocht.
    await seedDb({
      shopping_lists: [
        { id: LIJST, user_id: GEBRUIKER, name: "Boodschappen", created_at: "2026-11-01T10:00:00Z" },
      ],
      shopping_items: [
        {
          id: "33333333-3333-4333-8333-333333333331",
          user_id: GEBRUIKER,
          list_id: LIJST,
          name: "melk",
          quantity: 1,
          unit: "l",
          checked: false,
        },
        {
          id: "33333333-3333-4333-8333-333333333332",
          user_id: GEBRUIKER,
          list_id: LIJST,
          name: "uien",
          quantity: 1,
          unit: "",
          checked: false,
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          user_id: GEBRUIKER,
          list_id: LIJST,
          name: "bloem",
          quantity: 1,
          unit: "kg",
          checked: true,
        },
      ],
    });

    // Stap 1 — aangemeld: beschermde pagina toont de eigen naam, geen doorverwijzing.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Marie");
    await expect(page).not.toHaveURL(/aanmelden/);

    // Stap 2 — recept toevoegen.
    await vulReceptIn(page);
    await bewaarRecept(page);
    await expect(page.getByRole("heading", { name: "Stoofvlees van oma" })).toBeVisible();
    const recepten = definitief(await rijen("recipes"));
    expect(recepten).toHaveLength(1);
    const recept = recepten[0]!;
    expect(recept["title"]).toBe("Stoofvlees van oma");
    expect(recept["user_id"]).toBe(GEBRUIKER);
    expect(recept["tags"]).toContain("vlees"); // BUG-028: niet langer "vegetarisch"
    expect(recept["instructions"]).toEqual([
      "Bak het vlees aan.",
      "Voeg de uien toe.",
      "Laat 2 uur zachtjes stoven.",
    ]);
    const ingr = (await rijen("recipe_ingredients")).map((i) => [
      i["name"],
      i["quantity"],
      i["unit"],
    ]);
    expect(ingr).toEqual([
      ["rundvlees", 1, "kg"],
      ["uien", 2, ""],
      ["bloem", 1, "el"],
      ["laurierblaadjes", 2, ""],
    ]);

    // Terugvinden in de receptenlijst.
    await page.goto("/gerechten");
    await expect(page.getByText("Stoofvlees van oma").first()).toBeVisible();

    // Stap 3 — inplannen op vandaag, avondeten.
    await page.goto("/planner");
    await page.getByRole("button", { name: "Gerecht toevoegen" }).last().click();
    await page.getByRole("button", { name: /Verder naar maaltijd/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Stoofvlees van oma/ })
      .click();

    const vraag = page.getByRole("dialog", { name: "Ook op je boodschappenlijst?" });
    await expect(vraag).toBeVisible();
    // BUG-030: het venster krijgt de focus (toetsenbord/schermlezer).
    expect(await vraag.evaluate((d) => d.contains(document.activeElement))).toBe(true);

    const plan = await rijen("meal_plan");
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      recipe_id: recept["id"],
      plan_date: "2026-11-08",
      meal_type: "avondeten",
      user_id: GEBRUIKER,
    });

    // Stap 4 — ingrediënten naar de bestaande lijst. Uien staan er al: de app vraagt
    // wat je wil (nooit stil dubbel of stil samenvoegen). Bloem is al gekocht → telt niet als dubbel.
    await vraag.getByRole("button", { name: /^\s*Boodschappen$/ }).click();
    const dubbel = page.getByRole("dialog", { name: /Boodschappen voor/ });
    await expect(dubbel).toBeVisible();
    await expect(dubbel.getByRole("button", { name: /uien.*Staat al op je lijst/ })).toBeVisible();
    await expect(dubbel.getByText("bloem", { exact: false }).first()).toBeVisible();
    await dubbel.getByRole("button", { name: "Alleen nieuwe toevoegen" }).click();
    await expect(dubbel).toBeHidden();

    await expect
      .poll(async () => (await rijen("shopping_items")).length, {
        message: "nieuwe items toegevoegd",
      })
      .toBe(3 + 3); // melk, uien, bloem(gekocht) + rundvlees, bloem, laurierblaadjes
    const items = await rijen("shopping_items");
    const naam = (n: string) => items.filter((i) => i["name"] === n);
    expect(naam("melk"), "bestaand item blijft ongemoeid").toEqual([
      expect.objectContaining({ quantity: 1, unit: "l", checked: false }),
    ]);
    expect(naam("uien"), "uien niet dubbel").toHaveLength(1);
    expect(naam("uien")[0]).toMatchObject({ quantity: 1, checked: false });
    // De lijst rekent om naar een basiseenheid zodat optellen klopt: 1 kg → 1000 g.
    expect(naam("rundvlees")).toEqual([
      expect.objectContaining({ quantity: 1000, unit: "g", checked: false }),
    ]);
    expect(naam("bloem"), "gekochte bloem blijft, nieuwe bloem erbij").toHaveLength(2);
    expect(naam("laurierblaadjes")).toEqual([expect.objectContaining({ quantity: 2 })]);
    expect(items.every((i) => i["list_id"] === LIJST)).toBe(true);
    expect(items.every((i) => i["user_id"] === GEBRUIKER)).toBe(true);

    // Stap 5 — de lijst tonen en afvinken / terugzetten.
    await page.goto("/boodschappen");
    const vink = page.getByRole("checkbox", { name: "rundvlees als gekocht aanvinken" });
    await expect(vink).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "melk als gekocht aanvinken" })).toBeVisible();
    await vink.click();
    await expect
      .poll(
        async () =>
          (await rijen("shopping_items")).find((i) => i["name"] === "rundvlees")?.["checked"],
      )
      .toBe(true);
    await page.getByRole("checkbox", { name: /rundvlees — gekocht/ }).click();
    await expect
      .poll(
        async () =>
          (await rijen("shopping_items")).find((i) => i["name"] === "rundvlees")?.["checked"],
      )
      .toBe(false);

    // Na herladen blijft alles staan.
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "rundvlees als gekocht aanvinken" }),
    ).toBeVisible();
    expect(await heeftHorizontaleScroll(page)).toBe(false);
    void extern;
  });
});

test.describe("Recept toevoegen — fouten en randgevallen", () => {
  test("zonder naam: duidelijke melding, niets bewaard", async ({ page, extern }) => {
    await page.goto("/recepten/nieuw");
    await expect(page.getByLabel("Naam van het gerecht")).toBeEditable();
    await page.getByLabel(/Ingrediënten — één per regel/).fill("2 eieren");
    await page.getByRole("button", { name: "Klaar", exact: true }).click();
    await expect(page.getByText("Geef het gerecht een naam")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Klopt alles?" })).toBeHidden();
    expect(definitief(await rijen("recipes"))).toHaveLength(0);
    void extern;
  });

  test("zonder ingrediënten: het controlevenster zegt het, bewaren mag toch", async ({
    page,
    extern,
  }) => {
    await page.goto("/recepten/nieuw");
    await expect(page.getByLabel("Naam van het gerecht")).toBeEditable();
    await page.getByLabel("Naam van het gerecht").fill("Toast");
    await page.getByRole("button", { name: "Klaar", exact: true }).click();
    const dlg = page.getByRole("dialog", { name: "Klopt alles?" });
    await expect(dlg.getByText(/Nog geen ingrediënten/)).toBeVisible();
    await dlg.getByRole("button", { name: "Bewaren", exact: true }).click();
    await page.waitForURL(/\/recepten\/[0-9a-f-]{36}$/);
    expect(definitief(await rijen("recipes"))).toHaveLength(1);
    void extern;
  });

  test("onduidelijke hoeveelheid wordt niet verzonnen", async ({ page, extern }) => {
    await vulReceptIn(page, "Pannenkoeken");
    await page.getByLabel(/Ingrediënten — één per regel/).fill("wat bloem\nabc g suiker\n0 eieren");
    await bewaarRecept(page);
    const ingr = await rijen("recipe_ingredients");
    const bloem = ingr.find((i) => String(i["name"]).includes("bloem"));
    expect(bloem?.["quantity"] ?? null).toBeNull();
    expect(ingr.some((i) => String(i["name"]).includes("suiker"))).toBe(true);
    void extern;
  });

  test("netwerkfout bij bewaren: melding, werk blijft staan, opnieuw lukt", async ({
    page,
    extern,
  }) => {
    await vulReceptIn(page);
    // Wacht tot het automatische concept bestaat, en laat dan de definitieve opslag falen.
    await expect.poll(async () => (await rijen("recipes")).length).toBe(1);
    await storing({
      pad: "/rest/v1/recipes",
      methode: "PATCH",
      soort: "fout",
      status: 503,
      keer: 5,
    });
    await page.getByRole("button", { name: "Klaar", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Klopt alles?" })
      .getByRole("button", { name: "Bewaren", exact: true })
      .click();
    await expect(page.getByText("Opslaan is niet gelukt")).toBeVisible();
    await expect(page).toHaveURL(/\/recepten\/nieuw/);
    await expect(page.getByLabel("Naam van het gerecht")).toHaveValue("Stoofvlees van oma");
    expect(definitief(await rijen("recipes"))).toHaveLength(0);

    await storing({ pad: "/rest/v1/recipes", soort: "fout", keer: 0 }); // storing opheffen
    await bewaarRecept(page);
    expect(definitief(await rijen("recipes"))).toHaveLength(1);
    void extern;
  });

  test("dubbel tikken op Bewaren maakt geen dubbel recept", async ({ page, extern }) => {
    await vulReceptIn(page);
    await storing({ pad: "/rest/v1/recipes", soort: "traag", ms: 1200, keer: 3 });
    await page.getByRole("button", { name: "Klaar", exact: true }).click();
    const knop = page
      .getByRole("dialog", { name: "Klopt alles?" })
      .getByRole("button", { name: "Bewaren", exact: true });
    await knop.click();
    await knop.click({ force: true, trial: false }).catch(() => undefined);
    await page.waitForURL(/\/recepten\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const titels = (await rijen("recipes")).map((r) => r["title"]);
    expect(titels.filter((t) => t === "Stoofvlees van oma")).toHaveLength(1);
    void extern;
  });

  test("annuleren en herstellen: 'Nog iets aanpassen' bewaart niets en houdt de invoer", async ({
    page,
    extern,
  }) => {
    await vulReceptIn(page);
    await page.getByRole("button", { name: "Klaar", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Klopt alles?" })
      .getByRole("button", { name: "Nog iets aanpassen" })
      .click();
    await expect(page.getByRole("dialog", { name: "Klopt alles?" })).toBeHidden();
    await expect(page.getByLabel(/Ingrediënten — één per regel/)).toHaveValue(/1 kg rundvlees/);
    expect(definitief(await rijen("recipes"))).toHaveLength(0);
    void extern;
  });

  test("het receptformulier heeft geen ernstige toegankelijkheidsproblemen", async ({
    page,
    extern,
  }) => {
    await page.goto("/recepten/nieuw");
    await expect(page.getByLabel("Naam van het gerecht")).toBeEditable();
    expect(await axeErnstig(page)).toEqual([]);
    void extern;
  });
});

test.describe("Weekmenu en boodschappen — randgevallen", () => {
  test.beforeEach(async () => {
    await seedDb({
      recipes: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          user_id: GEBRUIKER,
          title: "Spaghetti",
          servings: 4,
          is_concept: false,
          tags: ["vlees"],
          category: "hoofdgerecht",
          instructions: ["Kook de pasta."],
          deleted_at: null,
        },
      ],
      recipe_ingredients: [
        {
          id: "55555555-5555-4555-8555-555555555551",
          recipe_id: "44444444-4444-4444-8444-444444444444",
          name: "spaghetti",
          quantity: 400,
          unit: "g",
          position: 0,
        },
      ],
    });
  });

  test("dubbel tikken op een recept plant het maar één keer", async ({ page, extern }) => {
    await page.goto("/planner");
    await page.getByRole("button", { name: "Gerecht toevoegen" }).last().click();
    await page.getByRole("button", { name: /Verder naar maaltijd/ }).click();
    const kies = page.getByRole("dialog").getByRole("button", { name: /Spaghetti/ });
    await kies.dblclick();
    await page.waitForTimeout(1500);
    expect(await rijen("meal_plan")).toHaveLength(1);
    void extern;
  });

  test("'Nee, bedankt' en Escape laten de boodschappenlijst ongemoeid", async ({
    page,
    extern,
  }) => {
    await page.goto("/planner");
    await page.getByRole("button", { name: "Gerecht toevoegen" }).last().click();
    await page.getByRole("button", { name: /Verder naar maaltijd/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Spaghetti/ })
      .click();
    const vraag = page.getByRole("dialog", { name: "Ook op je boodschappenlijst?" });
    await expect(vraag).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(vraag).toBeHidden();
    expect(await rijen("shopping_items")).toHaveLength(0);
    expect(await rijen("meal_plan")).toHaveLength(1);
    void extern;
  });

  test("weekmenu: geen ernstige toegankelijkheidsproblemen", async ({ page, extern }) => {
    await page.goto("/planner");
    await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible();
    expect(await axeErnstig(page)).toEqual([]);
    void extern;
  });

  test("boodschappen: geen ernstige toegankelijkheidsproblemen", async ({ page, extern }) => {
    await page.goto("/boodschappen");
    await expect(page.getByRole("heading", { name: "Boodschappen" })).toBeVisible();
    expect(await axeErnstig(page)).toEqual([]);
    void extern;
  });
});

test.describe("Sessie", () => {
  test("afmelden brengt je terug naar aanmelden en beschermde pagina's blijven dicht", async ({
    page,
    extern,
  }) => {
    await page.goto("/instellingen");
    await page.getByRole("button", { name: "Afmelden" }).first().click();
    await expect(page).toHaveURL(/\/aanmelden$/);
    await page.goto("/planner");
    await expect(page).toHaveURL(/\/aanmelden$/);
    expect((await nepLog()).some((l) => l.path === "/auth/v1/logout")).toBe(true);
    void extern;
  });
});

test.describe("Responsief — geen horizontale overloop (met demodata)", () => {
  for (const pad of [
    "/",
    "/gerechten",
    "/recepten/aaaaaaaa-0000-4000-8000-000000000001",
    "/planner",
    "/boodschappen",
  ]) {
    test(`${pad} past in de breedte`, async ({ page, extern }) => {
      await resetDemo();
      await page.goto(pad);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await heeftHorizontaleScroll(page)).toBe(false);
      void extern;
    });
  }
});

test.describe("Recept vastleggen — duidelijke keuzes", () => {
  test("vier keuzes met uitleg; foto van recept en gerecht herkennen zijn duidelijk verschillend", async ({
    page,
    extern,
  }) => {
    await page.goto("/recepten/nieuw");
    for (const naam of [/Link plakken/, /Foto van recept/, /Zelf typen/, /Zoeken/]) {
      await expect(page.getByRole("button", { name: naam })).toBeVisible();
    }
    await page.getByRole("button", { name: /Foto van recept/ }).click();
    await expect(page.getByRole("button", { name: /Foto van recept/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Twee manieren om een recept-op-papier te lezen, en apart: een gerecht herkennen.
    await expect(page.getByText("Recept fotograferen")).toBeVisible();
    await expect(page.getByText("Kies een foto")).toBeVisible();
    await expect(page.getByText("Gerecht herkennen")).toBeVisible();
    await expect(page.getByText(/Dat is een gok/)).toBeVisible();
    expect(await axeErnstig(page)).toEqual([]);
    void extern;
  });

  test("voorbeelden staan als hulptekst onder het veld, niet als nep-invoer", async ({
    page,
    extern,
  }) => {
    await page.goto("/recepten/nieuw");
    const ingr = page.getByLabel(/Ingrediënten — één per regel/);
    await expect(ingr).toHaveValue("");
    await expect(ingr).not.toHaveAttribute("placeholder", /bloem/);
    await expect(ingr).toHaveAccessibleDescription(/bijvoorbeeld: 500 g bloem/);
    void extern;
  });
});
