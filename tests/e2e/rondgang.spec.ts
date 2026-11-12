/**
 * Visuele rondgang: de echte schermen van Foodloapp, zoals een gebruiker ze ziet (alleen met
 * SCHERMEN=1, via `npm run schermen`). Alleen nepdata (lokale nep-Supabase), nooit productie.
 * Zelfde rondgang vóór en na een UX-wijziging, zodat de eigenaar het verschil ziet.
 * Bestanden: docs/foodloapp-v2/schermen/actueel/<thema>-<nr>-<naam>.jpg + galerij (README.md).
 */
import type { Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import { meldAan, resetDemo, test, voorraadBijhouden, zetKlok } from "./helpers";

test.skip(!process.env["SCHERMEN"], "alleen met SCHERMEN=1");
test.describe.configure({ timeout: 300_000 });

const NEP = "http://127.0.0.1:54439/rest/v1";
const MAP = process.env["SCHERMEN_MAP"] ?? "docs/foodloapp-v2/schermen/actueel";
const ZALM = "/recepten/aaaaaaaa-0000-4000-8000-000000000003";

async function klaar(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(700);
}

for (const thema of ["licht", "extra-duidelijk"] as const)
  test(`rondgang ${thema}`, async ({ page }) => {
    await resetDemo();
    if (thema === "extra-duidelijk")
      await fetch(`${NEP}/profiles?id=eq.${DEMO_USER_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thema: "contrast" }),
      });
    await meldAan(page);
    await voorraadBijhouden(page);
    await zetKlok(page, 17);
    if (thema === "extra-duidelijk")
      await page.addInitScript(() => {
        window.localStorage.setItem("thema", "contrast");
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.style.fontSize = "150%";
        });
      });

    let nr = 0;
    const foto = async (naam: string) => {
      await klaar(page);
      nr++;
      await page.screenshot({
        path: `${MAP}/${thema}-${String(nr).padStart(2, "0")}-${naam}.jpg`,
        fullPage: true,
        // Compact genoeg om per wijziging te bewaren (± 100–300 kB per scherm).
        type: "jpeg",
        quality: 80,
        scale: "css",
        style: 'nav[aria-label="Snelmenu"]{position:static!important}',
      });
    };

    await page.goto("/");
    await foto("vandaag");
    await page.goto("/planner");
    await foto("week");
    await page.goto("/boodschappen");
    await foto("lijst");
    await page.getByRole("button", { name: "Ik ga winkelen" }).click();
    await foto("winkelmodus");
    await page.goto(ZALM);
    await foto("recept");
    await page.getByRole("button", { name: "Start koken" }).first().click();
    await page.getByRole("button", { name: "Begin met koken" }).click();
    await foto("kookstand");
    await page.goto("/voorraad");
    await foto("keuken");
    await page.goto("/inspiratie");
    await foto("ontdek");
    await page.goto("/instellingen");
    await foto("instellingen");
  });
