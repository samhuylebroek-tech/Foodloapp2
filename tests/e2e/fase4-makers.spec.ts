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
