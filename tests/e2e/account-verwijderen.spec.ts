/**
 * Accountverwijdering via Instellingen. Controleert in het log van de nep-Supabase welke
 * beheeraanroepen de server doet. Fictieve gegevens; er wordt niets echts verwijderd.
 */
import { expect, meldAan, nepLog, resetDemo, test, zetKlok } from "./helpers";

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

test("foto's van het account worden uit de opslag gewist", async ({ page, extern }) => {
  // BUG-025 is open (zie AVG-AUDIT §6): de server wist alleen de auth-gebruiker. test.fail()
  // houdt de gewenste verwachting vast en meldt het zodra de opruiming gebouwd is.
  test.fail(true, "BUG-025 open: foto's blijven in Storage staan");
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await verwijderViaUi(page);
  const log = await nepLog();
  const opslag = log.filter(
    (l) => l.path.startsWith("/storage/v1/object") && l.method === "DELETE",
  );
  expect(opslag.length).toBeGreaterThan(0);
  void extern;
});
