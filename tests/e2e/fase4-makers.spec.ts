/**
 * Fase 4 — makers, video en community (nep-Supabase, verzonnen makers en fans):
 * - volgen → feed "Volgend" op Ontdek toont een nieuw recept → melding bij de bel → ontvolgen;
 * - videorecept: de maker zet een video-link en tijden bij de stappen; de fan ziet klikbare tijden.
 */
import { expect, meldAan, nepDb, resetDemo, seedDb, test } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const GUST_USER = "9a9a9a9a-0000-4000-8000-000000000003";
const GUST = "c7c7c7c7-0000-4000-8000-000000000003";
const NIEUW = "a7a7a7a7-0000-4000-8000-000000000071";

async function nieuwReceptVanGust() {
  const nu = new Date().toISOString();
  await seedDb({
    recipes: [
      {
        id: NIEUW,
        user_id: GUST_USER,
        title: "Witloofgratin zonder ham",
        description: "Een recept van Groenten met Gust (demo).",
        image_url: null,
        servings: 4,
        prep_minutes: 15,
        cook_minutes: 30,
        category: "hoofdgerecht",
        tags: ["vegetarisch"],
        instructions: ["Stoof het witloof.", "Gratineer 20 minuten."],
        is_concept: false,
        deleted_at: null,
        created_at: nu,
        updated_at: nu,
      },
    ],
    recipe_publicaties: [
      {
        id: "d7d7d7d7-0000-4000-8000-000000000071",
        recipe_id: NIEUW,
        creator_id: GUST,
        zichtbaarheid: "openbaar",
        status: "gepubliceerd",
        gepubliceerd_op: nu,
        video_url: null,
        moderatie: "goedgekeurd",
      },
    ],
  });
}

test.beforeEach(async () => {
  await resetDemo();
});

test("volgen → nieuw recept in de feed Volgend → melding bij de bel → ontvolgen", async ({
  page,
}) => {
  await meldAan(page);
  await page.goto("/inspiratie");
  const feed = page.getByTestId("volgend-feed");
  // Marie volgt Lotte (demo): haar recepten staan in de feed, nieuwste eerst.
  await expect(feed.getByRole("heading", { name: "Volgend" })).toBeVisible();
  await expect(feed.getByText("Wortelsoep met sinaasappel")).toBeVisible();
  await expect(feed.getByText("Geroosterde pompoen met feta")).toHaveCount(0);

  await page.goto("/makers/groenten-met-gust");
  await page.getByRole("button", { name: "Volgen Groenten met Gust" }).click();
  await expect
    .poll(
      async () =>
        (await nepDb()).follows?.find((f) => f["follower_id"] === IK && f["creator_id"] === GUST)?.[
          "created_at"
        ] ?? null,
    )
    .not.toBeNull();

  // Gust deelt daarna iets nieuws.
  await nieuwReceptVanGust();
  await page.goto("/inspiratie");
  const lijst = feed.getByRole("list", { name: "Nieuw van makers die je volgt" });
  await expect(lijst.getByRole("listitem").first()).toContainText("Witloofgratin zonder ham");
  await expect(lijst.getByRole("listitem").first()).toContainText(
    "Groenten met Gust deelde een recept · vandaag",
  );
  // Ouder recept van Gust (vóór het volgen) staat in de feed, maar geeft geen melding.
  await expect(feed.getByText("Geroosterde pompoen met feta")).toBeVisible();

  const bel = page.getByTestId("meldingen-bel").first();
  await expect(bel).toHaveAttribute("aria-label", /Meldingen, \d+ nieuw/);
  await bel.click();
  const meldingen = page.getByTestId("meldingen-lijst");
  await expect(
    meldingen.getByText("Groenten met Gust deelde een nieuw recept: Witloofgratin zonder ham"),
  ).toBeVisible();
  await expect(meldingen.getByText(/deelde een nieuw recept: Geroosterde pompoen/)).toHaveCount(0);
  await meldingen.getByText(/Witloofgratin zonder ham/).click();
  await expect(page).toHaveURL(new RegExp(`/recepten/${NIEUW}`));
  await expect(
    page.getByRole("heading", { name: "Witloofgratin zonder ham" }).first(),
  ).toBeVisible();

  // Ontvolgen vanuit de feed: Gust verdwijnt uit de feed.
  await page.goto("/inspiratie");
  await feed.getByText(/Wie je volgt/).click();
  await feed.getByRole("button", { name: "Volgend Groenten met Gust" }).click();
  await expect(feed.getByText("Witloofgratin zonder ham")).toHaveCount(0);
  await expect
    .poll(async () =>
      (await nepDb()).follows?.some((f) => f["follower_id"] === IK && f["creator_id"] === GUST),
    )
    .toBe(false);
});

test("melding van makers per soort uitzetten", async ({ page }) => {
  await meldAan(page);
  await page.goto("/makers/groenten-met-gust");
  await page.getByRole("button", { name: "Volgen Groenten met Gust" }).click();
  await expect(page.getByRole("button", { name: "Volgend Groenten met Gust" })).toBeVisible();
  await nieuwReceptVanGust();

  await page.goto("/instellingen/suggesties#meldingen");
  const rij = page.locator("label").filter({ hasText: "Nieuw van makers die je volgt" });
  await rij.getByRole("switch").click();
  await expect(rij.getByRole("switch")).toHaveAttribute("aria-checked", "false");

  await page.goto("/inspiratie");
  await expect(
    page.getByTestId("volgend-feed").getByText("Witloofgratin zonder ham"),
  ).toBeVisible();
  await page.getByTestId("meldingen-bel").first().click();
  await expect(page.getByText(/deelde een nieuw recept: Witloofgratin/)).toHaveCount(0);
});

test("lege toestand: wie niemand volgt, krijgt uitleg", async ({ page }) => {
  await meldAan(page);
  await page.goto("/makers/lotte-kookt");
  await page.getByRole("button", { name: "Volgend Lotte kookt" }).click();
  await expect(page.getByRole("button", { name: "Volgen Lotte kookt" })).toBeVisible();
  await page.goto("/inspiratie");
  const feed = page.getByTestId("volgend-feed");
  await expect(feed.getByText("Je volgt nog niemand")).toBeVisible();
  await expect(feed.getByRole("link", { name: "Makers ontdekken" })).toBeVisible();
});

const LOTTE_USER = "9a9a9a9a-0000-4000-8000-000000000001";
const STOEMP = "a7a7a7a7-0000-4000-8000-000000000002";

test("videorecept: maker zet tijden bij de stappen, fan ziet klikbare tijden", async ({
  page,
  browser,
}) => {
  await meldAan(page, LOTTE_USER);
  await page.goto("/maker");
  const rij = page.getByRole("listitem", { name: "Stoemp met prei en spekjes" });
  await rij.getByText(/Video en tijden/).click();
  await expect(rij.getByText(/Foodlo bewaart alleen de link/)).toBeVisible();
  const tijden = rij.getByTestId("video-tijden");
  await tijden.getByLabel(/Stap 1:/).fill("0:20");
  await tijden.getByLabel(/Stap 2:/).fill("1.05");
  await tijden.getByLabel(/Stap 4:/).fill("9:99");
  await tijden.getByRole("button", { name: "Tijden bewaren" }).click();
  await expect(tijden.getByRole("alert")).toHaveText("Stap 4: Schrijf de tijd zoals 0:45 of 1:30.");
  await expect(tijden.getByLabel(/Stap 4:/)).toBeFocused();
  await tijden.getByLabel(/Stap 4:/).fill("3:40");
  await tijden.getByRole("button", { name: "Tijden bewaren" }).click();
  await expect(page.getByText("Tijden bij de stappen bewaard")).toBeVisible();
  await expect
    .poll(async () => (await nepDb()).recipes?.find((r) => r["id"] === STOEMP)?.["instructions"])
    .toEqual([
      "0:20 Kook de aardappelen gaar.",
      "1:05 Stoof de prei in boter.",
      "Bak de spekjes krokant.",
      "3:40 Stamp alles samen en kruid met nootmuskaat.",
    ]);

  // De fan (Marie) ziet de videokaart met de maker als bron en klikbare tijden.
  const fanContext = await browser.newContext();
  const fan = await fanContext.newPage();
  await fan.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "localhost"
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  await meldAan(fan);
  await fan.goto(`/recepten/${STOEMP}`);
  await expect(fan.getByTestId("video-bron")).toContainText("Video van Lotte kookt op YouTube");
  const tijd = fan.getByRole("link", { name: /Bekijk op 1 minuut 5 seconden in de video/ });
  await expect(tijd).toHaveAttribute("href", "https://www.youtube.com/watch?v=demo-stoemp&t=65s");
  await expect(fan.getByText("Stoof de prei in boter.").first()).toBeVisible();
  await fanContext.close();
});

const AHMED_USER = "9a9a9a9a-0000-4000-8000-000000000002";
const AHMED = "c7c7c7c7-0000-4000-8000-000000000002";
const HARIRA = "a7a7a7a7-0000-4000-8000-000000000006";
const TAJINE = "a7a7a7a7-0000-4000-8000-000000000003";

const mijnAbo = async () =>
  (await nepDb()).maker_abonnementen?.find((a) => a["fan_id"] === IK && a["creator_id"] === AHMED);

test("abonneren in testmodus → exclusief recept zichtbaar → opzeggen → niet meer zichtbaar", async ({
  page,
}) => {
  await meldAan(page);
  // Zonder abonnement: titel en foto met een slotje, de inhoud niet.
  await page.goto("/makers/chef-ahmed");
  const harira = page.getByRole("listitem").filter({ hasText: "Harira van mijn moeder" });
  await expect(harira.getByText("Voor abonnees")).toBeVisible();
  await harira.getByRole("link").first().click();
  await expect(page.getByTestId("recept-exclusief")).toContainText(
    "Dit recept is voor abonnees van Chef Ahmed",
  );
  await expect(page.getByText("Laat 40 minuten zacht koken.")).toHaveCount(0);
  await page.getByRole("link", { name: "Bekijk het abonnement" }).click();
  await expect(page).toHaveURL(/\/makers\/chef-ahmed$/);

  const blok = page.getByTestId("maker-abonneren");
  await expect(blok).toContainText("Testmodus");
  await expect(blok).toContainText("Er wordt niets aangerekend");
  await expect(blok).toContainText(/€\s3,99 per maand/);
  await expect(blok).toContainText(/Inclusief €\s0,69 btw \(21 %\)/);
  await blok.getByRole("button", { name: "Abonneren in testmodus" }).click();
  const vraag = page.getByRole("alertdialog");
  await expect(vraag).toContainText("Er wordt niets aangerekend");
  await vraag.getByRole("button", { name: "Ja, abonneren (test)" }).click();
  await expect(blok.getByRole("status")).toContainText("Je bent abonnee (testmodus)");
  await expect.poll(async () => (await mijnAbo())?.["status"]).toBe("actief");
  const betalingen = (await nepDb()).maker_betalingen?.filter((b) => b["fan_id"] === IK) ?? [];
  expect(betalingen.map((b) => `${b["soort"]}/${b["bedrag_cent"]}/${b["test"]}`)).toEqual([
    "betaling/399/true",
  ]);

  // Met abonnement: het recept en de exclusieve collectie zijn te zien.
  await expect(harira.getByText("Voor abonnees")).toHaveCount(0);
  await page.goto(`/recepten/${HARIRA}`);
  await expect(page.getByRole("heading", { name: "Harira van mijn moeder" }).first()).toBeVisible();
  await expect(page.getByText("Laat 40 minuten zacht koken.").first()).toBeVisible();
  await page.goto("/makers/chef-ahmed");
  await page.getByRole("tab", { name: /Collecties/ }).click();
  await page.getByRole("link", { name: /Ramadan-avonden/ }).click();
  await expect(page.getByRole("link", { name: /Harira van mijn moeder/ })).toBeVisible();

  // Opzeggen: uitleg over de testterugbetaling vooraf; daarna weer op slot.
  await page.goto("/makers/chef-ahmed");
  await blok.getByRole("button", { name: "Abonnement opzeggen" }).click();
  await expect(vraag).toContainText("stopt meteen");
  await expect(vraag).toContainText("alles terug");
  await vraag.getByRole("button", { name: "Ja, opzeggen" }).click();
  await expect(page.getByText(/Opgezegd\. Testterugbetaling: €\s3,99/)).toBeVisible();
  await expect.poll(async () => (await mijnAbo())?.["status"]).toBe("opgezegd");
  expect(
    ((await nepDb()).maker_betalingen ?? [])
      .filter((b) => b["fan_id"] === IK)
      .map((b) => b["soort"])
      .sort(),
  ).toEqual(["betaling", "terugbetaling"]);
  await blok.getByText(/Testbetalingen \(2\)/).click();
  await expect(blok.getByText("Testterugbetaling", { exact: false })).toBeVisible();

  await page.goto(`/recepten/${HARIRA}`);
  await expect(page.getByTestId("recept-exclusief")).toBeVisible();
  await page.goto("/verzamelingen/e7e7e7e7-0000-4000-8000-000000000003");
  await expect(page.getByText("Deze collectie is voor abonnees")).toBeVisible();
});

test("maker: abonnement instellen, abonnees zonder betaalgegevens, recept exclusief maken", async ({
  page,
}) => {
  await meldAan(page, AHMED_USER);
  await page.goto("/maker");
  const blok = page.getByTestId("maker-abonnement");
  await expect(blok).toContainText("Er wordt niets aangerekend en niets uitbetaald");
  await expect(
    blok.getByRole("switch", { name: "Abonnement aanbieden (testmodus)" }),
  ).toHaveAttribute("aria-checked", "true");
  // Abonnees: alleen voornaam en sinds wanneer, geen bedragen per persoon.
  await expect(blok.getByText("1 actieve abonnee", { exact: false })).toBeVisible();
  const jan = blok.getByRole("listitem").filter({ hasText: "Jan" });
  await expect(jan).toContainText("loopt");
  await expect(jan).not.toContainText("€");
  await expect(blok).not.toContainText("test_demo_1");

  // Ongeldige prijs → uitleg; geldige → bewaard.
  await blok.getByLabel("Testprijs per maand (inclusief btw)").fill("0,20");
  await blok.getByRole("button", { name: "Abonnement bewaren" }).click();
  await expect(blok.getByRole("alert")).toContainText("tussen € 1 en € 50");
  await blok.getByLabel("Testprijs per maand (inclusief btw)").fill("4,50");
  await blok.getByRole("button", { name: "Abonnement bewaren" }).click();
  await expect(page.getByText("Abonnement bewaard (testmodus)")).toBeVisible();
  await expect
    .poll(
      async () =>
        (await nepDb()).maker_plannen?.find((p) => p["creator_id"] === AHMED)?.["prijs_cent"],
    )
    .toBe(450);

  const rij = page.getByRole("listitem", { name: "Kip-tajine met abrikozen" });
  await rij.getByRole("switch", { name: "Alleen voor abonnees" }).click();
  await expect
    .poll(
      async () =>
        (await nepDb()).recipe_publicaties?.find((p) => p["recipe_id"] === TAJINE)?.["exclusief"],
    )
    .toBe(true);
});
