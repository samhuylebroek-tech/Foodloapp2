/**
 * Fase F: de volledige dagflow als persona, met toegankelijkheid bij elke stap.
 * - "Senior": thema "Extra duidelijk", tekst 200 %, 390 px, alleen toetsenbord voor de hoofdacties.
 * - "Avond": donker thema, 360 px.
 * Bij elke stap: geen ernstige axe-meldingen (WCAG 2.2 AA), niet opzij scrollen, precies één h1,
 * nieuwe kaarten met tikdoelen ≥ 44 px en een naam, en meldingen in een voorleesgebied (aria-live).
 * Chromium met axe: vervangt geen echte VoiceOver/TalkBack-test (TOEGANKELIJKHEID-PROTOCOL).
 */
import type { Locator, Page } from "@playwright/test";
import { DEMO_USER_ID } from "./demo-data.mjs";
import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  meldAan,
  resetDemo,
  test,
  voorraadBijhouden,
  zetKlok,
} from "./helpers";

const NEP = "http://127.0.0.1:54439/rest/v1";
const ZALM = "/recepten/aaaaaaaa-0000-4000-8000-000000000003";
const vandaag = () => new Date().toLocaleDateString("sv-SE");

type Persona = {
  naam: string;
  thema: "contrast" | "donker";
  tekst: number;
  breedte: number;
  toetsenbord: boolean;
};
const PERSONAS: Persona[] = [
  { naam: "senior", thema: "contrast", tekst: 200, breedte: 390, toetsenbord: true },
  { naam: "avond", thema: "donker", tekst: 100, breedte: 360, toetsenbord: false },
];

/** Tikdoelen in een nieuw onderdeel: minstens 44 × 44 px en een toegankelijke naam. */
async function doelenIn(gebied: Locator) {
  return gebied.evaluate((g) =>
    [...g.querySelectorAll<HTMLElement>("button, a[href], [role=button], [role=switch]")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const naam = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
        return { naam: naam.slice(0, 40), b: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((d) => !d.naam || d.b < 44 || d.h < 44)
      .map((d) => `"${d.naam}" ${d.b}×${d.h}`),
  );
}

async function controleer(page: Page, stap: string, gebieden: Locator[] = []) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const fouten: string[] = [];
  for (const a of await axeErnstig(page)) fouten.push(`${stap}: ${a}`);
  if (await heeftHorizontaleScroll(page)) fouten.push(`${stap}: scrolt opzij`);
  const h1 = await page.locator("h1:visible").count();
  if (h1 !== 1) fouten.push(`${stap}: ${h1}× h1`);
  for (const g of gebieden)
    for (const d of await doelenIn(g)) fouten.push(`${stap}: klein of naamloos ${d}`);
  return fouten;
}

/** Een melding (toast) moet in een voorleesgebied staan, zodat een schermlezer ze voorleest. */
async function meldingVoorgelezen(page: Page, tekst: RegExp) {
  const melding = page.getByText(tekst).first();
  await expect(melding).toBeVisible();
  return melding.evaluate((el) => !!el.closest("[aria-live], [role=status], [role=alert]"));
}

async function activeer(page: Page, knop: Locator, toetsenbord: boolean) {
  if (!toetsenbord) return knop.click();
  await knop.focus();
  await expect(knop).toBeFocused();
  await page.keyboard.press("Enter");
}

test.describe.configure({ timeout: 240_000 });

for (const p of PERSONAS)
  test(`dagflow ${p.naam}: Vandaag → restjes → Week → winkelen → koken → Keuken`, async ({
    page,
    extern,
  }) => {
    await resetDemo();
    await fetch(`${NEP}/meal_plan?plan_date=eq.${vandaag()}`, { method: "DELETE" });
    await fetch(`${NEP}/profiles?id=eq.${DEMO_USER_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thema: p.thema }),
    });
    await fetch(`${NEP}/pantry_items?naam=eq.rundvlees`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updated_at: new Date(Date.now() - 4 * 86400000).toISOString() }),
    });
    await meldAan(page);
    await voorraadBijhouden(page);
    await zetKlok(page, 17);
    await page.setViewportSize({ width: p.breedte, height: 800 });
    await page.addInitScript(
      ([id, thema, tekst]) => {
        window.localStorage.setItem("thema", thema);
        if (!window.localStorage.getItem(`foodlo:restjes:${id}`))
          window.localStorage.setItem(
            `foodlo:restjes:${id}`,
            JSON.stringify([
              {
                id: "r-1",
                titel: "Stoofvlees met frietjes",
                receptId: null,
                porties: 2,
                gekookt: Date.now() - 86400000,
              },
            ]),
          );
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.style.fontSize = `${tekst}%`;
        });
      },
      [DEMO_USER_ID, p.thema, String(p.tekst)] as const,
    );
    const fouten: string[] = [];

    // 1. Vandaag: niets gepland → restjes en voorstellen met "Gebruik eerst".
    await page.goto("/");
    const restjes = page.getByRole("region", { name: "Nog restjes" });
    const voorstellen = page.getByRole("region", { name: "Met wat je in huis hebt" });
    await expect(restjes).toBeVisible({ timeout: 30_000 });
    await expect(voorstellen.getByRole("note", { name: "Gebruik eerst" })).toBeVisible();
    fouten.push(...(await controleer(page, "vandaag", [restjes, voorstellen])));

    // 2. Restjes vanavond (toetsenbord voor de senior); de melding wordt voorgelezen.
    await activeer(
      page,
      restjes.getByRole("button", { name: "Eet vanavond restjes" }),
      p.toetsenbord,
    );
    if (!(await meldingVoorgelezen(page, /staan op vanavond/)))
      fouten.push("melding restjes niet voorgelezen");

    // 3. Week: "Vul aan" voor de lege dagen.
    await page.goto("/planner");
    await expect(page.getByRole("heading", { name: "Weekmenu" })).toBeVisible({ timeout: 60_000 });
    const vulAan = page.getByRole("region", { name: "Vul aan met voorstellen" });
    if (await vulAan.isVisible().catch(() => false)) {
      fouten.push(...(await controleer(page, "week", [vulAan])));
      await activeer(page, vulAan.getByRole("button", { name: /^Plan / }).first(), p.toetsenbord);
      if (!(await meldingVoorgelezen(page, /ingepland|staan op/)))
        fouten.push("melding week niet voorgelezen");
    } else fouten.push(...(await controleer(page, "week")));

    // 4. Lijst en winkelmodus met "Voor morgen nog nodig".
    await page.goto("/boodschappen");
    fouten.push(...(await controleer(page, "lijst")));
    await activeer(page, page.getByRole("button", { name: "Ik ga winkelen" }), p.toetsenbord);
    await expect(page.getByRole("button", { name: / niet gevonden$/ }).first()).toBeVisible();
    for (const a of await axeErnstig(page)) fouten.push(`winkelmodus: ${a}`);
    if (await heeftHorizontaleScroll(page)) fouten.push("winkelmodus: scrolt opzij");

    // 5. Koken tot het einde: "Blijft er iets over?".
    await page.goto(ZALM);
    await page.getByRole("button", { name: "Start koken" }).first().click();
    await page.getByRole("button", { name: "Begin met koken" }).click();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await activeer(page, page.getByRole("button", { name: "Klaar met koken" }), p.toetsenbord);
    const over = page.getByRole("group", { name: "Blijft er iets over?" });
    await expect(over).toBeVisible();
    for (const a of await axeErnstig(page)) fouten.push(`klaar met koken: ${a}`);
    for (const d of await doelenIn(over)) fouten.push(`klaar met koken: klein of naamloos ${d}`);
    await activeer(page, over.getByRole("button", { name: "2 porties" }), p.toetsenbord);
    if (!(await meldingVoorgelezen(page, /Restje bewaard/)))
      fouten.push("melding restje niet voorgelezen");

    // 6. Keuken: restjes en "Gebruik eerst".
    await page.goto("/voorraad");
    const lijst = page.getByRole("region", { name: "Restjes" });
    await expect(lijst).toContainText("Zalm met citroen en dille");
    fouten.push(...(await controleer(page, "keuken", [lijst])));

    // 7. Instellingen: de twee keuzes zijn schakelaars met een naam.
    await page.goto("/instellingen");
    await expect(page.getByRole("switch", { name: "Slimme voorstellen" })).toBeVisible();
    await expect(page.getByRole("switch", { name: /Ik houd mijn voorraad bij/ })).toBeVisible();
    fouten.push(...(await controleer(page, "instellingen")));

    expect(fouten).toEqual([]);
    void extern;
  });
