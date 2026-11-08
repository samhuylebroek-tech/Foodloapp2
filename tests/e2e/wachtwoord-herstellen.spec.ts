import { axeErnstig, expect, test } from "./helpers";

test("verlopen of ontbrekende link: duidelijke uitleg en een weg terug", async ({
  page,
  extern,
}) => {
  await page.goto("/wachtwoord-herstellen");
  await expect(page.getByRole("status")).toContainText("link controleren");
  await expect(page.getByRole("alert")).toContainText("werkt niet meer", { timeout: 10_000 });
  expect(await axeErnstig(page)).toEqual([]);
  await page.getByRole("link", { name: "Naar aanmelden" }).click();
  await expect(page).toHaveURL(/\/aanmelden$/);
  void extern;
});
