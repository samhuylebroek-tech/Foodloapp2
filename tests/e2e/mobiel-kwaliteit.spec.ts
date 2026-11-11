/**
 * Mobiele kwaliteit, aanvullend op mobiel-breedtes.spec.ts:
 * - 320 px (kleinste gangbare breedte, iPhone SE 1e gen. / smalle Android) en 430 px;
 * - grotere tekst (150 % en 200 %, zoals "Tekstgrootte" in Android-Chrome of tekstzoom);
 * - toetsenbord: zichtbare focus, dialoog sluit met Escape en focus keert terug.
 *
 * Dit zijn SIMULATIES (Chromium in project mobiel-390, WebKit in project iphone-webkit).
 * Geen echt toestel: iOS Dynamic Type, het echte schermtoetsenbord, VoiceOver en TalkBack
 * worden hier niet getest (zie PRAKTIJKTEST-TOESTELLEN.md).
 */
import type { Page } from "@playwright/test";
import { expect, heeftHorizontaleScroll, meldAan, resetDemo, test, zetKlok } from "./helpers";

const RECEPT = "aaaaaaaa-0000-4000-8000-000000000001";
const KERN = [
  "/",
  "/gerechten",
  `/recepten/${RECEPT}`,
  "/recepten/nieuw",
  "/planner",
  "/boodschappen",
  "/voorraad",
  "/inspiratie",
  "/meer",
  "/instellingen",
  "/gezin",
];

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await zetKlok(page, 14);
  await meldAan(page);
});

async function laad(page: Page, pad: string) {
  await page.goto(pad);
  await expect(page.locator("main, [role=main]").first()).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

/** Elementen die rechts buiten het scherm vallen (afgesneden knoppen of tekst). */
async function buitenBeeld(page: Page) {
  return page.evaluate(() => {
    const b = document.documentElement.clientWidth;
    return [...document.querySelectorAll<HTMLElement>("main button, main a[href], main h1, main h2")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        // Binnen een horizontaal scrollende rij (chips, carrousel) is dat de bedoeling.
        let p: HTMLElement | null = el.parentElement;
        while (p) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll" || o === "hidden") return false;
          p = p.parentElement;
        }
        return r.right > b + 1;
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
  });
}

for (const breedte of [320, 430]) {
  test(`${breedte} px: kernschermen zonder horizontaal scrollen of afgesneden knoppen`, async ({
    page,
    extern,
  }) => {
    await page.setViewportSize({ width: breedte, height: 740 });
    const fouten: string[] = [];
    for (const pad of KERN) {
      await laad(page, pad);
      if (await heeftHorizontaleScroll(page)) fouten.push(`${pad}: horizontaal scrollen`);
      for (const el of await buitenBeeld(page)) fouten.push(`${pad}: ${el} buiten beeld`);
    }
    expect(fouten).toEqual([]);
    void extern;
  });
}

for (const schaal of [150, 200]) {
  test(`grotere tekst ${schaal} %: kernschermen blijven bruikbaar op 390 px`, async ({
    page,
    extern,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((s) => {
      // Tekstzoom: alle rem-maten schalen mee, zoals bij een grotere tekstinstelling.
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.fontSize = `${s}%`;
      });
    }, schaal);
    const fouten: string[] = [];
    for (const pad of KERN) {
      await laad(page, pad);
      const grootte = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      expect(grootte).toBeGreaterThanOrEqual((16 * schaal) / 100 - 0.5);
      if (await heeftHorizontaleScroll(page)) fouten.push(`${pad}: horizontaal scrollen`);
      for (const el of await buitenBeeld(page)) fouten.push(`${pad}: ${el} buiten beeld`);
      // De hoofdnavigatie moet bereikbaar blijven.
      const nav = page.getByRole("navigation").first();
      if (await nav.count()) await expect(nav).toBeVisible();
    }
    expect(fouten).toEqual([]);
    void extern;
  });
}

test("toetsenbord: elke focusstap is zichtbaar op Vandaag", async ({ page, extern, browserName }) => {
  // WebKit (Safari) slaat links standaard over bij Tab (instelling "Tab markeert alle
  // onderdelen"); Alt+Tab doet dat wel.
  const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
  await laad(page, "/");
  const onzichtbaar: string[] = [];
  const gezien = new Set<string>();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press(tab);
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const zichtbaar =
        (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
        (s.boxShadow !== "none" && s.boxShadow !== "") ||
        el.matches(":focus-visible") === false; // muisfocus telt niet
      const r = el.getBoundingClientRect();
      return {
        naam: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`,
        zichtbaar,
        inBeeld: r.width > 0 && r.height > 0,
      };
    });
    if (!info) continue;
    gezien.add(info.naam);
    if (info.inBeeld && !info.zichtbaar) onzichtbaar.push(info.naam);
  }
  expect(gezien.size, "Tab bereikt meerdere bedieningselementen").toBeGreaterThan(5);
  expect(onzichtbaar).toEqual([]);
  void extern;
});

test("toetsenbord: dialoog sluit met Escape en de focus keert terug", async ({ page, extern }) => {
  await laad(page, "/planner");
  const opener = page.getByRole("button", { name: "Gerecht toevoegen" }).last();
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialoog = page.getByRole("dialog");
  await expect(dialoog).toBeVisible();
  // De focus zit in de dialoog (niet erachter).
  expect(await dialoog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialoog).toBeHidden();
  expect(
    await opener.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)),
  ).toBe(true);
  void extern;
});

test("formulier Recept toevoegen: elk invoerveld heeft een naam voor de schermlezer", async ({
  page,
  extern,
}) => {
  await laad(page, "/recepten/nieuw");
  // Elk zichtbaar invoerveld heeft een toegankelijke naam (label of aria-label).
  const naamloos = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main input:not([type=hidden]), main textarea, main select")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .filter((el) => {
        const id = el.id;
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        return !(
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          label ||
          el.closest("label")
        );
      })
      .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute("type") ?? ""}] ${el.getAttribute("placeholder") ?? ""}`),
  );
  expect(naamloos).toEqual([]);
  void extern;
});
