/**
 * Audit van profiel- en beheerschermen (alleen met AUDIT=1). Zelfde meting als audit-mobiel
 * (overlopen, scrollen, afkappen, doelen) plus axe (WCAG 2.2 A/AA, ernstig en kritiek).
 * Beheer draait als verzonnen eigenaar in de nep-Supabase — nooit tegen productie.
 * Resultaat: docs/foodloapp-v2/audit/<label>/pb-<variant>.json (+ schermafdrukken, lokaal).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { axeErnstig, meldAan, resetDemo, test, zetKlok } from "./helpers";
import { BEHEER_PADEN, EIGENAAR, seedEigenaar } from "./beheer-paden";
import { klaar, meet, type Bevinding } from "./audit-meten";

test.skip(!process.env["AUDIT"], "alleen met AUDIT=1");

const JAN = "22222222-2222-4222-8222-222222222222";

const PROFIEL: [string, string][] = [
  ["meer", "/meer"],
  ["instellingen", "/instellingen"],
  ["gezin", "/gezin"],
  ["vrienden", "/vrienden"],
  ["vriend", `/vrienden/${JAN}`],
  ["meldingen", "/meldingen"],
  ["credits", "/credits"],
  ["kaarten", "/kaarten"],
  ["feedback", "/feedback"],
  ["info", "/info"],
  ["privacy", "/privacy"],
  ["installeren", "/installeren"],
];
const BEHEER = BEHEER_PADEN;

const VARIANTEN = [
  { naam: "320", breedte: 320, schaal: 100 },
  { naam: "390", breedte: 390, schaal: 100 },
  { naam: "768", breedte: 768, schaal: 100 },
  { naam: "1280", breedte: 1280, schaal: 100 },
  { naam: "390-tekst130", breedte: 390, schaal: 130 },
];

for (const groep of ["profiel", "beheer"] as const)
  for (const v of VARIANTEN) {
    test(`audit ${groep} ${v.naam}`, async ({ page }) => {
      test.setTimeout(900_000);
      const map = `docs/foodloapp-v2/audit/${process.env["AUDIT_LABEL"] ?? "nu"}`;
      mkdirSync(map, { recursive: true });
      await resetDemo();
      if (groep === "beheer") await seedEigenaar();
      await zetKlok(page, 14);
      await meldAan(page, groep === "beheer" ? EIGENAAR : undefined);
      await page.setViewportSize({ width: v.breedte, height: v.breedte < 768 ? 844 : 900 });
      const uit: Record<string, Bevinding[]> = {};
      for (const [naam, pad] of groep === "beheer" ? BEHEER : PROFIEL) {
        await page.goto(pad);
        await klaar(page);
        if (v.schaal !== 100)
          await page.evaluate((s) => {
            document.documentElement.style.fontSize = `${s}%`;
          }, v.schaal);
        await page.waitForTimeout(300);
        const b = await meet(page);
        if (v.breedte === 390 && v.schaal === 100)
          for (const a of await axeErnstig(page).catch(() => [] as string[]))
            b.push({ soort: "axe", tekst: a });
        uit[naam] = b;
        if (v.breedte !== 768) await page.screenshot({ path: `${map}/pb-${v.naam}-${naam}.png` });
      }
      writeFileSync(`${map}/pb-${groep}-${v.naam}.json`, JSON.stringify(uit, null, 1));
    });
  }
