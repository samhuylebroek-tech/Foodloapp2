/**
 * P3 — Receptversies (nepdata, demo): na een aanpassing via de assistent staat het origineel bij
 * "Versies", met datum en wat er veranderde. Terugzetten vraagt een bevestiging en kan ongedaan
 * gemaakt worden. Ook "Bewaar voor N personen" bewaart eerst het origineel.
 */
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test } from "./helpers";

const WITLOOF = "aaaaaaaa-0000-4000-8000-000000000008";
const servings = async () => (await nepDb()).recipes!.find((r) => r["id"] === WITLOOF)!["servings"];
const witloof = async () =>
  (await nepDb()).recipe_ingredients!.find(
    (r) => r["recipe_id"] === WITLOOF && r["name"] === "witloof",
  )?.["quantity"];

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("assistent past aan → origineel bij Versies → terugzetten met bevestiging → ongedaan maken", async ({
  page,
  extern,
}) => {
  await page.goto(`/recepten/${WITLOOF}`);
  // Nog geen versies: geen knop.
  await expect(page.getByRole("heading", { name: /witloof/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Versies \(/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Vraag het Foodlo" }).click();
  const paneel = page.getByRole("dialog", { name: "Vraag het Foodlo" });
  await paneel.getByRole("tab", { name: "Aanpassen" }).click();
  await paneel.getByRole("button", { name: "Minder personen" }).click();
  await paneel.getByRole("button", { name: "Minder personen" }).click();
  await paneel.getByRole("button", { name: "Toon voorbeeld voor 2 personen" }).click();
  await paneel.getByRole("button", { name: "Pas dit recept aan" }).click();
  await expect(page.getByText("Recept aangepast")).toBeVisible();
  await expect.poll(servings).toBe(2);
  await expect.poll(async () => (await nepDb()).recipe_versions?.length ?? 0).toBe(1);

  // Versies: huidige versie + origineel, met wat er veranderde.
  await page.getByRole("button", { name: "Versies (2)" }).click();
  const venster = page.getByRole("dialog", { name: "Versies" });
  const lijst = venster.getByRole("list", { name: "Versies van dit recept" });
  await expect(lijst.locator('[data-versie="huidig"]')).toContainText("Aangepast met de assistent");
  await expect(lijst.locator('[data-versie="huidig"]')).toContainText("Porties: 4 → 2");
  await expect(lijst.locator('[data-versie="huidig"]')).toContainText("witloof: 8");
  await expect(lijst.locator('[data-versie="origineel"]')).toContainText("Origineel");
  await expect(lijst.locator('[data-versie="origineel"]')).toContainText("4 personen");
  expect(await axeErnstig(page)).toEqual([]);

  // Terugzetten vraagt eerst een bevestiging; annuleren verandert niets.
  await lijst
    .locator('[data-versie="origineel"]')
    .getByRole("button", { name: "Zet deze versie terug" })
    .click();
  const vraag = page.getByRole("alertdialog", { name: "Deze versie terugzetten?" });
  await expect(vraag).toBeVisible();
  await vraag.getByRole("button", { name: "Annuleren" }).click();
  expect(await servings()).toBe(2);
  await lijst
    .locator('[data-versie="origineel"]')
    .getByRole("button", { name: "Zet deze versie terug" })
    .click();
  await page
    .getByRole("alertdialog", { name: "Deze versie terugzetten?" })
    .getByRole("button", { name: "Terugzetten" })
    .click();
  await expect(page.getByText("Origineel staat terug")).toBeVisible();
  await expect.poll(servings).toBe(4);
  await expect.poll(witloof).toBe(8);
  // De versie van daarnet blijft bewaard.
  await expect.poll(async () => (await nepDb()).recipe_versions?.length ?? 0).toBe(2);

  // Ongedaan maken: terug naar de aangepaste versie, de extra versie verdwijnt.
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(servings).toBe(2);
  await expect.poll(witloof).toBe(4);
  await expect.poll(async () => (await nepDb()).recipe_versions?.length ?? 0).toBe(1);
  void extern;
});

test("'Bewaar voor N personen' schaalt en bewaart eerst het origineel", async ({
  page,
  extern,
}) => {
  await page.goto(`/recepten/${WITLOOF}`);
  const ingr = page.getByRole("region", { name: "Ingrediënten" });
  await ingr.getByRole("button", { name: "Meer personen" }).click();
  await ingr.getByRole("button", { name: "Meer personen" }).click();
  await ingr.getByRole("button", { name: "Bewaar voor 6 personen" }).click();
  await expect.poll(servings).toBe(6);
  await expect.poll(witloof).toBe(12);
  await expect.poll(async () => (await nepDb()).recipe_versions?.length ?? 0).toBe(1);
  const opname = (await nepDb()).recipe_versions![0]!["momentopname"] as {
    reden: string;
    recept: { servings: number };
  };
  expect(opname).toMatchObject({ reden: "porties", recept: { servings: 4 } });
  await page.getByRole("button", { name: "Versies (2)" }).click();
  await expect(
    page.getByRole("dialog", { name: "Versies" }).locator('[data-versie="huidig"]'),
  ).toContainText("Porties bewaard");
  void extern;
});
