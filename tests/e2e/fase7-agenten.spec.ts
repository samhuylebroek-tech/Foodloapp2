/**
 * Fase 7 — AI-agenten, weer, budget en supermarkt (nep-Supabase, verzonnen data, geen AI):
 * - "Maak mijn lijst slimmer": verschillen → Doe maar → één keer ongedaan maken;
 * - AI-limiet bereikt → vriendelijke terugval (vaste tips), nooit een kapotte knop;
 *   dezelfde vraag uit de cache telt niet opnieuw mee;
 * - Instellingen › AI-gebruik toont de tellers (zonder inhoud);
 * - "Stuur naar winkel (testmodus)" → mandje, niet-gevonden apart, testtotaal;
 * - zonder weer → "Geen weer beschikbaar" en het seizoen; weer uitzetten werkt overal.
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import { axeErnstig, expect, meldAan, nepDb, resetDemo, seedDb, test, zetKlok } from "./helpers";

const LIJST = "22222222-2222-4222-8222-222222222222";
const WITLOOF = "aaaaaaaa-0000-4000-8000-000000000008";

function vandaag() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const lijstNamen = async () =>
  ((await nepDb()).shopping_items ?? [])
    .filter((r) => r["list_id"] === LIJST)
    .map((r) =>
      `${r["quantity"] ?? ""} ${r["unit"] ?? ""} ${r["name"]}`.replace(/\s+/g, " ").trim(),
    )
    .sort();

async function gebruikVandaag(page: Page, aantal: number) {
  await page.addInitScript(
    ([id, dag, n]) => {
      window.localStorage.setItem(
        `foodlo:assistent:gebruik:${id}`,
        JSON.stringify({ dag, aantal: Number(n) }),
      );
      window.localStorage.setItem(
        `foodlo:ai-gebruik:${id}`,
        JSON.stringify(
          Array.from({ length: Number(n) }, () => ({ dag, soort: "kookhulp.vervang" })),
        ),
      );
    },
    [DEMO_USER_ID, vandaag(), String(aantal)],
  );
}

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
  await zetKlok(page, 14);
});

test("lijst slimmer: dubbels, goedkoper en winkelvolgorde → Doe maar → één keer ongedaan", async ({
  page,
}) => {
  await seedDb({
    shopping_items: [
      ["f7f7f7f7-0000-4000-8000-000000000001", "melk", 50, "cl"],
      ["f7f7f7f7-0000-4000-8000-000000000002", "ajuin", 2, ""],
      ["f7f7f7f7-0000-4000-8000-000000000003", "parmezaan", 200, "g"],
    ].map(([id, name, quantity, unit]) => ({
      id,
      user_id: DEMO_USER_ID,
      list_id: LIJST,
      name,
      quantity,
      unit,
      checked: false,
      recipe_id: null,
      note: null,
      created_at: new Date(Date.now() - 3_600_000).toISOString(),
    })),
  });
  const voor = await lijstNamen();
  await page.goto("/boodschappen");
  await page
    .getByRole("button", { name: /Maak mijn lijst slimmer/ })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "Maak mijn lijst slimmer" });
  await expect(sheet).toBeVisible();
  // Winkel: de favoriete klantenkaart (Colruyt) is standaard gekozen.
  await expect(sheet.getByRole("button", { name: "Colruyt", pressed: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Aldi" }).click();

  const dubbels = sheet.getByRole("region", { name: "Dubbels samenvoegen" });
  await expect(dubbels).toContainText("1,5 l melk");
  await expect(dubbels).toContainText(/5 (uien|ajuin)/);
  const goedkoper = sheet.getByRole("region", { name: "Goedkoper alternatief" });
  await expect(goedkoper).toContainText("Grana Padano");
  await expect(goedkoper).toContainText("richtprijs");
  await expect(sheet.getByRole("region", { name: "Volgorde van je winkel" })).toContainText(
    "Brood & bakkerij",
  );
  await expect(sheet.getByText(/goedkoper \(richtprijzen, geen winkelprijzen\)/)).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);

  // Nog niets veranderd tot "Doe maar".
  expect(await lijstNamen()).toEqual(voor);
  await sheet.getByRole("button", { name: /^Doe maar/ }).click();
  await expect(sheet).toBeHidden();
  const melding = page.getByText(/Lijst slimmer gemaakt: 2 dubbels samengevoegd, 1 goedkoper/);
  await expect(melding).toBeVisible();
  await expect
    .poll(lijstNamen)
    .toEqual(expect.arrayContaining(["1.5 l melk", "200 g Grana Padano"]));
  const na = await lijstNamen();
  expect(na).not.toContain("50 cl melk");
  expect(na.filter((n) => /^\d+ (uien|ajuin)$/.test(n))).toEqual([expect.stringMatching(/^5 /)]);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("foodlo-winkelvolgorde") ?? "[]")[0]),
  ).toBe("brood-bakkerij");

  // Eén keer ongedaan maken: alles precies terug.
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).click();
  await expect(page.getByText("Je lijst staat weer zoals ervoor").first()).toBeVisible();
  await expect.poll(lijstNamen).toEqual(voor);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("foodlo-winkelvolgorde") ?? "[]")[0]),
  ).toBe("groenten-fruit");

  // "Nee, laat zo" verandert niets.
  await page
    .getByRole("button", { name: /Maak mijn lijst slimmer/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Nee, laat zo" }).click();
  expect(await lijstNamen()).toEqual(voor);
});

test("AI-limiet bereikt: vaste tips met uitleg, geen kapotte knop; AI-gebruik toont de tellers", async ({
  page,
}) => {
  await gebruikVandaag(page, 20);
  await page.goto(`/recepten/${WITLOOF}`);
  await page.getByRole("button", { name: "Vraag het Foodlo" }).click();
  const paneel = page.getByRole("dialog", { name: "Vraag het Foodlo" });
  await paneel.getByLabel("Ander ingrediënt").fill("room");
  await paneel.getByRole("button", { name: "Zoek vervangers" }).click();
  await expect(
    paneel.getByText(/Je slimme vragen voor vandaag zijn op\. Vaste tips blijven werken\./),
  ).toBeVisible();
  const knop = paneel.getByRole("button", { name: "Meer ideeën van de slimme hulp" });
  await expect(knop).toBeEnabled();
  await knop.click();
  await expect(paneel.getByText(/Hier zijn de vaste tips; die blijven gratis/)).toBeVisible();
  // Vaste vervangers blijven gewoon staan.
  await expect(paneel.getByRole("list", { name: "Vaste vervangers voor room" })).toBeVisible();
  await paneel.getByRole("link", { name: "Bekijk je AI-gebruik" }).click();

  await expect(page).toHaveURL(/\/instellingen\/ai-gebruik/);
  await expect(page.getByTestId("ai-vandaag")).toHaveText("20 van 20");
  await expect(page.getByTestId("ai-maand")).toHaveText("20");
  await expect(page.getByText(/Je slimme vragen voor vandaag zijn op/)).toBeVisible();
  await expect(page.getByText("Extra vervangers in de kookhulp")).toBeVisible();
  await expect(page.getByText(/Nooit je vraag, het antwoord/)).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);

  // Weekassistent: ook daar een terugval in gewone taal.
  await page.goto("/assistent");
  await page.getByRole("textbox").first().fill("verras me");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/De slimme hulp is voor vandaag op; de vaste vragen werken wel/),
  ).toBeVisible();
});

test("dezelfde slimme vraag komt uit de cache en telt niet opnieuw mee; teller op het account", async ({
  page,
}) => {
  await page.goto(`/recepten/${WITLOOF}`);
  const open = async () => {
    await page.getByRole("button", { name: "Vraag het Foodlo" }).click();
    const p = page.getByRole("dialog", { name: "Vraag het Foodlo" });
    await p.getByLabel("Ander ingrediënt").fill("room");
    await p.getByRole("button", { name: "Zoek vervangers" }).click();
    await p.getByRole("button", { name: "Meer ideeën van de slimme hulp" }).click();
    return p;
  };
  let paneel = await open();
  await expect(paneel.getByText(/Je kan vandaag nog 19 van de 20/)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  paneel = await open();
  await expect(paneel.getByText(/telt niet opnieuw mee/)).toBeVisible();
  await expect(paneel.getByText(/Je kan vandaag nog 19 van de 20/)).toBeVisible();
  await expect
    .poll(async () =>
      ((await nepDb()).ai_gebruik_dag ?? []).map((r) => [r["soort"], r["aantal"], r["uit_cache"]]),
    )
    .toEqual([["kookhulp.vervang", 1, 1]]);
  // Het anonieme totaal kent geen gebruiker.
  const totaal = (await nepDb()).ai_gebruik_totaal ?? [];
  expect(totaal.every((r) => !("user_id" in r))).toBe(true);

  await page.goto("/instellingen/ai-gebruik");
  await expect(page.getByTestId("ai-vandaag")).toHaveText("1 van 20");
  await expect(page.getByText(/1 keer hetzelfde antwoord opnieuw gebruikt/)).toBeVisible();
});

test("stuur naar winkel (testmodus): koppeling, niet-gevonden apart, mandje met testtotaal", async ({
  page,
}) => {
  await page.goto("/boodschappen");
  await page.getByRole("link", { name: /Stuur naar winkel \(testmodus\)/ }).click();
  await expect(page).toHaveURL(/\/mandje/);
  await expect(page.getByText("Testmodus: nog niet te koop.")).toBeVisible();
  const gevonden = page.getByRole("region", { name: /Gevonden in de testwinkel/ });
  await expect(gevonden).toContainText("Halfvolle melk (test)");
  await expect(gevonden).toContainText("Runderstoofvlees (test)");
  await expect(gevonden.getByText("Geen prijs van de winkel")).toBeVisible();
  const niet = page.getByRole("region", { name: /Niet gevonden/ });
  await expect(niet).toContainText("citroen");
  expect(await axeErnstig(page)).toEqual([]);

  // Stoofvlees: 1 kg nodig, pak van 500 g → 2 stuks.
  await expect(page.getByText(/Testtotaal: €\s\d+,\d\d/).first()).toBeVisible();
  await page.getByRole("button", { name: "Zet in mandje (testmodus)" }).click();
  await expect(page.getByText(/Je testmandje staat klaar \(kenmerk TEST-\d{6}\)/)).toBeVisible();
  await expect(page.getByText("2 × Runderstoofvlees (test)")).toBeVisible();
  await expect(
    page.getByText(/Niet gevonden in de testwinkel; ze staan nog op je lijst: 1 citroen/),
  ).toBeVisible();
  await expect(page.getByText(/testgegevens, geen echte prijzen/)).toBeVisible();
  await expect
    .poll(async () => ((await nepDb()).winkel_mandjes ?? []).map((m) => [m["provider"], m["test"]]))
    .toEqual([["test", true]]);
  await page.getByRole("link", { name: "Terug naar je lijst" }).last().click();
  await expect(page).toHaveURL(/\/boodschappen/);
});

test("zonder weer: 'Geen weer beschikbaar' en het seizoen; weer uitzetten geldt overal", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Alleen bij de eerste lading: daarna kiest de test zelf het testweer.
    if (window.sessionStorage.getItem("testweer-gezet")) return;
    window.sessionStorage.setItem("testweer-gezet", "1");
    window.localStorage.setItem("foodlo:testweer", "geen");
  });
  await page.goto("/week-samenstellen");
  const regel = page.getByTestId("weer-seizoen");
  await expect(regel).toContainText("Geen weer beschikbaar. Foodlo kijkt naar het seizoen");

  // Met testweer: warm → lichte gerechten, gelabeld als testgegevens.
  await page.evaluate(() => window.localStorage.setItem("foodlo:testweer", "warm"));
  await page.reload();
  await expect(regel).toContainText("lichte, frisse gerechten krijgen wat voorrang");
  await expect(regel).toContainText("testgegevens");
  await regel.getByRole("button", { name: "Weer niet meetellen" }).click();
  await expect(regel).toContainText("Weer telt niet mee (uitgezet)");

  // Dezelfde instelling in Suggesties.
  await page.goto("/instellingen/suggesties");
  await expect(page.getByRole("switch", { name: /^Weer/ }).first()).not.toBeChecked();
});
