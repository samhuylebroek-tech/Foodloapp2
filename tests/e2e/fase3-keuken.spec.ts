/**
 * Fase 3 — restjes op het account (voorstel 0019, in de demo via de nep-databank), opgegeten /
 * weggegooid met ongedaan maken, verspillingsoverzicht, restjes van een gezinslid, terugval op
 * het toestel als de tabel ontbreekt, en "wat kan ik met mijn restjes?" in de assistent.
 * Nepdata (demo).
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import {
  axeErnstig,
  expect,
  meldAan,
  nepDb,
  resetDemo,
  seedDb,
  storing,
  test,
  zetKlok,
} from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const SLEUTEL = `foodlo:restjes:${DEMO_USER_ID}`;
const JAN = "22222222-2222-4222-8222-222222222222";
const GEZIN = "abababab-0000-4000-8000-000000000001";

async function zetRestje(page: Page, titel: string, dagenGeleden: number) {
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
          receptId: null,
          porties: 2,
          gekookt: Date.now() - dagenGeleden * 86400000,
        },
      ]),
    ] as const,
  );
}
const rijen = async () => (await nepDb()).restjes ?? [];
const rij = async (titel: string) => (await rijen()).find((r) => r["titel"] === titel);

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await fetch(`${NEP}/meal_plan?plan_date=eq.${new Date().toLocaleDateString("sv-SE")}`, {
    method: "DELETE",
  });
  await meldAan(page);
  await zetKlok(page, 17);
});

test("restje naar het account, zichtbaar op Vandaag en in Keuken, opgegeten + ongedaan maken", async ({
  page,
  extern,
}) => {
  await zetRestje(page, "Soep van gisteren", 1);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Nog restjes" })).toContainText(
    "Soep van gisteren",
  );
  // Het restje van dit toestel staat nu ook op het account (met het gezin).
  await expect.poll(async () => (await rij("Soep van gisteren"))?.["status"]).toBe("bewaard");
  expect((await rij("Soep van gisteren"))?.["group_id"]).toBeTruthy();

  await page.goto("/voorraad");
  const lijst = page.getByRole("region", { name: "Restjes", exact: true });
  await expect(lijst).toContainText("Soep van gisteren");
  await expect(page.getByTestId("restjes-bron")).toContainText("Op je account");
  expect(await axeErnstig(page)).toEqual([]);
  await lijst.getByRole("button", { name: "Opgegeten: Soep van gisteren" }).click();
  await expect(page.getByRole("region", { name: "Restjes", exact: true })).toHaveCount(0);
  await expect.poll(async () => (await rij("Soep van gisteren"))?.["status"]).toBe("opgegeten");
  // Overzicht: 3 (demo) + 2 opgegeten, 1 weggegooid.
  await expect(page.getByTestId("verspilling")).toContainText("5 porties opgegeten");
  await expect(page.getByTestId("verspilling")).toContainText("1 portie weggegooid");

  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Restjes", exact: true })).toContainText("Soep");
  await expect.poll(async () => (await rij("Soep van gisteren"))?.["status"]).toBe("bewaard");
  expect(extern).toEqual([]);
});

test("restje van een gezinslid verschijnt; weggegooid telt mee in het overzicht", async ({
  page,
  extern,
}) => {
  await seedDb({
    restjes: [
      {
        id: "a7a7a7a7-0019-4000-8000-0000000000aa",
        user_id: JAN,
        group_id: GEZIN,
        titel: "Stoofvlees van Jan",
        recipe_id: null,
        porties: 2,
        gekookt_op: new Date(Date.now() - 86400000).toISOString(),
        gepland_op: null,
        status: "bewaard",
        afgesloten_op: null,
      },
    ],
  });
  await page.goto("/voorraad");
  const lijst = page.getByRole("region", { name: "Restjes", exact: true });
  await expect(lijst).toContainText("Stoofvlees van Jan");
  await lijst.getByRole("button", { name: "Weggegooid: Stoofvlees van Jan" }).click();
  await expect.poll(async () => (await rij("Stoofvlees van Jan"))?.["status"]).toBe("weggegooid");
  await expect(page.getByTestId("verspilling")).toContainText("3 porties weggegooid");
  expect(extern).toEqual([]);
});

test("zonder tabel (productie vóór 0019): restjes blijven op dit toestel, zonder foutmelding", async ({
  page,
  extern,
}) => {
  await storing({ pad: "/rest/v1/restjes", soort: "ontbreekt", keer: 200 });
  await zetRestje(page, "Lasagne", 1);
  await page.goto("/voorraad");
  const lijst = page.getByRole("region", { name: "Restjes", exact: true });
  await expect(lijst).toContainText("Lasagne");
  await expect(page.getByTestId("restjes-bron")).toContainText("Op dit toestel");
  await lijst.getByRole("button", { name: "Opgegeten: Lasagne" }).click();
  await expect(page.getByRole("region", { name: "Restjes", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("verspilling")).toContainText("2 porties opgegeten");
  await expect(page.getByTestId("verspilling")).toContainText("op dit toestel");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await storing({ pad: "/rest/v1/restjes", soort: "ontbreekt", keer: 0 });
  expect(extern).toEqual([]);
});

test("assistent: 'Wat kan ik met mijn restjes?' toont je restjes, verandert niets", async ({
  page,
  extern,
}) => {
  await zetRestje(page, "Curry van eergisteren", 2);
  await page.goto("/assistent");
  await page
    .getByRole("list", { name: "Voorbeeldvragen" })
    .getByRole("button", { name: "Wat kan ik met mijn restjes?" })
    .click();
  const kaart = page.locator("[data-voorstel]").last();
  await expect(kaart.getByRole("heading", { name: "Je restjes" })).toBeVisible();
  await expect(kaart).toContainText("Curry van eergisteren");
  await expect(kaart.getByRole("button", { name: "Doe maar" })).toHaveCount(0);
  expect(await axeErnstig(page)).toEqual([]);
  expect(extern).toEqual([]);
});
