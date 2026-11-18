/**
 * P3 — "Gebruik eerst" op Vandaag (nepdata, demo, vaste klok): restjes die bijna aan hun
 * richtwaarde zitten en verse producten die al even in huis zijn, met één voorstel uit de engine.
 * Altijd als richtwaarde, nooit "bedorven"; uit met "Slimme voorstellen".
 */
import { DEMO_USER_ID } from "./demo-data.mjs";
import {
  axeErnstig,
  expect,
  meldAan,
  nepDb,
  resetDemo,
  test,
  voorraadBijhouden,
  zetKlok,
} from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const SLEUTEL = `foodlo:restjes:${DEMO_USER_ID}`;
const klok = () => {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d.getTime();
};

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  // Rundvlees al 5 dagen in huis (vlees: drempel 2 dagen).
  const geleden = new Date(klok() - 5 * 86400000).toISOString();
  await fetch(`${NEP}/pantry_items?naam=eq.rundvlees`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ created_at: geleden, updated_at: geleden }),
  });
  await page.addInitScript(
    ([sleutel, waarde]) => {
      if (!window.localStorage.getItem(sleutel)) window.localStorage.setItem(sleutel, waarde);
    },
    [
      SLEUTEL,
      JSON.stringify([
        {
          id: "r-oud",
          titel: "Lasagne",
          receptId: null,
          porties: 2,
          gekookt: klok() - 2 * 86400000,
        },
        { id: "r-vers", titel: "Soep van vandaag", receptId: null, porties: 1, gekookt: klok() },
      ]),
    ] as const,
  );
  await meldAan(page);
  await voorraadBijhouden(page);
  await zetKlok(page, 17);
});

test("Gebruik eerst: restje van 2 dagen en rundvlees van 5 dagen, met een voorstel", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  const kaart = page.getByRole("region", { name: "Gebruik eerst" });
  await expect(kaart).toBeVisible({ timeout: 30_000 });
  await expect(kaart).toContainText("Richtwaarden, geen garantie");
  const restjes = kaart.getByRole("list", { name: "Restjes" });
  await expect(restjes).toContainText("Lasagne");
  await expect(restjes).toContainText("best vandaag of morgen op");
  // Een vers restje hoort hier niet.
  await expect(restjes).not.toContainText("Soep van vandaag");
  const voorraad = kaart.getByTestId("gebruik-eerst-voorraad");
  await expect(voorraad).toContainText("rundvlees (al 5 dagen in huis)");
  await expect(voorraad).toContainText("Stoofvlees met frietjes");
  await expect(kaart).not.toContainText(/bedorven|vervallen/i);
  expect(await axeErnstig(page)).toEqual([]);

  // "Eet vanavond op" plant het restje zonder recept; ongedaan maken zet alles terug.
  await restjes.getByRole("button", { name: "Eet vanavond op" }).click();
  const gepland = async () =>
    ((await nepDb()).meal_plan ?? []).filter((p) => p["custom_title"] === "Restjes: Lasagne");
  await expect.poll(async () => (await gepland()).length).toBe(1);
  await expect(kaart.getByText("Lasagne")).toHaveCount(0);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).first().click();
  await expect.poll(async () => (await gepland()).length).toBe(0);
  await expect(restjes).toContainText("Lasagne");

  // Naar het voorgestelde recept.
  await voorraad.getByRole("link", { name: "Bekijk recept" }).click();
  await expect(page).toHaveURL(/\/recepten\/aaaaaaaa-0000-4000-8000-000000000001/);
  void extern;
});

test("Gebruik eerst staat uit met 'Slimme voorstellen' uit", async ({ page, extern }) => {
  await page.addInitScript(
    (id) => window.localStorage.setItem(`foodlo:slim:${id}`, "uit"),
    DEMO_USER_ID,
  );
  await page.goto("/");
  await expect(page.locator("[data-nu]")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Gebruik eerst" })).toHaveCount(0);
  void extern;
});
