/**
 * Mobiele en visuele audit (alleen met AUDIT=1). Meet op elke breedte en tekstgrootte:
 * - horizontaal scrollen van de pagina;
 * - tekst die over haar kader loopt (niet bewust afgekapt);
 * - tekst die stil wordt weggeknipt (overflow hidden zonder ellips);
 * - bewust afgekapte tekst (ellips/line-clamp) — gelogd, want ook dat moet ontworpen zijn;
 * - tekst buiten het scherm;
 * - knoppen waarvan de tekst over meer dan twee regels breekt;
 * - aanraakdoelen < 24 px (WCAG 2.2 AA) en < 44 px (streefwaarde).
 * Met een lange-inhoud-dataset bovenop de demodata. Chromium-emulatie, geen echt toestel.
 * Resultaat: docs/foodloapp-v2/audit/resultaat-<label>.json + schermafdrukken (lokaal).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { meldAan, resetDemo, seedDb, storing, test, zetKlok } from "./helpers";
import { klaar, meet, type Bevinding } from "./audit-meten";

test.skip(!process.env["AUDIT"], "alleen met AUDIT=1");

const IK = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";
const LANG = "aaaa9999-0000-4000-8000-000000000001";
const R1 = "aaaaaaaa-0000-4000-8000-000000000001";

export const SCHERMEN: [string, string][] = [
  ["vandaag", "/"],
  ["week", "/planner"],
  ["lijst", "/boodschappen"],
  ["aanvullen", "/aanvullen"],
  ["keuken", "/gerechten"],
  ["recept-lang", `/recepten/${LANG}`],
  ["recept", `/recepten/${R1}`],
  ["koken", `/recepten/${R1}?koken=true`],
  ["nieuw-recept", "/recepten/nieuw"],
  ["voorraad", "/voorraad"],
  ["ontdek", "/inspiratie"],
  ["meer", "/meer"],
  ["instellingen", "/instellingen"],
  ["gezin", "/gezin"],
  ["vrienden", "/vrienden"],
  ["kaarten", "/kaarten"],
  ["meldingen", "/meldingen"],
];

async function langeInhoud() {
  const vandaag = new Date().toLocaleDateString("sv-SE");
  await seedDb({
    recipes: [
      {
        id: LANG,
        user_id: IK,
        title:
          "Langzaam gegaarde Vlaamse stoverij met donker abdijbier, peperkoek en zelfgemaakte frietjes",
        description:
          "Een lange omschrijving om te zien of tekst netjes afbreekt op een smalle telefoon, ook met woorden als ongezoutenroomboterbereiding.",
        servings: 4,
        prep_minutes: 45,
        cook_minutes: 180,
        is_concept: false,
        tags: ["vlees", "Belgische klassieker"],
        category: "hoofdgerecht",
        difficulty: "gemiddeld",
        instructions: [
          "Snij het rundvlees in blokjes van ongeveer drie centimeter en dep ze goed droog met keukenpapier zodat ze mooi bruinen.",
          "Laat alles minstens drie uur zachtjes stoven.",
        ],
        deleted_at: null,
      },
    ],
    recipe_ingredients: [
      {
        id: crypto.randomUUID(),
        recipe_id: LANG,
        name: "biologische ongezouten roomboter van grasgevoerde koeien",
        quantity: 250,
        unit: "g",
        position: 0,
      },
      {
        id: crypto.randomUUID(),
        recipe_id: LANG,
        name: "runderschenkel zonder been (bij voorkeur van de lokale slager)",
        quantity: 1.25,
        unit: "kg",
        position: 1,
      },
    ],
    meal_plan: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        recipe_id: LANG,
        plan_date: vandaag,
        meal_type: "middageten",
        personen: 4,
        group_id: null,
      },
    ],
    shopping_items: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        list_id: LIJST,
        name: "biologische ongezouten roomboter van grasgevoerde koeien",
        quantity: 250,
        unit: "g",
        checked: false,
        recipe_id: LANG,
        note: "Liefst die van de boerenmarkt op zaterdag, anders gewoon de huismerkversie uit de koeling",
      },
      {
        id: crypto.randomUUID(),
        user_id: IK,
        list_id: LIJST,
        name: "Afwasmiddelnavulverpakkingextragroot",
        quantity: 2,
        unit: "stuk",
        checked: false,
        recipe_id: null,
      },
    ],
    pantry_items: [
      {
        id: crypto.randomUUID(),
        user_id: IK,
        naam: "Extra vierge olijfolie uit Griekenland (koudgeperst, eerste persing)",
        hoeveelheid: 750,
        eenheid: "ml",
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-01T10:00:00Z",
      },
    ],
  });
}

const BREEDTES = [320, 360, 375, 390, 412, 430, 768, 1024, 1280];
const FOTO = new Set([320, 390, 768, 1280]);

const VARIANTEN: { naam: string; breedte: number; schaal: number }[] = [
  ...BREEDTES.map((b) => ({ naam: `${b}`, breedte: b, schaal: 100 })),
  { naam: "390-tekst130", breedte: 390, schaal: 130 },
  { naam: "320-tekst130", breedte: 320, schaal: 130 },
];

for (const v of VARIANTEN) {
  test(`mobiele audit ${v.naam}`, async ({ page }) => {
    test.setTimeout(900_000);
    const map = `docs/foodloapp-v2/audit/${process.env["AUDIT_LABEL"] ?? "nu"}`;
    mkdirSync(map, { recursive: true });
    await resetDemo();
    await langeInhoud();
    await zetKlok(page, 14);
    await meldAan(page);
    await page.setViewportSize({ width: v.breedte, height: v.breedte < 768 ? 844 : 900 });
    const resultaat: Record<string, Bevinding[]> = {};
    for (const [naam, pad] of SCHERMEN) {
      await page.goto(pad);
      await klaar(page);
      if (v.schaal !== 100)
        await page.evaluate((s) => {
          document.documentElement.style.fontSize = `${s}%`;
        }, v.schaal);
      await page.waitForTimeout(200);
      resultaat[naam] = await meet(page);
      if (FOTO.has(v.breedte) || v.schaal !== 100)
        await page.screenshot({ path: `${map}/${v.naam}-${naam}.png`, fullPage: v.breedte < 768 });
    }
    // Toestanden en vensters: onderbladen, winkelmodus, formulier, fouttoestand.
    const SCENARIOS: [string, string, (() => Promise<unknown>) | null][] = [
      [
        "lijst-catalogus",
        "/boodschappen",
        () => page.getByRole("button", { name: "Producten kiezen" }).first().click(),
      ],
      [
        "lijst-meer",
        "/boodschappen",
        () => page.getByRole("button", { name: "Meer opties voor deze lijst" }).click(),
      ],
      [
        "winkelmodus",
        "/boodschappen",
        () => page.getByRole("button", { name: "Ik ga winkelen" }).click(),
      ],
      [
        "recept-zelf-typen",
        "/recepten/nieuw",
        () => page.getByRole("button", { name: /Zelf typen/ }).click(),
      ],
      ["fout-recepten", "/gerechten", null],
    ];
    for (const [naam, pad, actie] of SCENARIOS) {
      if (naam === "fout-recepten")
        await storing({
          pad: "/rest/v1/recipes",
          methode: "GET",
          soort: "fout",
          status: 503,
          keer: 20,
        });
      await page.goto(pad);
      await klaar(page);
      if (v.schaal !== 100)
        await page.evaluate((s) => {
          document.documentElement.style.fontSize = `${s}%`;
        }, v.schaal);
      if (actie) await actie().catch(() => undefined);
      await page.waitForTimeout(700);
      resultaat[naam] = await meet(page);
      if (FOTO.has(v.breedte) || v.schaal !== 100)
        await page.screenshot({ path: `${map}/${v.naam}-${naam}.png` });
      if (naam === "fout-recepten")
        await storing({ pad: "/rest/v1/recipes", soort: "fout", keer: 0 });
    }
    writeFileSync(`${map}/resultaat-${v.naam}.json`, JSON.stringify(resultaat, null, 1));
  });
}
