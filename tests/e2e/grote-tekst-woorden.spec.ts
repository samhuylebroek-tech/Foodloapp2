/**
 * BUG-134 (harde test): bij 150 % tekst op 390 px breekt geen woord middenin op Week, Keuken
 * (recepten en voorraad), Instellingen en het nieuwe recept (ook stap voor stap). Een afbreking
 * met koppelteken (`hyphens: auto`, toegelaten door het designsysteem) telt niet als fout.
 * Simulatie in Chromium, geen echt toestel.
 */
import type { Page } from "@playwright/test";
import { expect, meldAan, resetDemo, test, zetKlok } from "./helpers";

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "150%";
    });
  });
});

/** Woorden (≥ 4 letters) die over twee regels lopen zonder koppelteken. */
async function gebrokenWoorden(page: Page) {
  return page.evaluate(() => {
    const uit: string[] = [];
    const main = document.querySelector("main") ?? document.body;
    const loper = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = loper.nextNode())) {
      const el = n.parentElement;
      if (!el) continue;
      const stijl = getComputedStyle(el);
      if (stijl.hyphens === "auto" || stijl.visibility === "hidden") continue;
      if (el.closest(".sr-only, [aria-hidden=true], textarea, input")) continue;
      const tekst = n.textContent ?? "";
      // Een webadres mag overal breken; dat is geen woord.
      if (/:\/\/|www\./.test(tekst)) continue;
      for (const m of tekst.matchAll(/[\p{L}]{4,}/gu)) {
        const r = document.createRange();
        r.setStart(n, m.index!);
        r.setEnd(n, m.index! + m[0].length);
        const rects = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
        const regels = new Set(rects.map((x) => Math.round(x.top)));
        if (regels.size > 1) uit.push(`"${m[0]}" in <${el.tagName.toLowerCase()}>`);
      }
    }
    return [...new Set(uit)];
  });
}

async function laad(page: Page, pad: string) {
  await page.goto(pad);
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

for (const pad of ["/planner", "/gerechten", "/voorraad", "/instellingen", "/recepten/nieuw"])
  test(`150 % tekst: geen woord middenin gebroken op ${pad}`, async ({ page, extern }) => {
    await laad(page, pad);
    expect(await gebrokenWoorden(page)).toEqual([]);
    void extern;
  });

test("150 % tekst: recept stap voor stap, alle vier de stappen zonder gebroken woorden", async ({
  page,
  extern,
}) => {
  await laad(page, "/recepten/nieuw");
  await page.getByRole("button", { name: "Stap voor stap" }).click();
  await page.getByLabel("Naam van het gerecht").fill("Preisoep");
  for (let stap = 1; stap <= 4; stap++) {
    await expect(page.getByTestId("stap-voortgang")).toContainText(`Stap ${stap} van 4`);
    expect(await gebrokenWoorden(page), `stap ${stap}`).toEqual([]);
    // Geen knop die rechts buiten beeld valt (de stapknoppen groeien naar twee regels).
    const buiten = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main button")]
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.right > document.documentElement.clientWidth + 1;
        })
        .map((b) => (b.textContent ?? "").trim()),
    );
    expect(buiten, `stap ${stap}`).toEqual([]);
    if (stap < 4) await page.getByRole("button", { name: "Volgende" }).click();
  }
  void extern;
});
