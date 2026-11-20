/**
 * Accountverwijdering via Instellingen. Controleert in het log van de nep-Supabase welke
 * beheeraanroepen de server doet. Fictieve gegevens; er wordt niets echts verwijderd.
 */
import {
  expect,
  meldAan,
  NEP_SUPABASE,
  nepDb,
  nepLog,
  resetDemo,
  seedDb,
  test,
  zetKlok,
} from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";

async function verwijderViaUi(page: import("@playwright/test").Page) {
  await page.goto("/instellingen");
  await page
    .getByRole("button", { name: /Account verwijderen/ })
    .first()
    .click();
  await page.getByLabel("Typ VERWIJDER").fill("VERWIJDER");
  await page.getByRole("button", { name: "Definitief verwijderen" }).click();
  await expect(page).toHaveURL(/\/aanmelden/);
}

test("BUG-104: na het verwijderen ziet de gebruiker een bevestiging", async ({ page, extern }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await verwijderViaUi(page);
  await expect(page.getByRole("status")).toContainText(
    "Je account en je gegevens zijn verwijderd.",
  );
  void extern;
});

test("verwijdert alleen het eigen account en meldt je af", async ({ page, extern }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await verwijderViaUi(page);
  const log = await nepLog();
  const wissen = log.filter(
    (l) => l.method === "DELETE" && l.path.startsWith("/auth/v1/admin/users/"),
  );
  expect(wissen.map((l) => l.path)).toEqual([`/auth/v1/admin/users/${IK}`]);
  void extern;
});

const JAN = "22222222-2222-4222-8222-222222222222";
const GEZIN = "abababab-0000-4000-8000-000000000001";
const GEZINSLIJST = "99999999-9999-4999-8999-999999999999";

/** Demo plus: gezinslijst met een item van Jan, foto's in de opslag (deels gedeeld). */
async function zaai() {
  await resetDemo();
  await seedDb({
    shopping_lists: [
      {
        id: GEZINSLIJST,
        user_id: IK,
        group_id: GEZIN,
        name: "Gezinslijst",
        created_at: "2026-11-01T10:00:00Z",
      },
    ],
    shopping_items: [
      {
        id: "99999999-0000-4000-8000-000000000001",
        user_id: JAN,
        list_id: GEZINSLIJST,
        name: "luiers",
        checked: false,
      },
    ],
    recipes: [
      {
        id: "99999999-0000-4000-8000-0000000000a1",
        user_id: JAN,
        title: "Uit inspiratie bewaard",
        image_url: `${IK}/bewaard.jpg`,
        deleted_at: null,
      },
    ],
    inspiration_recipes: [
      {
        id: "99999999-0000-4000-8000-0000000000b1",
        title: "Inspiratie",
        image_url: `${IK}/inspiratie.jpg`,
      },
    ],
    __opslag: [
      { bucket_id: "recipe-photos", name: `${IK}/eigen.jpg` },
      { bucket_id: "recipe-photos", name: `${IK}/bewaard.jpg` },
      { bucket_id: "recipe-photos", name: `${IK}/inspiratie.jpg` },
      { bucket_id: "recipe-photos", name: `${JAN}/van-jan.jpg` },
    ],
  });
}

test("BUG-025: eigen foto's gewist, gedeelde foto's en die van anderen blijven", async ({
  page,
  extern,
}) => {
  await zaai();
  await zetKlok(page, 14);
  await meldAan(page);
  await verwijderViaUi(page);
  await expect
    .poll(async () => ((await nepDb())["__opslag"] ?? []).map((o) => String(o["name"])).sort())
    .toEqual([`${JAN}/van-jan.jpg`, `${IK}/bewaard.jpg`, `${IK}/inspiratie.jpg`].sort());
  void extern;
});

test("BUG-110: gezin en gezinslijst gaan naar het actieve lid; diens items blijven", async ({
  page,
  extern,
}) => {
  await zaai();
  await zetKlok(page, 14);
  await meldAan(page);
  await verwijderViaUi(page);
  const db = await nepDb();
  expect(db["groups"]!.find((g) => g["id"] === GEZIN)!["owner_id"]).toBe(JAN);
  expect(db["shopping_lists"]!.find((l) => l["id"] === GEZINSLIJST)!["user_id"]).toBe(JAN);
  expect(db["shopping_items"]!.some((i) => i["name"] === "luiers")).toBe(true);
  void extern;
});

/** Fase 8: rijen in de nieuwe modules (voorstellen 0013–0025) en een community-foto. */
async function zaaiNieuweModules() {
  await resetDemo();
  await seedDb({
    planprofiel: [{ id: "f8000000-0000-4000-8000-000000000001", user_id: IK, ervaring: "beginner" }],
    kookmomenten: [{ id: "f8000000-0000-4000-8000-000000000002", user_id: IK, porties: 2 }],
    suggestie_instellingen: [{ id: "f8000000-0000-4000-8000-000000000003", user_id: IK }],
    app_melding_instellingen: [{ id: "f8000000-0000-4000-8000-000000000004", user_id: IK }],
    winkel_mandjes: [
      { id: "f8000000-0000-4000-8000-000000000005", user_id: IK, provider: "test", test: true },
    ],
    ai_gebruik_dag: [
      { id: "f8000000-0000-4000-8000-000000000006", user_id: IK, soort: "kookhulp.vraag" },
    ],
    toestemmingen: [{ id: "f8000000-0000-4000-8000-000000000007", user_id: IK, soort: "ai" }],
    usage_events: [{ id: "f8000000-0000-4000-8000-000000000008", user_id: IK, event: "app.open" }],
    community_bijdragen: [
      {
        id: "f8000000-0000-4000-8000-000000000009",
        user_id: IK,
        recipe_id: "99999999-0000-4000-8000-0000000000c1",
        tekst: "Gemaakt!",
        foto_url: `${IK}/f8000000-0000-4000-8000-00000000000a.jpg`,
      },
    ],
    facturen: [
      { id: "f8000000-0000-4000-8000-00000000000b", user_id: IK, nummer: "TEST-2026-0099" },
    ],
    lijst_toewijzingen: [
      {
        id: "f8000000-0000-4000-8000-00000000000c",
        toegewezen_aan: IK,
        toegewezen_door: JAN,
        winkel: "Delhaize",
      },
    ],
    __opslag: [
      { bucket_id: "community-fotos", name: `${IK}/f8000000-0000-4000-8000-00000000000a.jpg` },
      { bucket_id: "community-fotos", name: `${JAN}/van-jan.jpg` },
    ],
  });
}

test("fase 8: daarna verwijst geen enkele rij nog naar de gebruiker, en aanmelden lukt niet meer", async ({
  page,
  extern,
}) => {
  await zaaiNieuweModules();
  await zetKlok(page, 14);
  await meldAan(page);
  await page.goto("/instellingen");
  await page.evaluate(() => {
    localStorage.setItem("foodlo:kennismaking:test", JSON.stringify({ allergieen: ["noten"] }));
    localStorage.setItem("majeba-gelezen-berichten", "[]");
  });
  await page
    .getByRole("button", { name: /Account verwijderen/ })
    .first()
    .click();
  // Gevolgen vooraf: het gezin gaat naar Jan.
  await expect(page.getByTestId("gezin-gevolgen")).toContainText("wordt de nieuwe eigenaar");
  await expect(page.getByText(/geen bedenktijd/)).toBeVisible();
  await page.getByLabel("Typ VERWIJDER").fill("VERWIJDER");
  await page.getByRole("button", { name: "Definitief verwijderen" }).click();
  await expect(page).toHaveURL(/\/aanmelden/);

  const db = await nepDb();
  const achter: string[] = [];
  for (const [tabel, rijen] of Object.entries(db)) {
    if (tabel.startsWith("__")) continue;
    for (const r of rijen) if (JSON.stringify(r).includes(IK)) achter.push(tabel);
  }
  expect([...new Set(achter)], "tabellen met nog een verwijzing naar Marie").toEqual([]);
  // Factuur blijft anoniem; de toewijzing van Jan blijft zonder Marie.
  expect(db["facturen"]!.find((f) => f["nummer"] === "TEST-2026-0099")!["user_id"]).toBeNull();
  expect(
    db["lijst_toewijzingen"]!.find((t) => t["id"] === "f8000000-0000-4000-8000-00000000000c")![
      "toegewezen_aan"
    ],
  ).toBeNull();
  // BUG-179: community-foto weg, die van Jan blijft.
  const opslag = (db["__opslag"] ?? []).map((o) => `${o["bucket_id"]}/${o["name"]}`);
  expect(opslag.filter((o) => o.startsWith(`community-fotos/${IK}`))).toEqual([]);
  expect(opslag).toContain(`community-fotos/${JAN}/van-jan.jpg`);

  // Toestel: niets meer van Foodlo (behalve wat de testopstelling zelf zet).
  await expect(page.getByRole("status")).toContainText("Je account en je gegevens zijn verwijderd.");
  const sleutels = await page.evaluate(() => Object.keys(localStorage));
  expect(sleutels.filter((k) => /^foodlo|majeba/.test(k))).toEqual([]);

  // Aanmelden lukt niet meer, ook niet met een oud token.
  await page.evaluate(() => localStorage.clear());
  await page.goto("/aanmelden");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mailadres").fill("demo@foodlo.be");
  await page.getByLabel("Wachtwoord", { exact: true }).fill("demo1234");
  await expect(page.getByLabel("E-mailadres")).toHaveValue("demo@foodlo.be");
  await page.getByRole("button", { name: "Aanmelden", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "klopt niet" })).toBeVisible();
  await expect(page).toHaveURL(/\/aanmelden/);
  const { token } = (await (await fetch(`${NEP_SUPABASE}/__token`)).json()) as { token: string };
  const oud = await fetch(`${NEP_SUPABASE}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(oud.status).toBe(403);
  void extern;
});
