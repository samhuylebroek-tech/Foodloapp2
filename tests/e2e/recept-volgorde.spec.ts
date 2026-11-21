/**
 * Werkstroom A: ingrediënten en stappen herschikken met knoppen (geen slepen), met toetsenbord
 * en schermlezernamen. Nep-databank.
 */
import { axeErnstig, expect, kleineDoelen, meldAan, nepDb, resetDemo, test } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("volgorde van ingrediënten en stappen aanpassen en bewaren", async ({ page, extern }) => {
  await page.goto("/recepten/nieuw");
  await page.getByRole("button", { name: /Zelf typen/ }).click();
  await page.getByLabel("Naam van het gerecht").fill("Pannenkoeken");
  const ingr = page.getByLabel(/Ingrediënten — één per regel/);
  await ingr.fill("500 g bloem\n2 eieren\n1 l melk");
  const stappenVeld = page.getByLabel(/Bereiding — één stap per regel/);
  await stappenVeld.fill("Bak de pannenkoeken.\nMeng alles tot een beslag.");

  const ingrLijst = page.getByTestId("volgorde-ingredienten");
  await ingrLijst.getByText("Volgorde van de ingrediënten aanpassen").click();
  // De bovenste kan niet hoger, de onderste niet lager.
  await expect(ingrLijst.getByRole("button", { name: "Zet 500 g bloem hoger" })).toBeDisabled();
  await expect(ingrLijst.getByRole("button", { name: "Zet 1 l melk lager" })).toBeDisabled();
  await ingrLijst.getByRole("button", { name: "Zet 2 eieren hoger" }).click();
  await expect(ingr).toHaveValue("2 eieren\n500 g bloem\n1 l melk");
  // De focus volgt het verplaatste item: met het toetsenbord meteen verder.
  await expect(ingrLijst.getByRole("button", { name: "Zet 2 eieren lager" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(ingr).toHaveValue("500 g bloem\n2 eieren\n1 l melk");
  await expect(ingrLijst.getByText(/2 eieren staat nu op plaats 2 van 3/)).toBeAttached();

  const stapLijst = page.getByTestId("volgorde-stappen");
  await stapLijst.getByText("Volgorde van de stappen aanpassen").click();
  await stapLijst.getByRole("button", { name: "Zet Meng alles tot een beslag. hoger" }).click();
  await expect(stappenVeld).toHaveValue("Meng alles tot een beslag.\nBak de pannenkoeken.");

  expect(await axeErnstig(page)).toEqual([]);
  const klein = (await kleineDoelen(page)).filter((d) => /Zet .* (hoger|lager)/.test(d));
  expect(klein).toEqual([]);

  await page.getByRole("button", { name: "Klaar", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Klopt alles?" })
    .getByRole("button", { name: "Bewaren" })
    .click();
  await expect(page).toHaveURL(/\/recepten\/[0-9a-f-]{36}$/);
  const db = await nepDb();
  const recept = (db.recipes ?? []).find((r) => r["title"] === "Pannenkoeken");
  expect(recept?.["instructions"]).toEqual(["Meng alles tot een beslag.", "Bak de pannenkoeken."]);
  const namen = (db.recipe_ingredients ?? [])
    .filter((i) => i["recipe_id"] === recept?.["id"])
    .sort((a, b) => Number(a["position"]) - Number(b["position"]))
    .map((i) => i["name"]);
  expect(namen).toEqual(["bloem", "eieren", "melk"]);
  void extern;
});
