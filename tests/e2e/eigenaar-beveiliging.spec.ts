/**
 * Buitensluiten voorkomen (2FA-STAPPENPLAN §4) en dezelfde AVG-stappen bij verwijderen door beheer.
 * - Het eigenaarsaccount kan niet verwijderd worden via de app (vaste eigenaar-ID: een nieuw
 *   account zou nooit meer in het Control Center raken).
 * - Verwijderen via Beheer → Gebruikers draagt het gezin over en wist alleen eigen foto's
 *   (zoals zelf verwijderen, BUG-110/025). Werkt met het toetsenbord.
 * Nep-Supabase, verzonnen gegevens.
 */
import { EIGENAAR } from "./beheer-paden";
import { expect, meldAan, nepDb, nepLog, resetDemo, seedDb, test, zetKlok } from "./helpers";

const MARIE = "11111111-1111-4111-8111-111111111111";
const JAN = "22222222-2222-4222-8222-222222222222";
const GEZIN = "abababab-0000-4000-8000-000000000001";
const GEZINSLIJST = "99999999-9999-4999-8999-999999999999";

async function zaai() {
  await resetDemo();
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
    shopping_lists: [
      {
        id: GEZINSLIJST,
        user_id: MARIE,
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
    __opslag: [
      { bucket_id: "recipe-photos", name: `${MARIE}/eigen.jpg` },
      { bucket_id: "recipe-photos", name: `${JAN}/van-jan.jpg` },
    ],
  });
}

const wissen = async () =>
  (await nepLog()).filter(
    (l) => l.method === "DELETE" && l.path.startsWith("/auth/v1/admin/users/"),
  );

test.describe.configure({ timeout: 90_000 });

test("de eigenaar kan het eigen account niet verwijderen (zou zichzelf buitensluiten)", async ({
  page,
  extern,
}) => {
  await zaai();
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/instellingen");
  await page
    .getByRole("button", { name: /Account verwijderen/ })
    .first()
    .click();
  await page.getByLabel("Typ VERWIJDER").fill("VERWIJDER");
  await page.getByRole("button", { name: "Definitief verwijderen" }).click();
  await expect(page.getByText(/eigenaarsaccount van het Control Center/)).toBeVisible();
  await expect(page).toHaveURL(/\/instellingen/);
  expect(await wissen()).toEqual([]);
  void extern;
});

test("beheer verwijdert een gebruiker met het toetsenbord: gezin overgedragen, alleen eigen foto's weg", async ({
  page,
  extern,
}) => {
  await zaai();
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/gebruikers");
  const marie = page.getByRole("button", { name: /^Marie/ }).first();
  await marie.focus();
  await page.keyboard.press("Enter");
  await expect(marie).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Typ VERWIJDER om het account te verwijderen").fill("VERWIJDER");
  await page.getByRole("button", { name: "Account verwijderen" }).click();
  await expect(page.getByText("Account verwijderd")).toBeVisible();
  expect((await wissen()).map((l) => l.path)).toEqual([`/auth/v1/admin/users/${MARIE}`]);
  const db = await nepDb();
  expect(db["groups"]!.find((g) => g["id"] === GEZIN)!["owner_id"]).toBe(JAN);
  expect(db["shopping_items"]!.some((i) => i["name"] === "luiers")).toBe(true);
  await expect
    .poll(async () => ((await nepDb())["__opslag"] ?? []).map((o) => String(o["name"])))
    .toEqual([`${JAN}/van-jan.jpg`]);
  void extern;
});

test("beheer kan het eigenaarsaccount niet verwijderen", async ({ page, extern }) => {
  await zaai();
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/gebruikers");
  await page
    .getByRole("button", { name: /^Eigenaar \(demo\)/ })
    .first()
    .click();
  await page.getByLabel("Typ VERWIJDER om het account te verwijderen").fill("VERWIJDER");
  await page.getByRole("button", { name: "Account verwijderen" }).click();
  await expect(page.getByText(/eigenaarsaccount van het Control Center/)).toBeVisible();
  expect(await wissen()).toEqual([]);
  void extern;
});
