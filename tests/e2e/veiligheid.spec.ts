/**
 * Eén veiligheidsregel overal (fase A): allergieën en dieet uit de kennismaking (alleen op het
 * toestel) gelden in Ontdek, Keuken ("Wat kan ik koken?"), op de receptpagina, bij vervangen in de
 * winkel en op Vandaag. Ontbrekende ingrediënten = niet gecontroleerd, nooit "veilig". Nepdata (demo).
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import { axeErnstig, expect, meldAan, resetDemo, test, zetKlok } from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";

async function kennismaking(page: Page, k: { allergieen: string[]; dieet?: string }) {
  await page.addInitScript(
    ([id, waarde]) => window.localStorage.setItem(`foodlo:kennismaking:${id}`, waarde),
    [DEMO_USER_ID, JSON.stringify(k)] as const,
  );
}

/** Tikt "Verras mij" en dan een paar keer "Nog een suggestie"; geeft alle getoonde titels. */
async function verrassingen(page: Page, keer = 8) {
  await page.goto("/inspiratie");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const knop = page.getByRole("button", { name: "Verras mij" });
  await expect(knop).toBeEnabled({ timeout: 30_000 });
  await knop.click();
  const titels = new Set<string>();
  const venster = page.getByRole("dialog");
  for (let n = 0; n < keer; n++) {
    const titel = (await venster.getByRole("heading").first().innerText()).trim();
    titels.add(titel);
    await venster.getByRole("button", { name: "Nog een suggestie" }).click();
    await expect(venster.getByRole("heading").first()).toBeVisible();
  }
  return [...titels];
}

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await meldAan(page);
});

test("Ontdek met glutenallergie: labels op de kaartjes, Verras mij alleen gecontroleerde ideeën", async ({
  page,
  extern,
}) => {
  await kennismaking(page, { allergieen: ["gluten"] });
  const titels = await verrassingen(page);
  // Alleen ideeën mét ingrediëntenlijst en zonder gluten (pasta valt af, ideeën zonder lijst ook).
  expect(titels.length).toBeGreaterThan(0);
  for (const t of titels)
    expect([
      "Romige pompoensoep met gember",
      "Linzensoep met komijn",
      "Shakshuka met feta",
    ]).toContain(t);
  await page.keyboard.press("Escape");

  const lijst = page.getByRole("list", { name: "Alle ideeën" });
  await expect(
    lijst.getByRole("link", { name: /Pasta met pesto en geroosterde groenten/ }),
  ).toContainText("Mogelijk gluten");
  await expect(lijst.getByRole("link", { name: /Konijn met pruimen/ })).toContainText(
    "Niet gecontroleerd op allergieën",
  );
  await expect(lijst.getByRole("link", { name: /Linzensoep met komijn/ })).not.toContainText(
    "Mogelijk",
  );
  expect(await axeErnstig(page)).toEqual([]);

  // Detailpagina: waarschuwing bij een allergeen, melding als er geen ingrediënten zijn.
  await lijst.getByRole("link", { name: /Pasta met pesto/ }).click();
  await expect(page.getByRole("note", { name: "Allergieën" })).toContainText(
    "Let op: mogelijk allergenen",
  );
  await expect(page.getByRole("note", { name: "Allergieën" })).toContainText("Gluten: pasta");
  await page.goBack();
  await page
    .getByRole("list", { name: "Alle ideeën" })
    .getByRole("link", { name: /Konijn met pruimen/ })
    .click();
  await expect(page.getByRole("note", { name: "Allergieën" })).toContainText(
    "Niet gecontroleerd op allergieën",
  );
  void extern;
});

test("Ontdek veganistisch: Verras mij nooit met kaas, room of ei", async ({ page, extern }) => {
  await kennismaking(page, { allergieen: [], dieet: "veganistisch" });
  const titels = await verrassingen(page, 4);
  expect(titels).toEqual(["Linzensoep met komijn"]);
  void extern;
});

test("Ontdek zonder allergieën of dieet: geen labels, Verras mij uit alle ideeën", async ({
  page,
  extern,
}) => {
  const titels = await verrassingen(page, 10);
  expect(titels.length).toBeGreaterThan(3);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Niet gecontroleerd op allergieën")).toHaveCount(0);
  await expect(page.getByText(/^Mogelijk /)).toHaveCount(0);
  void extern;
});

test("Keuken, Wat kan ik koken?: met glutenallergie geen stoofvlees (bloem en bier)", async ({
  page,
  extern,
}) => {
  await page.goto("/voorraad");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const lijst = page.getByRole("list", { name: "Recepten met wat je in huis hebt" });
  await expect(lijst.getByRole("link", { name: /Stoofvlees met frietjes/ })).toBeVisible();

  await kennismaking(page, { allergieen: ["gluten"] });
  await page.reload();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(lijst.getByRole("link", { name: /Romige pompoensoep/ })).toBeVisible();
  await expect(lijst.getByRole("link", { name: /Stoofvlees met frietjes/ })).toHaveCount(0);
  void extern;
});

test("Recept zonder ingrediënten: 'niet gecontroleerd' en nooit voorgesteld op Vandaag", async ({
  page,
  extern,
}) => {
  const id = "aaaaaaaa-0000-4000-8000-0000000000ff";
  const res = await fetch(`${NEP}/recipes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id,
      user_id: DEMO_USER_ID,
      title: "Schotel van oma",
      description: "",
      image_url: null,
      servings: 4,
      prep_minutes: 10,
      cook_minutes: 10,
      difficulty: "makkelijk",
      category: "hoofdgerecht",
      tags: [],
      instructions: ["Zoals oma het deed."],
      source_url: null,
      is_concept: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  expect(res.ok).toBe(true);
  // Niets gepland vandaag, zodat Vandaag voorstellen toont.
  await fetch(`${NEP}/meal_plan?plan_date=eq.${new Date().toLocaleDateString("sv-SE")}`, {
    method: "DELETE",
  });
  await kennismaking(page, { allergieen: ["selder"] });
  await zetKlok(page, 17);

  await page.goto(`/recepten/${id}`);
  await expect(page.getByRole("note", { name: "Allergieën" })).toContainText(
    "Niet gecontroleerd op allergieën",
  );

  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const voorstellen = page.getByRole("region", {
    name: /Met wat je in huis hebt|Ideeën voor vanavond/,
  });
  await expect(voorstellen.getByRole("button", { name: /^Niet nu: / }).first()).toBeVisible();
  await expect(
    voorstellen.getByRole("button", { name: "Kook Schotel van oma vanavond" }),
  ).toHaveCount(0);
  void extern;
});

test("Winkelmodus: een vervanging wordt opnieuw nagekeken op je allergieën", async ({
  page,
  extern,
}) => {
  await kennismaking(page, { allergieen: ["gluten"] });
  await page.goto("/boodschappen");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.getByRole("button", { name: "Ik ga winkelen" }).click();
  await page
    .getByRole("button", { name: / niet gevonden$/ })
    .first()
    .click();
  const veld = page.getByLabel("Of vervangen door");
  await veld.fill("rijstnoedels");
  await expect(page.getByText(/bevat mogelijk/)).toHaveCount(0);
  await veld.fill("spaghetti");
  await expect(
    page.getByRole("status").filter({ hasText: "Let op: spaghetti bevat mogelijk gluten" }),
  ).toBeVisible();
  expect(await axeErnstig(page)).toEqual([]);
  void extern;
});

test("Ontdek op 320 px met tekst 200 % en allergieën: labels lopen niet uit", async ({
  page,
  extern,
}) => {
  await kennismaking(page, { allergieen: ["gluten", "melk", "eieren"] });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
  await page.goto("/inspiratie");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByText("Mogelijk gluten, melk (lactose)").first()).toBeVisible({
    timeout: 30_000,
  });
  const uit = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return {
      scroll: document.documentElement.scrollWidth - w,
      te: [...document.querySelectorAll("main *")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.right <= w + 1 || e.closest(".sr-only")) return false;
          for (let a = e.parentElement; a; a = a.parentElement)
            if (/(auto|scroll)/.test(getComputedStyle(a).overflowX)) return false;
          return true;
        })
        .map((e) => `${e.tagName} "${(e.textContent ?? "").trim().slice(0, 30)}"`)
        .slice(0, 5),
    };
  });
  expect(uit).toEqual({ scroll: 0, te: [] });
  void extern;
});

// Fase D: thema "Nu in het seizoen" (vaste Belgische lijst). In de demo: pompoen en witloof,
// samen alleen van oktober tot december.
test("Ontdek: thema 'Nu in het seizoen' toont gerechten met producten van bij ons", async ({
  page,
  extern,
}) => {
  test.skip(
    ![9, 10, 11].includes(new Date().getMonth()),
    "demo-ideeën alleen okt–dec in het seizoen",
  );
  await page.goto("/inspiratie");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.getByRole("button", { name: /Nu in het seizoen/ }).click();
  await expect(page.getByRole("heading", { name: "Nu in het seizoen" })).toBeVisible();
  const lijst = page.getByRole("list", { name: "Nu in het seizoen" });
  await expect(lijst.getByRole("link", { name: /Romige pompoensoep met gember/ })).toBeVisible();
  await expect(lijst.getByRole("link", { name: /Witloofgratin/ })).toBeVisible();
  await expect(lijst.getByRole("link", { name: /Zalm uit de oven/ })).toHaveCount(0);
  void extern;
});
