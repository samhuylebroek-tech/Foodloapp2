/** Kookstand: stap voor stap, timers, herstel na herladen, afronden. Met demodata. */
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test } from "./helpers";

const STOOFVLEES = "/recepten/aaaaaaaa-0000-4000-8000-000000000001"; // 6 stappen, "2,5 uur"
const ZALM = "/recepten/aaaaaaaa-0000-4000-8000-000000000003"; // 4 stappen, "12 tot 15 minuten"

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("stap voor stap koken met knoppen en pijltjestoetsen", async ({ page, extern }) => {
  await page.goto(STOOFVLEES);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await expect(page.getByText("Alles klaarzetten")).toBeVisible();
  await expect(page.getByText("rundvlees (stoofvlees)").first()).toBeVisible();

  await page.getByRole("button", { name: "Begin met koken" }).click();
  const voortgang = page.getByRole("progressbar", { name: "Voortgang" });
  await expect(voortgang).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByText("Stap 1 van 6")).toBeVisible();
  // De staptekst krijgt de focus (schermlezer leest hem voor).
  await expect(page.getByText("Snij het vlees in blokjes")).toBeFocused();

  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(page.getByText("Stap 2 van 6")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Stap 3 van 6")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Stap 2 van 6")).toBeVisible();
  await expect(voortgang).toHaveAttribute("aria-valuenow", "2");
  void extern;
});

test("timer uit de stap: start, loopt door bij een andere stap en meldt zich", async ({
  page,
  extern,
}) => {
  await page.clock.install();
  await page.goto(ZALM);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Volgende" }).click();
  await expect(page.getByText("Stap 4 van 4")).toBeVisible();

  await page.getByRole("button", { name: "Timer 12 min" }).click();
  const timer = page.getByRole("timer");
  await expect(timer).toContainText("12:00");

  // Naar een vorige stap: de timer blijft lopen.
  await page.getByRole("button", { name: "Vorige" }).click();
  await expect(page.getByText("Stap 3 van 4")).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();

  await page.clock.fastForward("05:00");
  await expect(page.getByRole("timer")).toContainText(/^7:0\d|^6:5\d/);
  await page.getByRole("button", { name: /Pauzeer timer/ }).click();
  await page.clock.fastForward("10:00");
  await expect(page.getByRole("timer")).toContainText(/^7:0\d|^6:5\d/); // gepauzeerd
  await page.getByRole("button", { name: /Hervat timer/ }).click();
  await page.clock.fastForward("07:05");
  await expect(page.getByRole("timer")).toContainText("Klaar!");
  await expect(page.getByText("Tijd is om: 12 tot 15 minuten").first()).toBeAttached();
  await page.getByRole("button", { name: /Sluit timer/ }).click();
  await expect(page.getByRole("timer")).toHaveCount(0);
  void extern;
});

test("na herladen verder koken bij dezelfde stap", async ({ page, extern }) => {
  await page.goto(STOOFVLEES);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  await page.getByRole("button", { name: "Volgende" }).click();
  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(page.getByText("Stap 3 van 6")).toBeVisible();

  await page.reload();
  const verder = page.getByRole("button", { name: "Verder koken bij stap 3" });
  await expect(verder).toBeVisible();
  await verder.click();
  await expect(page.getByText("Stap 3 van 6")).toBeVisible();
  void extern;
});

test("afronden met een score wist de voortgang", async ({ page, extern }) => {
  await page.goto(ZALM);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Klaar met koken" }).click();
  await expect(page.getByRole("heading", { name: "Smakelijk gegeten?" })).toBeVisible();
  await page.getByRole("button", { name: "5 sterren" }).click();
  await expect
    .poll(async () => (await nepDb()).recipe_ratings?.some((r) => r["stars"] === 5))
    .toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start koken" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Verder koken bij stap/ })).toHaveCount(0);
  void extern;
});

test("kookstand heeft geen ernstige toegankelijkheidsproblemen", async ({ page, extern }) => {
  await page.goto(STOOFVLEES);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  expect(await axeErnstig(page)).toEqual([]);
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await page
    .getByRole("button", { name: /^Timer / })
    .first()
    .click();
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});
