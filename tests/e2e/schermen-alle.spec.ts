/**
 * Schermafdrukken van alle gebruikersschermen (alleen met SCHERMEN=1).
 * SCHERM_MAP=<map> kiest de doelmap onder docs/foodloapp-v2/schermen/.
 * BREEDTES=360,390,430 maakt per breedte een afdruk (standaard 390).
 */
import { meldAan, resetDemo, test } from "./helpers";

const MAP = process.env["SCHERM_MAP"] ?? "audit";
const BREEDTES = (process.env["BREEDTES"] ?? "390").split(",").map(Number);
const ALLEEN = process.env["ALLEEN"];
test.skip(!process.env["SCHERMEN"], "alleen met SCHERMEN=1");

const RECEPT = "aaaaaaaa-0000-4000-8000-000000000001";
const PADEN = [
  "/",
  "/gerechten",
  `/recepten/${RECEPT}`,
  `/recepten/${RECEPT}?koken=true`,
  "/recepten/nieuw",
  `/recepten/${RECEPT}/bewerken`,
  "/planner",
  "/boodschappen",
  "/voorraad",
  "/meer",
  "/instellingen",
  "/gezin",
  "/vrienden",
  "/kaarten",
  "/meldingen",
  "/credits",
  "/feedback",
  "/info",
  "/privacy",
  "/installeren",
  "/inspiratie",
  "/rondleiding",
  "/welkom",
].filter((p) => !ALLEEN || ALLEEN.split(",").some((a) => p.includes(a)));

function bestandsnaam(pad: string) {
  return (
    pad
      .replace(RECEPT, "recept")
      .replace("?koken=true", "_koken")
      .replace(/\//g, "_")
      .replace(/^_/, "") || "vandaag"
  );
}

test.describe.configure({ timeout: 120_000 });

test.describe("ingelogd", () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo();
    await meldAan(page);
  });

  for (const pad of PADEN) {
    test(`scherm ${pad}`, async ({ page }) => {
      for (const breedte of BREEDTES) {
        await page.setViewportSize({ width: breedte, height: 844 });
        await page.goto(pad);
        await page.waitForLoadState("networkidle").catch(() => undefined);
        // Wacht tot laadschermen weg zijn (servercode compileert de eerste keer traag).
        await page
          .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, {
            timeout: 15_000,
          })
          .catch(() => undefined);
        await page.waitForTimeout(700);
        const naam = `docs/foodloapp-v2/schermen/${MAP}/${breedte}-${bestandsnaam(pad)}`;
        // Zoals op de telefoon (wat je ziet zonder te scrollen) ...
        await page.screenshot({ path: `${naam}.png` });
        // ... en de hele pagina, zonder de vaste onderbalk die anders midden in beeld staat.
        await page.screenshot({
          path: `${naam}-volledig.png`,
          fullPage: true,
          style: 'nav[aria-label="Snelmenu"]{display:none!important}',
        });
      }
    });
  }
});

test("scherm /aanmelden (afgemeld)", async ({ page }) => {
  test.skip(!!ALLEEN && !ALLEEN.includes("aanmelden"), "niet gevraagd");
  for (const breedte of BREEDTES) {
    await page.setViewportSize({ width: breedte, height: 844 });
    await page.goto("/aanmelden");
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `docs/foodloapp-v2/schermen/${MAP}/${breedte}-aanmelden.png`,
      fullPage: true,
    });
  }
});
