/**
 * Foodloapp Intelligence I-1 op Vandaag: voorstellen met redenen, "Niet nu" met ongedaan maken,
 * allergieën als harde grens en uitleg in het Help Center. Nepdata (demo), vaste klok.
 */
import { DEMO_USER_ID } from "./demo-data.mjs";
import { axeErnstig, expect, kleineDoelen, meldAan, resetDemo, test, zetKlok } from "./helpers";

const vandaag = () => new Date().toLocaleDateString("sv-SE");
const REDEN =
  /Gebruikt je|Klaar in|Past bij het seizoen|in het seizoen|sterren|favorieten|meestal snel|is het/;

test.beforeEach(async ({ page }) => {
  await resetDemo();
  // Niets gepland voor vandaag: Vandaag toont "Wat eten we vandaag?" met voorstellen.
  await fetch(`http://127.0.0.1:54439/rest/v1/meal_plan?plan_date=eq.${vandaag()}`, {
    method: "DELETE",
  });
  await meldAan(page);
  await zetKlok(page, 17);
});

test("elk voorstel toont 1 à 2 redenen en 'Waarom zie ik dit?' legt het uit", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const voorstellen = page.getByRole("region", { name: "Met wat je in huis hebt" });
  const items = voorstellen.getByRole("listitem");
  await expect(items.first()).toBeVisible();
  const aantal = await items.count();
  expect(aantal).toBeGreaterThan(0);
  expect(aantal).toBeLessThanOrEqual(3);
  for (let n = 0; n < aantal; n++) {
    const tekst = (await items.nth(n).innerText()).replace(/\s+/g, " ");
    expect(tekst).toMatch(REDEN);
    // Hooguit 2 redenen (gescheiden door " · ").
    const regel =
      tekst.match(
        /(Gebruikt je|Klaar in|Past bij|Je gaf|Een van|Op \w+dag|Over|Vandaag is|[A-Z][a-z ]+ (?:is|zijn) nu in het seizoen)[^]*/,
      )?.[0] ?? "";
    expect(regel.split(" · ").length).toBeLessThanOrEqual(2);
  }
  expect(await axeErnstig(page)).toEqual([]);
  // De verborgen "Naar de inhoud"-link (alleen zichtbaar met het toetsenbord) telt niet mee.
  expect((await kleineDoelen(page)).filter((d) => !d.includes("Naar de inhoud"))).toEqual([]);

  await voorstellen.getByRole("link", { name: "Waarom zie ik dit?" }).click();
  await expect(page.getByRole("heading", { name: "Waarom stelt Foodlo dit voor?" })).toBeVisible();
  void extern;
});

test("'Niet nu' verbergt een voorstel, 'Ongedaan maken' zet het terug", async ({
  page,
  extern,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const voorstellen = page.getByRole("region", { name: "Met wat je in huis hebt" });
  const eerste = voorstellen.getByRole("button", { name: /^Niet nu: / }).first();
  await expect(eerste).toBeVisible();
  const naam = ((await eerste.getAttribute("aria-label")) ?? "").replace(/^Niet nu: /, "");
  await eerste.click();
  await expect(page.getByText("Je ziet dit voorstel een week niet.")).toBeVisible();
  await expect(voorstellen.getByRole("button", { name: `Kook ${naam} vanavond` })).toHaveCount(0);
  // Blijft weg na herladen (op dit toestel bewaard).
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: `Kook ${naam} vanavond` })).toHaveCount(0);
  // Een tweede voorstel wegtikken en meteen terugzetten via de melding.
  const tweede = voorstellen.getByRole("button", { name: /^Niet nu: / }).first();
  const naam2 = ((await tweede.getAttribute("aria-label")) ?? "").replace(/^Niet nu: /, "");
  await tweede.click();
  await expect(voorstellen.getByRole("button", { name: `Kook ${naam2} vanavond` })).toHaveCount(0);
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).click();
  await expect(voorstellen.getByRole("button", { name: `Kook ${naam2} vanavond` })).toBeVisible();
  // Het eerste blijft weg: alleen wat je terugzet, komt terug.
  await expect(voorstellen.getByRole("button", { name: `Kook ${naam} vanavond` })).toHaveCount(0);
  void extern;
});

test("allergie (gluten) uit de kennismaking: geen gerecht met bloem, pasta of bier", async ({
  page,
  extern,
}) => {
  await page.addInitScript(
    ([id]) => {
      window.localStorage.setItem(
        `foodlo:kennismaking:${id}`,
        JSON.stringify({ allergieen: ["gluten"] }),
      );
    },
    [DEMO_USER_ID],
  );
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const voorstellen = page.getByRole("region", { name: "Met wat je in huis hebt" });
  await expect(
    voorstellen.getByRole("button", { name: "Kook Romige pompoensoep vanavond" }),
  ).toBeVisible();
  for (const titel of [
    "Stoofvlees met frietjes",
    "Witloof met hesp en kaassaus",
    "Spaghetti bolognese",
  ])
    await expect(voorstellen.getByRole("button", { name: `Kook ${titel} vanavond` })).toHaveCount(
      0,
    );
  void extern;
});

// BUG-126: Vandaag op 320 px met tekst 200 %, met en zonder plan, ook na scrollen (compacte kop).
for (const metPlan of [false, true])
  test(`320 px en tekst 200 % (${metPlan ? "met plan" : "zonder plan"}): geen zijscroll, knoppen groot genoeg`, async ({
    page,
    extern,
  }) => {
    if (metPlan) await resetDemo();
    await page.setViewportSize({ width: 320, height: 700 });
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.fontSize = "200%";
      });
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    if (!metPlan)
      await expect(
        page
          .getByRole("region", { name: "Met wat je in huis hebt" })
          .getByRole("button", { name: /^Niet nu: / })
          .first(),
      ).toBeVisible();
    else await expect(page.getByRole("region", { name: "Daarna" })).toBeVisible();
    const uitlopers = () =>
      page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        return {
          scroll: document.documentElement.scrollWidth - w,
          te: [...document.querySelectorAll("body *")]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              if (r.width === 0 || r.right <= w + 1 || e.closest(".sr-only")) return false;
              // Binnen een bewuste scrollstrook (bv. de weekdagen) is uitlopen de bedoeling.
              for (let a = e.parentElement; a; a = a.parentElement)
                if (/(auto|scroll)/.test(getComputedStyle(a).overflowX)) return false;
              return true;
            })
            .map(
              (e) =>
                `${e.tagName} "${(e.textContent ?? "").trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().left)}-${Math.round(e.getBoundingClientRect().right)}`,
            )
            .slice(0, 5),
        };
      });
    expect(await uitlopers()).toEqual({ scroll: 0, te: [] });
    // Na scrollen verschijnt de compacte titel in de kop: ook dan geen uitloop.
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await uitlopers()).toEqual({ scroll: 0, te: [] });
    // De verborgen "Naar de inhoud"-link (alleen zichtbaar met het toetsenbord) telt niet mee.
    expect((await kleineDoelen(page)).filter((d) => !d.includes("Naar de inhoud"))).toEqual([]);
    void extern;
  });
