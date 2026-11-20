/**
 * AVG-export via de knop in Instellingen (BUG-026). Nep-Supabase zonder RLS: de server moet zelf
 * strikt op de gebruiker filteren. Fictieve gegevens; er wordt niets buiten 127.0.0.1 aangesproken.
 */
import { readFileSync } from "node:fs";
import { expect, meldAan, resetDemo, seedDb, storing, test, zetKlok } from "./helpers";

const VREEMD = "66666666-6666-4666-8666-666666666666";

test("Mijn gegevens downloaden: volledig, eigen gegevens, niets van een ander", async ({
  page,
  extern,
}) => {
  await resetDemo();
  await seedDb({
    recipes: [
      {
        id: "eeee0000-0000-4000-8000-0000000000ff",
        user_id: VREEMD,
        title: "Geheim recept van een vreemde",
        servings: 2,
        is_concept: false,
        tags: [],
        instructions: [],
        deleted_at: null,
      },
    ],
    recipe_ingredients: [
      {
        id: "eeee0000-0000-4000-8000-0000000000f1",
        recipe_id: "eeee0000-0000-4000-8000-0000000000ff",
        name: "geheime saus",
        position: 0,
      },
    ],
    pantry_items: [
      { id: "eeee0000-0000-4000-8000-0000000000f2", user_id: VREEMD, naam: "vreemde voorraad" },
    ],
    feedback: [
      { id: "eeee0000-0000-4000-8000-0000000000f3", user_id: VREEMD, message: "vreemd ticket" },
    ],
  });
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/instellingen");
  const [bestand] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Mijn gegevens downloaden/ }).click(),
  ]);
  const inhoud = readFileSync(await bestand.path(), "utf8");
  const json = JSON.parse(inhoud) as Record<string, unknown>;

  // Volledig: de nieuwe secties zitten erin.
  for (const sectie of [
    "recepten",
    "ingredienten",
    "receptfotos",
    "voorraadkast",
    "gezinslidmaatschappen",
    "deelrechten",
    "feedback",
    "sessies",
    "credits",
  ])
    expect(json, sectie).toHaveProperty(sectie);
  // Eigen gegevens (demodata van Marie) staan erin.
  expect((json["recepten"] as unknown[]).length).toBeGreaterThan(0);
  expect((json["ingredienten"] as unknown[]).length).toBeGreaterThan(0);
  // Niets van een ander.
  expect(inhoud).not.toContain("Geheim recept van een vreemde");
  expect(inhoud).not.toContain("geheime saus");
  expect(inhoud).not.toContain("vreemde voorraad");
  expect(inhoud).not.toContain("vreemd ticket");
  // Geheimen bewust niet in het bestand (kaartnummers; een factuurnummer is geen geheim).
  expect(JSON.stringify(json["klantenkaarten"])).not.toContain('"nummer"');
  expect(inhoud).not.toContain('"p256dh"');
  // Nieuwe modules (voorstellen 0008–0012, in de demo aanwezig): eigen rijen erin.
  for (const sectie of [
    "mijn_voeding",
    "huishouden_leden",
    "huishouden_voeding",
    "makerprofiel",
    "volgt",
    "verzamelingen",
    "community_bijdragen",
    "partner_aanvragen",
    "abonnementen",
    "facturen",
  ])
    expect(Array.isArray(json[sectie]), sectie).toBe(true);
  // Gust (beheerd door Marie) staat erin; Lotte (beheerd door Jan, deelt niet) niet.
  const lidVoeding = json["huishouden_voeding"] as { lid_id: string; dieet: string | null }[];
  expect(lidVoeding.map((r) => r.lid_id)).toEqual(["aeaeaeae-0000-4000-8000-000000000004"]);
  expect(JSON.stringify(json["huishouden_leden"])).toContain("Gust");
  // Fase 8: uitleg in gewone taal en de modules uit de voorstellen 0013–0025.
  expect(Array.isArray(json["uitleg"])).toBe(true);
  expect(String((json["uitleg"] as string[])[0])).toContain("alle gegevens");
  for (const sectie of [
    "planprofiel",
    "budget_per_week",
    "kookmomenten",
    "suggestie_instellingen",
    "meldingen_in_de_app",
    "restjes",
    "ai_gebruik_per_dag",
    "testmandjes",
    "toestemmingen",
  ])
    expect(Array.isArray(json[sectie]), sectie).toBe(true);
  expect((json["restjes"] as unknown[]).length).toBeGreaterThan(0);
  expect((json["budget_per_week"] as unknown[]).length).toBeGreaterThan(0);
  expect(json["lijst_toewijzingen"]).toHaveProperty("aan_jou");
  void extern;
});

test("Mijn gegevens downloaden lukt ook als de nieuwe tabellen nog niet bestaan", async ({
  page,
  extern,
}) => {
  await resetDemo();
  for (const pad of [
    "persoonlijke_voeding",
    "huishouden_leden",
    "lid_voeding",
    "facturen",
    "creators",
  ])
    await storing({ pad: `/rest/v1/${pad}`, soort: "ontbreekt", keer: 50 });
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/instellingen");
  const [bestand] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Mijn gegevens downloaden/ }).click(),
  ]);
  const json = JSON.parse(readFileSync(await bestand.path(), "utf8")) as Record<string, unknown>;
  expect((json["recepten"] as unknown[]).length).toBeGreaterThan(0);
  expect(json["mijn_voeding"]).toEqual([]);
  expect(json["huishouden_voeding"]).toEqual([]);
  expect(json["facturen"]).toEqual([]);
  void extern;
});
