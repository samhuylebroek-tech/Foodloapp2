/**
 * Foodloapp Intelligence I-1, usecase 9: in de winkelmodus "Voor morgen nog nodig" — wat je
 * voor de gerechten van morgen nog vergeten bent (niet in huis, niet op je lijst). Eén tik zet
 * het erbij, met ongedaan maken. Nepdata (demo): morgen staat "Zalm met citroen en dille".
 */
import { axeErnstig, expect, kleineDoelen, meldAan, nepDb, resetDemo, test } from "./helpers";

const vandaag = () => new Date().toLocaleDateString("sv-SE");
const citroen = async () =>
  ((await nepDb()).shopping_items ?? [])
    .filter((i) => !i["checked"] && String(i["name"]).toLowerCase() === "citroen")
    .reduce((n, i) => n + Number(i["quantity"] ?? 0), 0);
const openNamen = async () =>
  ((await nepDb()).shopping_items ?? [])
    .filter((i) => !i["checked"])
    .map((i) => String(i["name"]).toLowerCase());

async function winkelOpen(page: import("@playwright/test").Page) {
  await page.goto("/boodschappen");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const knop = page.getByRole("button", { name: "Ik ga winkelen" });
  const winkel = page.getByRole("dialog", { name: "Winkelmodus" });
  await expect(async () => {
    await knop.click({ timeout: 2000 });
    await expect(winkel).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  return winkel;
}

test.beforeEach(async ({ page }) => {
  await resetDemo();
  // Alleen morgen telt in deze test: vandaag niets gepland.
  await fetch(`http://127.0.0.1:54439/rest/v1/meal_plan?plan_date=eq.${vandaag()}`, {
    method: "DELETE",
  });
  await meldAan(page);
});

test("winkelmodus toont wat je voor morgen vergeten bent; 'Zet erbij' en ongedaan maken", async ({
  page,
  extern,
}) => {
  const voor = await openNamen();
  expect(voor).not.toContain("verse dille");
  // Citroen staat er al, maar te weinig (1, voor 4 personen zijn er 2 nodig).
  const citroenVoor = await citroen();
  expect(citroenVoor).toBe(1);
  const winkel = await winkelOpen(page);
  const melding = winkel.getByRole("region", { name: /^Voor morgen nog nodig: / });
  await expect(melding).toBeVisible();
  const teHalen = async () => Number(await winkel.getByTestId("te-halen").innerText());
  const teHalenVoor = await teHalen();
  await expect(melding).toContainText("Zalm met citroen en dille");
  await expect(melding).toContainText("Nog niet of niet genoeg op je lijst.");
  expect(await axeErnstig(page)).toEqual([]);

  await melding.getByRole("button", { name: "Zet erbij" }).click();
  await expect(page.getByText(/op je lijst$/).first()).toBeVisible();
  await expect.poll(openNamen).toContain("verse dille");
  // Bijgeteld bij de bestaande regel, geen tweede regel citroen.
  await expect.poll(citroen).toBe(2);
  // Alles staat nu op de lijst: de melding verdwijnt.
  await expect(melding).toHaveCount(0);
  // De nieuwe producten tellen meteen mee in "te halen" (de winkelmodus toont per afdeling).
  await expect.poll(teHalen).toBeGreaterThan(teHalenVoor);

  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).click();
  await expect.poll(openNamen).not.toContain("verse dille");
  await expect.poll(async () => (await openNamen()).length).toBe(voor.length);
  await expect.poll(citroen).toBe(citroenVoor);
  void extern;
});

test("niets nodig voor morgen → geen melding", async ({ page, extern }) => {
  await fetch(`http://127.0.0.1:54439/rest/v1/meal_plan?id=neq.0`, { method: "DELETE" });
  const winkel = await winkelOpen(page);
  await expect(winkel.getByRole("region", { name: /nog nodig: / })).toHaveCount(0);
  void extern;
});

test("320 px en tekst 200 %: melding past, knop groot genoeg", async ({ page, extern }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
  const winkel = await winkelOpen(page);
  const melding = winkel.getByRole("region", { name: /^Voor morgen nog nodig: / });
  await expect(melding).toBeVisible();
  const uit = await melding.evaluate((el) => {
    const w = document.documentElement.clientWidth;
    return [...el.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > w + 1)
      .length;
  });
  expect(uit).toBe(0);
  expect((await kleineDoelen(page)).filter((d) => !d.includes("Naar de inhoud"))).toEqual([]);
  void extern;
});
