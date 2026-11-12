/**
 * Restjes (usecase 18): na het koken bewaren, op Vandaag voorstellen ("Eet vanavond restjes"),
 * in Keuken tonen met "Is op"; altijd met ongedaan maken; uit met "Slimme voorstellen".
 * Restjes staan op het toestel. Nepdata (demo).
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import { axeErnstig, expect, meldAan, nepDb, resetDemo, test, zetKlok } from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const ZALM = "/recepten/aaaaaaaa-0000-4000-8000-000000000003"; // 4 stappen
const SLEUTEL = `foodlo:restjes:${DEMO_USER_ID}`;

async function zetRestje(
  page: Page,
  titel: string,
  dagenGeleden: number,
  receptId: string | null = null,
) {
  await page.addInitScript(
    ([sleutel, waarde]) => {
      if (!window.localStorage.getItem(sleutel)) window.localStorage.setItem(sleutel, waarde);
    },
    [
      SLEUTEL,
      JSON.stringify([
        {
          id: "r-1",
          titel,
          receptId,
          porties: 2,
          gekookt: Date.now() - dagenGeleden * 86400000,
        },
      ]),
    ] as const,
  );
}

const restjesPlan = async () =>
  ((await nepDb()).meal_plan ?? []).filter((p) =>
    String(p["custom_title"] ?? "").startsWith("Restjes: "),
  );

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await fetch(`${NEP}/meal_plan?plan_date=eq.${new Date().toLocaleDateString("sv-SE")}`, {
    method: "DELETE",
  });
  await meldAan(page);
  await zetKlok(page, 17);
});

test("na het koken: 'Blijft er iets over?' bewaart een restje, ongedaan maken haalt het weg", async ({
  page,
  extern,
}) => {
  await page.goto(ZALM);
  await page.getByRole("button", { name: "Start koken" }).first().click();
  await page.getByRole("button", { name: "Begin met koken" }).click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Klaar met koken" }).click();
  await expect(page.getByRole("group", { name: "Blijft er iets over?" })).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);
  await page.getByRole("button", { name: "2 porties" }).click();
  await expect(page.getByRole("button", { name: "2 porties" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const opgeslagen = () =>
    page.evaluate((s) => JSON.parse(window.localStorage.getItem(s) ?? "[]"), SLEUTEL);
  await expect.poll(async () => (await opgeslagen()).length).toBe(1);
  expect((await opgeslagen())[0]).toMatchObject({ titel: "Zalm met citroen en dille", porties: 2 });
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(async () => (await opgeslagen()).length).toBe(0);
  void extern;
});

test("Vandaag: 'Eet vanavond restjes' plant ze zonder lijst; ongedaan maken zet alles terug", async ({
  page,
  extern,
}) => {
  await zetRestje(page, "Spaghetti bolognese", 1);
  const lijstVoor = ((await nepDb()).shopping_items ?? []).length;
  await page.goto("/");
  const kaart = page.getByRole("region", { name: "Nog restjes" });
  await expect(kaart).toContainText("Spaghetti bolognese");
  await expect(kaart).toContainText("gisteren gekookt · 2 porties");
  expect(await axeErnstig(page)).toEqual([]);
  await kaart.getByRole("button", { name: "Eet vanavond restjes" }).click();
  await expect
    .poll(async () => (await restjesPlan()).map((p) => p["custom_title"]))
    .toEqual(["Restjes: Spaghetti bolognese"]);
  expect(((await nepDb()).shopping_items ?? []).length).toBe(lijstVoor);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(async () => (await restjesPlan()).length).toBe(0);
  await page.goto("/voorraad");
  await expect(page.getByRole("region", { name: "Restjes" })).toContainText("Spaghetti bolognese");
  void extern;
});

test("Keuken: restjes met 'Is op' (en ongedaan maken); na 3 dagen niet meer voorgesteld", async ({
  page,
  extern,
}) => {
  await zetRestje(page, "Stoofvlees met frietjes", 5);
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByText("Wat eten we vandaag?")).toBeVisible();
  await expect(page.getByRole("region", { name: "Nog restjes" })).toHaveCount(0);

  await page.goto("/voorraad");
  const lijst = page.getByRole("region", { name: "Restjes" });
  await expect(lijst).toContainText("5 dagen geleden gekookt");
  await expect(lijst).toContainText("Kijk zelf of het nog goed is.");
  await lijst.getByRole("button", { name: "Is op: Stoofvlees met frietjes" }).click();
  await expect(page.getByRole("region", { name: "Restjes" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Restjes" })).toContainText("Stoofvlees");
  void extern;
});

test("Slimme voorstellen uit: geen restjesvoorstel op Vandaag, wel de lijst in Keuken", async ({
  page,
  extern,
}) => {
  await zetRestje(page, "Spaghetti bolognese", 1);
  await page.goto("/instellingen");
  await page.getByRole("switch", { name: "Slimme voorstellen" }).click();
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByText("Wat eten we vandaag?")).toBeVisible();
  await expect(page.getByRole("region", { name: "Nog restjes" })).toHaveCount(0);
  await page.goto("/voorraad");
  await expect(page.getByRole("region", { name: "Restjes" })).toContainText("Spaghetti bolognese");
  void extern;
});

test("320 px en tekst 200 %: restjes op Vandaag en in Keuken lopen niet uit", async ({
  page,
  extern,
}) => {
  await zetRestje(page, "Witloof met hesp en kaassaus van de buren", 1);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
  for (const [pad, regio] of [
    ["/", "Nog restjes"],
    ["/voorraad", "Restjes"],
  ] as const) {
    await page.goto(pad);
    const r = page.getByRole("region", { name: regio });
    await expect(r).toBeVisible({ timeout: 30_000 });
    await r.scrollIntoViewIfNeeded();
    const uit = await r.evaluate((k) => {
      const w = document.documentElement.clientWidth;
      return {
        scroll: document.documentElement.scrollWidth - w,
        te: [k, ...k.querySelectorAll("*")]
          .filter((e) => e.getBoundingClientRect().right > w + 1)
          .map((e) => `${e.tagName} "${(e.textContent ?? "").trim().slice(0, 30)}"`),
      };
    });
    expect(uit, pad).toEqual({ scroll: 0, te: [] });
  }
  void extern;
});

const SPAGHETTI = "aaaaaaaa-0000-4000-8000-000000000004";

test("Week: een restje krijgt voorrang op de eerste lege dag; plannen en ongedaan maken", async ({
  page,
  extern,
}) => {
  await fetch(`${NEP}/meal_plan?id=neq.0`, { method: "DELETE" });
  await zetRestje(page, "Spaghetti bolognese", 1, SPAGHETTI);
  await page.goto("/planner");
  const kaart = page.getByRole("region", { name: "Vul aan met voorstellen" });
  await expect(kaart).toBeVisible({ timeout: 60_000 });
  await expect(kaart.getByRole("listitem").first()).toContainText("Restjes: Spaghetti bolognese");
  await expect(kaart).toContainText("Eerst je restjes");
  // Het restje staat niet ook nog eens als recept op de kaart.
  await expect(kaart.getByRole("button", { name: /^Plan Spaghetti bolognese op / })).toHaveCount(0);
  expect(await axeErnstig(page)).toEqual([]);

  await kaart.getByRole("button", { name: /^Plan restjes van Spaghetti bolognese op / }).click();
  await expect
    .poll(async () => (await restjesPlan()).map((p) => p["custom_title"]))
    .toEqual(["Restjes: Spaghetti bolognese"]);
  await expect(kaart.getByText("Restjes: Spaghetti bolognese")).toHaveCount(0);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(async () => (await restjesPlan()).length).toBe(0);
  await expect(kaart.getByText("Restjes: Spaghetti bolognese")).toBeVisible();
  void extern;
});

test("allergie: een restje met gluten of zonder bekende ingrediënten wordt niet voorgesteld", async ({
  page,
  extern,
}) => {
  await fetch(`${NEP}/meal_plan?id=neq.0`, { method: "DELETE" });
  await page.addInitScript(
    ([id]) =>
      window.localStorage.setItem(
        `foodlo:kennismaking:${id}`,
        JSON.stringify({ allergieen: ["gluten"] }),
      ),
    [DEMO_USER_ID],
  );
  await zetRestje(page, "Spaghetti bolognese", 1, SPAGHETTI);
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByText("Wat eten we vandaag?")).toBeVisible();
  await expect(page.getByRole("region", { name: "Nog restjes" })).toHaveCount(0);
  await page.goto("/planner");
  const kaart = page.getByRole("region", { name: "Vul aan met voorstellen" });
  await expect(kaart).toBeVisible({ timeout: 60_000 });
  await expect(kaart.getByText(/^Restjes:/)).toHaveCount(0);
  // Wel nog zichtbaar in Keuken: het is je eigen lijst, geen voorstel.
  await page.goto("/voorraad");
  await expect(page.getByRole("region", { name: "Restjes" })).toContainText("Spaghetti bolognese");
  void extern;
});
