/**
 * Module B (makers): volgen/ontvolgen, makerpagina met tabbladen, Ontdek-rij, bronvermelding,
 * maker worden en een recept openbaar publiceren (langs moderatie), verzamelingen, en de
 * "binnenkort"-staat als de tabellen ontbreken (productie vóór migratie 0008). Nepdata.
 */
import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  meldAan,
  nepDb,
  resetDemo,
  storing,
  test,
} from "./helpers";
import type { Page } from "@playwright/test";

const IK = "11111111-1111-4111-8111-111111111111";
const AHMED = "c7c7c7c7-0000-4000-8000-000000000002";
const TAJINE = "a7a7a7a7-0000-4000-8000-000000000003";
const WORTELSOEP = "a7a7a7a7-0000-4000-8000-000000000001";
const MOUSSE = "aaaaaaaa-0000-4000-8000-000000000005";

const volgtAhmed = async () =>
  (await nepDb()).follows?.some((f) => f["follower_id"] === IK && f["creator_id"] === AHMED) ??
  false;

/** "Ongedaan maken" in de voorste melding (oudere meldingen liggen eronder). */
const ongedaan = (page: Page) =>
  page
    .locator('[data-sonner-toast][data-front="true"]')
    .getByRole("button", { name: "Ongedaan maken" })
    .click();

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("maker volgen, ontvolgen en ongedaan maken", async ({ page }) => {
  await page.goto("/makers/chef-ahmed");
  await expect(page.getByRole("heading", { name: "Chef Ahmed", level: 2 })).toBeVisible();
  await expect(page.getByText("Geverifieerd").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Kip-tajine met abrikozen/ })).toBeVisible();

  await page.getByRole("button", { name: "Volgen Chef Ahmed" }).click();
  await expect(page.getByRole("button", { name: "Volgend Chef Ahmed" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(volgtAhmed).toBe(true);

  await page.getByRole("button", { name: "Volgend Chef Ahmed" }).click();
  await expect.poll(volgtAhmed).toBe(false);
  // Ongedaan maken in de melding: weer volgen.
  await ongedaan(page);
  await expect.poll(volgtAhmed).toBe(true);
  await expect(page.getByRole("button", { name: "Volgend Chef Ahmed" })).toBeVisible();
});

test("tabbladen: video als veilige link, collecties van de maker", async ({ page }) => {
  await page.goto("/makers/chef-ahmed");
  await page.getByRole("tab", { name: /Video's/ }).click();
  const link = page.getByRole("link", { name: /Bekijk op TikTok/ });
  await expect(link).toHaveAttribute("href", /^https:\/\/www\.tiktok\.com\//);
  await expect(link).toHaveAttribute("rel", /noopener/);
  // Geen ingesloten speler van derden.
  await expect(page.locator("iframe")).toHaveCount(0);

  await page.goto("/makers/lotte-kookt");
  await page.getByRole("tab", { name: /Collecties/ }).click();
  await page.getByRole("link", { name: /Snelle soepen/ }).click();
  await expect(page).toHaveURL(/\/verzamelingen\//);
  await expect(page.getByRole("link", { name: /Wortelsoep met sinaasappel/ })).toBeVisible();
});

test("Ontdek toont makers om te volgen; overzicht met zoeken en Volgend-filter", async ({
  page,
}) => {
  await page.goto("/inspiratie");
  await expect(page.getByRole("heading", { name: "Makers om te volgen" })).toBeVisible();
  // Bestaande Ontdek-functies blijven werken.
  await expect(page.getByRole("button", { name: /Verras mij/ })).toBeVisible();
  await page.getByRole("link", { name: "Alle makers" }).click();
  await expect(page).toHaveURL(/\/makers$/);
  await expect(page.getByRole("link", { name: "Groenten met Gust" })).toBeVisible();

  await page.getByRole("textbox", { name: "Zoek een maker" }).fill("marokkaans");
  await expect(page.getByRole("link", { name: "Chef Ahmed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lotte kookt" })).toHaveCount(0);

  await page.getByRole("textbox", { name: "Zoek een maker" }).fill("");
  await page.getByRole("button", { name: /Volgend \(1\)/ }).click();
  await expect(page.getByRole("link", { name: "Lotte kookt" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Chef Ahmed" })).toHaveCount(0);
});

test("bronvermelding op een openbaar makerrecept leidt naar de maker", async ({ page }) => {
  await page.goto(`/recepten/${TAJINE}`);
  await expect(page.getByRole("link", { name: "Van Chef Ahmed" })).toBeVisible();
  // Fase 4: de video van de maker staat op de videokaart, met de maker als bron.
  await expect(page.getByTestId("video-bron")).toContainText("Video van Chef Ahmed op TikTok");
  await expect(page.getByRole("link", { name: /Bekijk de video bij TikTok/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Video op TikTok/ })).toHaveCount(0);
  // Geen bewerkknop: het is niet jouw recept.
  await expect(page.getByRole("link", { name: "Aanpassen" })).toHaveCount(0);
  await page.getByRole("link", { name: "Van Chef Ahmed" }).click();
  await expect(page).toHaveURL(/\/makers\/chef-ahmed$/);
});

test("maker worden, handle controleren en een recept openbaar publiceren", async ({ page }) => {
  await page.goto("/maker");
  await expect(page.getByRole("heading", { name: "Word maker" })).toBeVisible();
  await page.getByLabel("Naam op je pagina").fill("Marie kookt");
  // Voorbehouden naam wordt geweigerd met uitleg.
  await page.getByLabel("Korte naam voor je link").fill("beheer");
  await page.getByRole("button", { name: "Maak mijn makerpagina" }).click();
  await expect(page.getByRole("alert")).toContainText("voorbehouden");
  // Bezette naam (van Chef Ahmed).
  await page.getByLabel("Korte naam voor je link").fill("Chef Ahmed");
  await page.getByRole("button", { name: "Maak mijn makerpagina" }).click();
  await expect(page.getByRole("alert")).toContainText("al in gebruik");

  await page.getByLabel("Korte naam voor je link").fill("Marie Kookt");
  await expect(page.getByText("marie-kookt")).toBeVisible();
  await page.getByLabel(/Waar kook je graag/).fill("Nagerechten, Belgisch");
  await page.getByRole("button", { name: "Maak mijn makerpagina" }).click();
  await expect(page.getByRole("heading", { name: "Je cijfers" })).toBeVisible();
  const db = await nepDb();
  expect(db.creators?.find((c) => c["user_id"] === IK)?.["handle"]).toBe("marie-kookt");

  const rij = page.getByRole("listitem", { name: "Chocolademousse" });
  await expect(rij.getByText("Concept")).toBeVisible();
  // Privé kan je niet "publiceren".
  await expect(rij.getByRole("button", { name: "Publiceren" })).toBeDisabled();
  await rij.getByRole("button", { name: "Openbaar" }).click();
  await rij.getByRole("button", { name: "Publiceren" }).click();
  const vraag = page.getByRole("alertdialog");
  await expect(vraag).toContainText("Foodlo-team bekijkt het recept eerst");
  await vraag.getByRole("button", { name: "Ja, openbaar publiceren" }).click();
  await expect(rij.getByText("Wacht op controle")).toBeVisible();
  await expect
    .poll(async () => {
      const p = (await nepDb()).recipe_publicaties?.find((x) => x["recipe_id"] === MOUSSE);
      return p ? `${p["zichtbaarheid"]}/${p["status"]}/${p["moderatie"]}` : null;
    })
    .toBe("openbaar/gepubliceerd/wacht");

  // Video-link: alleen bekende diensten.
  await rij.getByText(/Video en tijden/).click();
  await rij.getByLabel("Link naar je kookvideo").fill("https://evil.example/video");
  await rij.getByRole("button", { name: "Video bewaren" }).click();
  await expect(rij.getByRole("alert")).toContainText("YouTube");
  await rij.getByLabel("Link naar je kookvideo").fill("https://youtu.be/demo");
  await rij.getByRole("button", { name: "Video bewaren" }).click();
  await expect
    .poll(
      async () =>
        (await nepDb()).recipe_publicaties?.find((x) => x["recipe_id"] === MOUSSE)?.["video_url"],
    )
    .toBe("https://youtu.be/demo");
  // Video bewaren zet de publicatie niet terug.
  expect(
    (await nepDb()).recipe_publicaties?.find((x) => x["recipe_id"] === MOUSSE)?.["status"],
  ).toBe("gepubliceerd");

  // Depubliceren met ongedaan maken.
  await rij.getByRole("button", { name: "Depubliceren" }).click();
  await expect(rij.getByText("Concept")).toBeVisible();
  await ongedaan(page);
  await expect(rij.getByText("Wacht op controle")).toBeVisible();

  // Een ander recept met vrienden en gezin delen: geen moderatie nodig.
  const soep = page.getByRole("listitem", { name: "Romige pompoensoep" });
  await soep.getByRole("button", { name: "Vrienden en gezin" }).click();
  await soep.getByRole("button", { name: "Publiceren" }).click();
  await expect(soep.getByText("Gepubliceerd · Vrienden en gezin")).toBeVisible();
});

test("verzameling maken en een recept bewaren via Bewaar in…", async ({ page }) => {
  await page.goto(`/recepten/${WORTELSOEP}`);
  // Dit recept zit in de demo al in "Zondag".
  await page.getByRole("button", { name: "Bewaard in 1" }).click();
  await page.getByLabel("Nieuwe verzameling").fill("Kerst");
  await page.getByRole("button", { name: "Maken en bewaren" }).click();
  await expect(page.getByRole("checkbox", { name: "Kerst" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // Al bestaande verzameling "Zondag" bevat dit recept al (demo); uitvinken haalt het eruit.
  const zondag = page.getByRole("checkbox", { name: "Zondag" });
  await expect(zondag).toHaveAttribute("aria-checked", "true");
  await zondag.click();
  await expect(zondag).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Klaar" }).click();
  await expect(page.getByRole("button", { name: "Bewaard in 1" })).toBeVisible();
  expect(
    (await nepDb()).collection_recipes?.some(
      (r) =>
        r["collection_id"] === "e7e7e7e7-0000-4000-8000-000000000001" &&
        r["recipe_id"] === WORTELSOEP,
    ),
  ).toBe(false);

  const db = await nepDb();
  const kerst = db.collections?.find((c) => c["naam"] === "Kerst" && c["user_id"] === IK);
  expect(kerst).toBeTruthy();
  expect(
    db.collection_recipes?.some(
      (r) => r["collection_id"] === kerst!["id"] && r["recipe_id"] === WORTELSOEP,
    ),
  ).toBe(true);

  // Keuken toont "Mijn verzamelingen"; detail toont het recept met bronvermelding.
  await page.goto("/gerechten");
  await expect(page.getByRole("heading", { name: "Mijn verzamelingen" })).toBeVisible();
  await page.getByRole("link", { name: /Kerst/ }).click();
  await expect(page.getByRole("link", { name: /Wortelsoep met sinaasappel/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Van Lotte kookt" })).toBeVisible();

  // Verwijderen laat de recepten staan, met ongedaan maken.
  await page.getByRole("button", { name: "Verzameling verwijderen" }).click();
  await expect(page).toHaveURL(/\/gerechten/);
  await expect
    .poll(async () => (await nepDb()).collections?.some((c) => c["naam"] === "Kerst"))
    .toBe(false);
  await ongedaan(page);
  await expect
    .poll(async () => (await nepDb()).collections?.some((c) => c["naam"] === "Kerst"))
    .toBe(true);
});

test("zonder tabellen (productie vóór 0008): rustige binnenkort-staat, geen fout", async ({
  page,
}) => {
  for (const tabel of ["creators", "collections", "community_bijdragen"])
    await storing({ pad: `/rest/v1/${tabel}`, soort: "ontbreekt", keer: 50 });
  await page.goto("/makers");
  await expect(page.getByRole("heading", { name: "Makers komt binnenkort" })).toBeVisible();
  await expect(page.getByText("Deze functie wordt binnenkort geactiveerd.")).toBeVisible();
  await page.goto("/maker");
  await expect(page.getByRole("heading", { name: /komt binnenkort/ })).toBeVisible();
  // Ontdek en een eigen recept werken gewoon, zonder makerrij of "Bewaar in…".
  await page.goto("/inspiratie");
  await expect(page.getByRole("button", { name: /Verras mij/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Makers om te volgen" })).toHaveCount(0);
  await page.goto(`/recepten/${MOUSSE}`);
  await expect(page.getByRole("button", { name: "Start koken" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Bewaar in…" })).toHaveCount(0);
});

test("toegankelijk: geen ernstige axe-fouten en geen horizontale scroll", async ({ page }) => {
  for (const pad of [
    "/makers",
    "/makers/chef-ahmed",
    "/maker",
    "/verzamelingen/e7e7e7e7-0000-4000-8000-000000000001",
    `/recepten/${TAJINE}`,
  ]) {
    await page.goto(pad);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByLabel("Laden")).toHaveCount(0);
    expect(await axeErnstig(page), pad).toEqual([]);
    expect(await heeftHorizontaleScroll(page), pad).toBe(false);
  }
});
