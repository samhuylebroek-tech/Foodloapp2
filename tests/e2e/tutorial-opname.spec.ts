/**
 * Tutorialopnames (alleen met OPNAME=1): per tutorial een stille video van de demo-app met
 * ondertitels in beeld, plus het .vtt-bestand ernaast. Verzonnen gegevens, alles lokaal, geen
 * betaalde dienst, geen stem. Er wordt niets aangeklikt: de echte knoppen worden aangewezen.
 *
 *   OPNAME=1 npx playwright test tutorial-opname --project=telefoon
 * Uitvoer: tests/e2e/.opnames/<slug>.webm en <slug>.nl.vtt (niet in git).
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARTIKELS } from "../../src/lib/hulp/artikels";
import { maakTutorial, naarWebVtt } from "../../src/lib/hulp/tutorials";
import { expect, meldAan, resetDemo, test, zetKlok } from "./helpers";

const UIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".opnames");
const KEUZE = process.env["OPNAME_SLUGS"]?.split(",");

test.skip(!process.env["OPNAME"], "Alleen op aanvraag (OPNAME=1)");
test.describe.configure({ timeout: 180_000 });

for (const a of ARTIKELS) {
  const tut = maakTutorial(a);
  if (!tut || (KEUZE && !KEUZE.includes(a.slug))) continue;
  test(`opname: ${tut.slug}`, async ({ browser, extern }, info) => {
    mkdirSync(UIT, { recursive: true });
    const ctx = await browser.newContext({
      ...info.project.use,
      recordVideo: { dir: UIT, size: { width: 412, height: 860 } },
      viewport: { width: 412, height: 860 },
    });
    const page = await ctx.newPage();
    await page.route(/^(?!http:\/\/(127\.0\.0\.1|localhost)).*/, (r) => r.abort());
    await resetDemo();
    await zetKlok(page, 14);
    await meldAan(page);
    await page.goto(tut.route);
    await page.waitForLoadState("networkidle");
    for (const s of tut.scenes) {
      const knoppen = [...s.tekst.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
      await page.evaluate(
        ({ tekst, knoppen }) => {
          document.querySelectorAll("[data-opname]").forEach((e) => e.remove());
          document.querySelectorAll("[data-opname-doel]").forEach((e) => {
            (e as HTMLElement).style.outline = "";
            e.removeAttribute("data-opname-doel");
          });
          const band = document.createElement("div");
          band.setAttribute("data-opname", "");
          band.textContent = tekst;
          Object.assign(band.style, {
            position: "fixed", left: "12px", right: "12px", bottom: "24px", zIndex: "99999",
            background: "rgba(15,23,42,.88)", color: "#fff", padding: "12px 14px",
            borderRadius: "14px", font: "600 17px/1.4 system-ui, sans-serif",
          });
          document.body.appendChild(band);
          for (const k of knoppen) {
            const el = [...document.querySelectorAll<HTMLElement>("button, a, label, h1, h2, input")].find(
              (e) => (e.getAttribute("aria-label") ?? e.textContent ?? "").includes(k),
            );
            if (el) {
              el.setAttribute("data-opname-doel", "");
              el.style.outline = "4px solid #f59e0b";
              el.scrollIntoView({ block: "center" });
            }
          }
        },
        { tekst: s.tekst, knoppen },
      );
      await page.waitForTimeout((s.eind - s.start) * 1000);
    }
    const video = page.video();
    await ctx.close();
    const bron = await video!.path();
    renameSync(bron, path.join(UIT, `${tut.slug}.webm`));
    writeFileSync(path.join(UIT, `${tut.slug}.nl.vtt`), naarWebVtt(tut));
    expect(tut.scenes.length).toBeGreaterThan(1);
    void extern;
  });
}
