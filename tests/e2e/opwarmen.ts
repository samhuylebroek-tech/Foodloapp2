/**
 * Opwarmen vóór de tests (betrouwbare testomgeving): de dev-server compileert elke pagina pas bij
 * het eerste bezoek. Onder belasting duurde dat soms langer dan een testtijd. Hier bezoekt één
 * browser alle hoofdschermen één keer, met de nepdata, voor de eerste test begint.
 * Alleen 127.0.0.1; niets verlaat de machine.
 */
import { chromium } from "@playwright/test";
import { meldAan, resetDemo } from "./helpers";

const BASIS = "http://127.0.0.1:4339";
const PADEN = [
  "/aanmelden",
  "/",
  "/planner",
  "/boodschappen",
  "/gerechten",
  "/voorraad",
  "/inspiratie",
  "/instellingen",
  "/hulp",
  "/recepten/aaaaaaaa-0000-4000-8000-000000000003",
];

export default async function opwarmen() {
  if (process.env["GEEN_OPWARMEN"]) return;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await resetDemo();
    await meldAan(page);
    for (const pad of PADEN) {
      await page
        .goto(`${BASIS}${pad}`, { waitUntil: "networkidle", timeout: 120_000 })
        .catch(() => undefined);
    }
  } finally {
    await browser.close();
  }
}
