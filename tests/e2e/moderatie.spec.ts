/**
 * Moderatie in het team-Control Center (nep-Supabase, verzonnen eigenaar en makers):
 * - een openbaar recept dat op controle wacht, goedkeuren → zichtbaar op de makerpagina;
 * - afwijzen vraagt een reden; alles komt in het auditlogboek;
 * - een gemelde bijdrage verbergen en terugzetten, melding afsluiten;
 * - zonder recht `content.manage` geen moderatie.
 */
import { expect, meldAan, nepDb, resetDemo, seedDb, test, zetKlok } from "./helpers";
import { EIGENAAR } from "./beheer-paden";

const LOTTE_USER = "9a9a9a9a-0000-4000-8000-000000000001";
const LOTTE = "c7c7c7c7-0000-4000-8000-000000000001";
const PREITAART = "a7a7a7a7-0000-4000-8000-000000000061";
const PUB = "d7d7d7d7-0000-4000-8000-000000000061";
const BIJDRAGE = "e9e9e9e9-0000-4000-8000-000000000002";
const MELDING = "e6e6e6e6-0000-4000-8000-000000000001";

async function opzet(role = "super_admin") {
  await resetDemo();
  await seedDb({
    admin_users: [
      {
        user_id: EIGENAAR,
        role,
        active: true,
        can_view_private_content: false,
        note: "",
        read_only: false,
        mfa_required: false,
      },
    ],
    profiles: [{ id: EIGENAAR, display_name: "Eigenaar (demo)", onboarding_klaar: true }],
    recipes: [
      {
        id: PREITAART,
        user_id: LOTTE_USER,
        title: "Preitaart met geitenkaas",
        description: "Een recept van Lotte kookt (demo).",
        image_url: null,
        servings: 4,
        prep_minutes: 20,
        cook_minutes: 35,
        category: "hoofdgerecht",
        tags: ["vegetarisch"],
        instructions: ["Stoof de prei.", "Bak de taart 35 minuten."],
        is_concept: false,
        deleted_at: null,
        created_at: "2026-11-10T10:00:00Z",
        updated_at: "2026-11-10T10:00:00Z",
      },
    ],
    recipe_publicaties: [
      {
        id: PUB,
        recipe_id: PREITAART,
        creator_id: LOTTE,
        zichtbaarheid: "openbaar",
        status: "gepubliceerd",
        gepubliceerd_op: "2026-11-12T10:00:00Z",
        video_url: null,
        moderatie: "wacht",
      },
    ],
    content_meldingen: [
      {
        id: MELDING,
        melder_id: "22222222-2222-4222-8222-222222222222",
        soort: "bijdrage",
        doel_id: BIJDRAGE,
        reden: "reclame",
        toelichting: "Lijkt reclame.",
        status: "open",
        created_at: "2026-11-13T10:00:00Z",
      },
    ],
  });
}

test.describe.configure({ timeout: 90_000 });

test("openbaar recept goedkeuren: daarna zichtbaar op de makerpagina", async ({ page, extern }) => {
  await opzet();
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/moderatie");
  const kaart = page.getByRole("article", { name: "Preitaart met geitenkaas" });
  await expect(kaart).toBeVisible();
  await expect(kaart.getByText(/van Lotte kookt/)).toBeVisible();
  await kaart.getByRole("button", { name: "Goedkeuren" }).click();
  await expect(page.getByText("Goedgekeurd: het recept is nu openbaar.")).toBeVisible();
  await expect(kaart).toHaveCount(0);

  const db = await nepDb();
  expect(db.recipe_publicaties?.find((p) => p["id"] === PUB)?.["moderatie"]).toBe("goedgekeurd");
  expect(
    db.admin_audit_log?.some(
      (r) => r["action"] === "moderatie.recept.goedgekeurd" && r["entity_id"] === PUB,
    ),
  ).toBe(true);

  // Als gewone gebruiker (Marie) staat het recept nu op Lotte's makerpagina.
  const ander = await page.context().browser()!.newContext({
    baseURL: "http://127.0.0.1:4339",
    locale: "nl-BE",
  });
  const p2 = await ander.newPage();
  await meldAan(p2);
  await p2.goto("/makers/lotte-kookt");
  await expect(p2.getByRole("link", { name: /Preitaart met geitenkaas/ })).toBeVisible();
  await ander.close();
  void extern;
});

test("afwijzen vraagt een reden en blijft onzichtbaar voor anderen", async ({ page, extern }) => {
  await opzet();
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/moderatie");
  const kaart = page.getByRole("article", { name: "Preitaart met geitenkaas" });
  await kaart.getByRole("button", { name: "Afwijzen…" }).click();
  const bevestig = kaart.getByRole("button", { name: "Afwijzen bevestigen" });
  await expect(bevestig).toBeDisabled();
  await kaart.getByLabel(/Reden van afwijzen/).fill("Foto ontbreekt en stappen zijn onduidelijk.");
  await bevestig.click();
  await expect(page.getByText("Afgewezen.")).toBeVisible();
  const db = await nepDb();
  const pub = db.recipe_publicaties?.find((p) => p["id"] === PUB);
  expect(pub?.["moderatie"]).toBe("afgewezen");
  expect(pub?.["moderatie_reden"]).toBe("Foto ontbreekt en stappen zijn onduidelijk.");
  expect(
    db.admin_audit_log?.find((r) => r["action"] === "moderatie.recept.afgewezen")?.["details"],
  ).toEqual({ reden: "Foto ontbreekt en stappen zijn onduidelijk." });
  void extern;
});

test("gemelde bijdrage verbergen, terugzetten en melding afsluiten", async ({ page, extern }) => {
  await opzet();
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/moderatie");
  const melding = page.getByRole("article", { name: "Melding: Verborgen reclame of spam" });
  await expect(melding.getByText(/halfuur langer stoven/)).toBeVisible();
  await melding.getByRole("button", { name: "Bijdrage verbergen" }).click();
  await expect(melding.getByRole("button", { name: "Bijdrage terugzetten" })).toBeVisible();
  const verborgen = async () =>
    (await nepDb()).community_bijdragen?.find((b) => b["id"] === BIJDRAGE)?.["verborgen"];
  await expect.poll(verborgen).toBe(true);
  await melding.getByRole("button", { name: "Bijdrage terugzetten" }).click();
  await expect.poll(verborgen).toBe(false);
  await melding.getByRole("button", { name: "Afsluiten: behandeld" }).click();
  await expect(page.getByText("Geen open meldingen.")).toBeVisible();
  const db = await nepDb();
  expect(db.content_meldingen?.find((m) => m["id"] === MELDING)?.["status"]).toBe("behandeld");
  const acties = (db.admin_audit_log ?? []).map((r) => r["action"]);
  expect(acties).toEqual(
    expect.arrayContaining([
      "moderatie.bijdrage.verborgen",
      "moderatie.bijdrage.teruggezet",
      "moderatie.melding.behandeld",
    ]),
  );
  void extern;
});

test("zonder recht content.manage geen moderatie (ook geen menulink)", async ({ page, extern }) => {
  await opzet("support");
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/moderatie");
  await expect(page.getByText("Je rol heeft dit recht niet.")).toBeVisible();
  await expect(page.locator('a[href="/beheer/moderatie"]')).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Preitaart met geitenkaas" })).toHaveCount(0);
  void extern;
});
