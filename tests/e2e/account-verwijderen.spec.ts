/**
 * Accountverwijdering via Instellingen. Controleert in het log van de nep-Supabase welke
 * beheeraanroepen de server doet. Fictieve gegevens; er wordt niets echts verwijderd.
 */
import { expect, meldAan, nepDb, nepLog, resetDemo, seedDb, test, zetKlok } from "./helpers";

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
