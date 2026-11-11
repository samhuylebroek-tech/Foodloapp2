/**
 * A-tot-Z productaudit per persona (alleen met AUDIT=1). Verkennend: elke stap wordt
 * vastgelegd als "geslaagd", "mislukt" (met foutmelding) of "ontbreekt" (functie niet gevonden),
 * met een schermafdruk. Een mislukte stap stopt de reis niet: het is een bevinding, geen
 * testfout. Echte klikken en typen in Chromium tegen de NEP-Supabase (geen RLS, geen realtime,
 * geen AI, geen opslag) — dus geen echt toestel en geen echte databank.
 * Uitvoer: docs/foodloapp-v2/audit/persona-az/<persona>.json + .png (lokaal, niet in git).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { Browser, Page } from "@playwright/test";
import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  kleineDoelen,
  meldAan,
  nepDb,
  resetDemo,
  resetNep,
  seedDb,
  storing,
  test,
  zetKlok,
} from "./helpers";
import { EIGENAAR } from "./beheer-paden";
import { klaar } from "./meetinstrument";

test.skip(!process.env["AUDIT"], "alleen met AUDIT=1");
test.describe.configure({ timeout: 600_000 });
// Verkennend: een knop die niet bestaat is een bevinding, geen reden om minuten te wachten.
test.use({ actionTimeout: 6_000, navigationTimeout: 30_000 });

const MAP = "docs/foodloapp-v2/audit/persona-az";
const DEMO = "11111111-1111-4111-8111-111111111111";
const JAN = "22222222-2222-4222-8222-222222222222";
const GEZIN = "abababab-0000-4000-8000-000000000001";
const NIEUW = "77777777-7777-4777-8777-777777777777";

type Stap = {
  stap: string;
  status: "geslaagd" | "mislukt" | "ontbreekt" | "info";
  detail?: string;
  foto?: string;
  zijscroll?: boolean;
  axe?: string[];
  klein?: number;
};

function reis(persona: string) {
  mkdirSync(MAP, { recursive: true });
  const stappen: Stap[] = [];
  let n = 0;
  const foto = async (page: Page, naam: string) => {
    const f = `${persona}-${String(++n).padStart(2, "0")}-${naam.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    await page.screenshot({ path: `${MAP}/${f}`, fullPage: false }).catch(() => undefined);
    return f;
  };
  return {
    /** Voert een stap uit; faalt die, dan wordt dat genoteerd en gaat de reis verder. */
    async stap(page: Page, naam: string, fn: () => Promise<string | void>, meet = true) {
      try {
        const detail = await fn();
        await klaar(page);
        const s: Stap = { stap: naam, status: "geslaagd", detail: detail || undefined };
        if (meet) {
          s.zijscroll = await heeftHorizontaleScroll(page);
          s.axe = await axeErnstig(page).catch(() => []);
          s.klein = (await kleineDoelen(page, 44).catch(() => [])).length;
        }
        s.foto = await foto(page, naam);
        stappen.push(s);
      } catch (e) {
        const detail = (e instanceof Error ? e.message : String(e)).split("\n")[0]!.slice(0, 300);
        stappen.push({ stap: naam, status: "mislukt", detail, foto: await foto(page, naam) });
      }
    },
    ontbreekt(naam: string, detail: string) {
      stappen.push({ stap: naam, status: "ontbreekt", detail });
    },
    info(naam: string, detail: string) {
      stappen.push({ stap: naam, status: "info", detail });
    },
    bewaar() {
      writeFileSync(`${MAP}/${persona}.json`, JSON.stringify(stappen, null, 2));
      console.log(
        `PERSONA-AZ|${persona}|` +
          ["geslaagd", "mislukt", "ontbreekt"]
            .map((s) => `${s}=${stappen.filter((x) => x.status === s).length}`)
            .join(" "),
      );
    },
  };
}

/** Zoekt of een tekst/knop ergens bestaat; "ontbreekt" als die er niet is. */
async function bestaat(page: Page, re: RegExp) {
  return (
    (await page.getByText(re).count()) + (await page.getByRole("button", { name: re }).count()) > 0
  );
}

const naar = (page: Page, label: string) =>
  page
    .getByRole("navigation")
    .getByRole("link", { name: new RegExp(`^${label}( \\(|$)`) })
    .first()
    .click();

async function nieuwePagina(browser: Browser, breedte: number, sub?: string) {
  const ctx = await browser.newContext({
    viewport: { width: breedte, height: 844 },
    hasTouch: true,
    isMobile: breedte < 500,
    locale: "nl-BE",
    timezoneId: "Europe/Brussels",
  });
  const page = await ctx.newPage();
  await page.route("**/*", (r) => {
    const h = new URL(r.request().url()).hostname;
    return h === "127.0.0.1" || h === "localhost" ? r.continue() : r.abort("blockedbyclient");
  });
  await zetKlok(page, 14);
  await meldAan(page, sub);
  return { ctx, page };
}

// ---------------------------------------------------------------- Persona A — jong, 390 px
test("persona A — jongvolwassene 18–25 (390 px)", async ({ page }) => {
  const r = reis("A-jong");
  await resetDemo();
  await page.setViewportSize({ width: 390, height: 844 });
  await zetKlok(page, 14);
  await meldAan(page);

  await r.stap(page, "Vandaag openen", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
  await r.stap(page, "Ontdek: inspiratie bekijken", async () => {
    await naar(page, "Ontdek");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    return `${await page.locator("a[href^='/inspiratie/']").count()} inspiratiekaarten`;
  });
  await r.stap(page, "Ontdek: een gerecht openen", async () => {
    await page.locator("a[href^='/inspiratie/']").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    return await page.getByRole("heading", { level: 1 }).innerText();
  });
  await r.stap(page, "Ontdek: bron of creator zichtbaar?", async () => {
    const creator = await bestaat(page, /volg|creator|door @|profiel van/i);
    if (!creator)
      throw new Error("geen creatornaam, profiel of volgknop bij een inspiratiegerecht");
  });
  await r.stap(page, "Ontdek: bewaren in eigen recepten", async () => {
    const knop = page
      .getByRole("button", { name: /bewaar|toevoegen|naar mijn recepten|opslaan/i })
      .first();
    await knop.click();
    return await knop.innerText().catch(() => "");
  });
  await r.stap(page, "Keuken: collecties", async () => {
    await naar(page, "Keuken");
    await expect(page.getByRole("heading", { name: "Collecties" })).toBeVisible();
  });
  await r.stap(page, "Eigen collectie maken", async () => {
    const k = page.getByRole("button", { name: /nieuwe collectie|collectie maken|map maken/i });
    if ((await k.count()) === 0) throw new Error("geen knop om zelf een collectie te maken");
  });
  await r.stap(page, "Recept delen", async () => {
    await page
      .getByRole("link", { name: /Spaghetti/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Delen" }).first().click();
    await klaar(page);
  });
  await page.keyboard.press("Escape");
  await r.stap(page, "Vrienden openen", async () => {
    await page.goto("/vrienden");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
  await r.stap(page, "Reageren / liken / sociale feed", async () => {
    await page.goto("/inspiratie");
    if (!(await bestaat(page, /reactie|like|vind ik leuk|commentaar/i)))
      throw new Error("geen reacties, likes of sociale feed");
  });
  r.bewaar();
});

// ---------------------------------------------------------------- Persona B — 70 jaar, 375 px, grote tekst
test("persona B — 70 jaar, weinig digitale ervaring (375 px, tekst 130 % en 200 %)", async ({
  page,
}) => {
  const r = reis("B-70");
  await resetDemo();
  await page.setViewportSize({ width: 375, height: 812 });
  await zetKlok(page, 14);
  await meldAan(page);
  const groot = (pct: number) =>
    page.evaluate((p) => {
      document.documentElement.style.fontSize = `${p}%`;
    }, pct);

  await r.stap(page, "Vandaag op 130 %", async () => {
    await page.goto("/");
    await groot(130);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
  await r.stap(page, "Vandaag op 200 %", async () => {
    await groot(200);
    await page.waitForTimeout(300);
  });
  await r.stap(page, "Recept zoeken: 'stoofvlees'", async () => {
    await naar(page, "Keuken");
    await groot(130);
    await page.getByLabel("Zoeken").fill("stoofvlees");
    await expect(page.getByText(/Stoofvlees/).first()).toBeVisible();
  });
  await r.stap(page, "Recept zoeken met tikfout: 'stofvlees'", async () => {
    await page.getByLabel("Zoeken").fill("stofvlees");
    await page.waitForTimeout(500);
    const gevonden = await page.getByRole("link", { name: /Stoofvlees/ }).count();
    if (!gevonden) throw new Error("tikfout geeft geen resultaat (geen fuzzy zoeken)");
  });
  await page.getByLabel("Zoeken").fill("stoofvlees");
  await r.stap(page, "Recept openen", async () => {
    await page
      .getByRole("link", { name: /Stoofvlees/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
  await r.stap(page, "Favoriet maken", async () => {
    await page.getByRole("button", { name: "Favoriet" }).first().click();
  });
  await r.stap(page, "Terug met de browserknop", async () => {
    await page.goBack();
    await expect(page.getByLabel("Zoeken")).toBeVisible();
  });
  await r.stap(page, "Lijst: iets afvinken en ongedaan maken", async () => {
    await naar(page, "Lijst");
    await page.getByRole("checkbox", { name: "melk als gekocht aanvinken" }).click();
    await page.getByRole("button", { name: "Ongedaan maken" }).first().click();
    await expect(page.getByRole("checkbox", { name: "melk als gekocht aanvinken" })).toBeVisible();
  });
  await r.stap(page, "Nieuw recept zonder naam bewaren (foutmelding)", async () => {
    await page.goto("/recepten/nieuw");
    const zelf = page.getByRole("button", { name: /zelf (invullen|typen|invoeren)/i });
    if (await zelf.count()) await zelf.first().click();
    await page.getByRole("button", { name: "Bewaren", exact: true }).click();
    await page.waitForTimeout(600);
    const melding = await page
      .locator("[role=alert], [aria-invalid=true], [data-sonner-toast]")
      .count();
    if (!melding) throw new Error("geen zichtbare foutmelding bij leeg formulier");
    return `${melding} melding(en)`;
  });
  await r.stap(page, "Netwerkfout bij toevoegen aan lijst", async () => {
    await page.goto("/boodschappen");
    await storing({ pad: "/rest/v1/shopping_items", soort: "netwerk", methode: "POST", keer: 3 });
    const veld = page.getByRole("textbox").first();
    await veld.fill("appels");
    await veld.press("Enter");
    await page.waitForTimeout(1500);
    const toast = await page.locator("[data-sonner-toast]").allInnerTexts();
    return toast.join(" | ") || "geen melding zichtbaar";
  });
  await r.stap(page, "Hulp vinden (Meer → Rondleiding / Feedback)", async () => {
    await page.goto("/meer");
    await expect(page.getByText("Rondleiding")).toBeVisible();
  });
  r.bewaar();
});

// ---------------------------------------------------------------- Persona C — creator, desktop
test("persona C — food creator (1280 px)", async ({ page }) => {
  const r = reis("C-creator");
  await resetDemo();
  await page.setViewportSize({ width: 1280, height: 900 });
  await zetKlok(page, 14);
  await meldAan(page);

  await r.stap(page, "Profiel: naam, @handle en bio", async () => {
    await page.goto("/instellingen");
    const bio = await page.getByLabel(/bio|over mij|beschrijving/i).count();
    const handle = await page.getByText(/@|Foodlo-naam/).count();
    if (!bio) throw new Error(`geen bio-veld (handle/Foodlo-naam aanwezig: ${handle > 0})`);
  });
  await r.stap(page, "Recept zelf invoeren en bewaren", async () => {
    await page.goto("/recepten/nieuw");
    const zelf = page.getByRole("button", { name: /zelf (invullen|typen|invoeren)/i });
    if (await zelf.count()) await zelf.first().click();
    await page.getByLabel("Naam van het gerecht").fill("Shakshuka van de creator");
    await page
      .getByLabel(/Ingrediënten — één per regel/)
      .fill("4 eieren\n400 g tomaten\n1 ui\n1 tl komijn");
    await page
      .getByLabel(/Bereiding — één stap per regel/)
      .fill("Fruit de ui.\nVoeg tomaten toe.\nBreek de eieren erin.");
    await page.getByRole("button", { name: "Bewaren", exact: true }).click();
    const dlg = page.getByRole("dialog", { name: "Klopt alles?" });
    if (await dlg.isVisible().catch(() => false))
      await dlg.getByRole("button", { name: "Bewaren", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Shakshuka van de creator" }),
    ).toBeVisible();
  });
  await r.stap(page, "Recept publiceren / openbaar maken", async () => {
    if (!(await bestaat(page, /publiceer|openbaar|zichtbaar voor iedereen/i)))
      throw new Error("geen publicatie- of zichtbaarheidskeuze op een recept");
  });
  await r.stap(page, "Recept delen via link", async () => {
    await page.getByRole("button", { name: "Delen" }).first().click();
    return (await page.getByRole("dialog").allInnerTexts()).join(" ").slice(0, 200);
  });
  await page.keyboard.press("Escape");
  await r.stap(page, "Publiek creatorprofiel", async () => {
    await page.goto("/meer");
    if (!(await bestaat(page, /mijn creatorprofiel|publiek profiel|volgers/i)))
      throw new Error("geen publiek profiel, geen volgers");
  });
  await r.stap(page, "Exclusieve / betaalde content, memberships", async () => {
    if (!(await bestaat(page, /membership|abonnement|exclusief|premium/i)))
      throw new Error("niets voor exclusieve content, abonnementen of memberships");
  });
  await r.stap(page, "Creatorstatistieken", async () => {
    if (!(await bestaat(page, /statistiek|weergaven|bereik/i)))
      throw new Error("geen statistieken voor creators");
  });
  await r.stap(page, "Import via link (AI niet gekoppeld in demo)", async () => {
    await page.goto("/recepten/nieuw");
    const link = page.getByRole("button", { name: /Link plakken/ });
    await link.first().click();
    await page.getByLabel("Link naar het recept").fill("https://example.com/recept");
    await page
      .getByRole("button", { name: /inlezen|eruit halen/i })
      .first()
      .click();
    await page.waitForTimeout(3000);
    const melding = (await page.locator("[data-sonner-toast], [role=alert]").allInnerTexts()).join(
      " | ",
    );
    return melding || "geen melding zichtbaar na 3 s";
  });
  r.bewaar();
});

// ---------------------------------------------------------------- Persona D — gezin, 2 contexten
test("persona D — druk gezin, twee toestellen (412 px)", async ({ browser }) => {
  const r = reis("D-gezin");
  await resetDemo();
  // Gedeelde gezinslijst (Marie is eigenaar, Jan actief lid).
  const GLIJST = "99999999-9999-4999-8999-999999999999";
  await seedDb({
    shopping_lists: [
      {
        id: GLIJST,
        user_id: DEMO,
        group_id: GEZIN,
        name: "Gezin",
        created_at: "2026-11-02T10:00:00Z",
      },
    ],
    profiles: [{ id: JAN, display_name: "Jan", onboarding_klaar: true }],
  });
  const marie = await nieuwePagina(browser, 412);
  const jan = await nieuwePagina(browser, 412, JAN);

  await r.stap(marie.page, "Marie: gezin bekijken", async () => {
    await marie.page.goto("/gezin");
    await expect(marie.page.getByRole("heading", { level: 1 })).toBeVisible();
    return (await marie.page.locator("main").innerText()).slice(0, 200).replace(/\n/g, " · ");
  });
  await r.stap(marie.page, "Marie: iemand uitnodigen (formulier)", async () => {
    await marie.page.getByLabel("Naam, Foodlo-naam of e-mailadres").fill("oma@example.com");
    return "formulier ingevuld, niet verstuurd (geen e-mail in de demo)";
  });
  await r.stap(jan.page, "Jan: ziet de gezinslijst", async () => {
    await jan.page.goto("/boodschappen");
    await expect(jan.page.getByText(/gezin/i).first()).toBeVisible();
  });
  await r.stap(marie.page, "Marie: zet 'luiers' op de gezinslijst", async () => {
    await marie.page.goto("/boodschappen");
    const kies = marie.page.getByRole("button", { name: /Boodschappen|Gezin/ }).first();
    await kies.click().catch(() => undefined);
    const gezin = marie.page
      .getByRole("button", { name: /Gezin/ })
      .or(marie.page.getByRole("option", { name: /Gezin/ }));
    if (await gezin.count()) await gezin.first().click();
    const veld = marie.page.getByRole("textbox").first();
    await veld.fill("luiers");
    await veld.press("Enter");
    await expect
      .poll(async () =>
        ((await nepDb())["shopping_items"] ?? []).some(
          (i) => i["name"] === "luiers" && i["list_id"] === GLIJST,
        ),
      )
      .toBe(true);
  });
  await r.stap(jan.page, "Jan: ziet 'luiers' zonder te herladen (realtime)", async () => {
    await jan.page.waitForTimeout(3000);
    if (!(await jan.page.getByText("luiers").count()))
      throw new Error(
        "niet zichtbaar zonder herladen — realtime bestaat niet in de nep-Supabase (niet testbaar)",
      );
  });
  await r.stap(jan.page, "Jan: ziet 'luiers' na herladen", async () => {
    await jan.page.reload();
    await expect(jan.page.getByText("luiers").first()).toBeVisible();
  });
  await r.stap(jan.page, "Gelijktijdig: beiden vinken 'luiers' af", async () => {
    const cb = (p: Page) => p.getByRole("checkbox", { name: /luiers/ }).first();
    await marie.page.reload();
    await Promise.all([cb(marie.page).click(), cb(jan.page).click()]);
    await marie.page.waitForTimeout(1500);
    const rij = ((await nepDb())["shopping_items"] ?? []).filter((i) => i["name"] === "luiers");
    return `rijen: ${rij.length}, checked: ${rij.map((i) => i["checked"]).join(",")}`;
  });
  await r.stap(marie.page, "Weekmenu: wie kookt / taak toewijzen", async () => {
    await marie.page.goto("/planner");
    if (!(await bestaat(marie.page, /wie kookt|kok van de dag|toegewezen|taak/i)))
      throw new Error("geen manier om taken (koken, winkelen) aan een gezinslid toe te wijzen");
  });
  await r.stap(marie.page, "Voorkeuren per gezinslid (allergie, lust niet)", async () => {
    await marie.page.goto("/gezin");
    if (!(await bestaat(marie.page, /allergie|lust geen|voorkeur/i)))
      throw new Error("geen voorkeuren of allergieën per gezinslid");
  });
  r.info(
    "Rechten tussen gezinnen",
    "Niet testbaar: de nep-Supabase heeft geen RLS (elke sessie leest alles).",
  );
  await marie.ctx.close();
  await jan.ctx.close();
  r.bewaar();
});

// ---------------------------------------------------------------- Persona E — beginner, lege app, 360 px
test("persona E — alleenstaande beginner, lege app (360 px)", async ({ page }) => {
  const r = reis("E-beginner");
  await resetNep();
  await seedDb({ profiles: [{ id: NIEUW, display_name: "Sam", onboarding_klaar: false }] });
  await page.setViewportSize({ width: 360, height: 740 });
  await zetKlok(page, 14);
  await page.addInitScript(() => window.localStorage.removeItem("rondleiding-gezien"));
  await meldAan(page, NIEUW);

  await r.stap(page, "Eerste bezoek", async () => {
    await page.goto("/");
    await klaar(page);
    return `${page.url().replace(/^https?:\/\/[^/]+/, "")} — ${(await page.getByRole("heading", { level: 1 }).allInnerTexts()).join(" / ")}`;
  });
  await r.stap(page, "Onboarding (welkom)", async () => {
    await page.goto("/welkom");
    await expect(page.getByText(/Even snel instellen/)).toBeVisible();
  });
  await r.stap(page, "Onboarding: budget of kookniveau kiezen", async () => {
    if (!(await bestaat(page, /budget|goedkoop|beginner|kookniveau|ervaring/i)))
      throw new Error("onboarding vraagt geen budget of kookniveau");
  });
  await r.stap(page, "Onboarding overslaan", async () => {
    await page
      .getByRole("button", { name: /Overslaan/ })
      .first()
      .click();
    await klaar(page);
    return page.url().replace(/^https?:\/\/[^/]+/, "");
  });
  for (const [label, naam] of [
    ["Vandaag", "Lege Vandaag"],
    ["Week", "Lege Week"],
    ["Lijst", "Lege Lijst"],
    ["Keuken", "Lege Keuken"],
    ["Ontdek", "Leeg Ontdek"],
  ] as const)
    await r.stap(page, naam, async () => {
      await page.goto("/");
      await page.keyboard.press("Escape");
      await naar(page, label);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      return (await page.locator("main").innerText()).slice(0, 220).replace(/\n+/g, " · ");
    });
  await r.stap(page, "Voorraad: '6 eieren' toevoegen", async () => {
    await page.goto("/voorraad");
    await page.getByLabel("Nieuw product").fill("6 eieren");
    await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
    await expect.poll(async () => ((await nepDb())["pantry_items"] ?? []).length).toBe(1);
  });
  await r.stap(page, "Ongeldige invoer: '-5 kg rijst'", async () => {
    await page.getByLabel("Nieuw product").fill("-5 kg rijst");
    await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
    await page.waitForTimeout(800);
    const rij = ((await nepDb())["pantry_items"] ?? []).find((p) =>
      String(p["naam"]).includes("rijst"),
    );
    return rij
      ? `opgeslagen als ${rij["hoeveelheid"]} ${rij["eenheid"]} ${rij["naam"]}`
      : "niet opgeslagen";
  });
  await r.stap(page, "Goedkoop / budgetfilter in Keuken of Ontdek", async () => {
    await page.goto("/inspiratie");
    if (!(await bestaat(page, /budget|goedkoop|prijs|€/i)))
      throw new Error("geen budget- of prijsinformatie");
  });
  r.bewaar();
});

// ---------------------------------------------------------------- Persona E2 — porties en tekort (demo)
test("persona E — porties, tekort en dubbele actie (390 px)", async ({ page }) => {
  const r = reis("E-porties");
  await resetDemo();
  await page.setViewportSize({ width: 390, height: 844 });
  await zetKlok(page, 14);
  await meldAan(page);

  await r.stap(page, "Recept openen (Spaghetti)", async () => {
    await page.goto("/gerechten");
    await page
      .getByRole("link", { name: /Spaghetti/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
  await r.stap(page, "Porties naar 1 (hoeveelheden herschalen)", async () => {
    const min = page.getByRole("button", { name: /minder|porties omlaag|−|-/i }).first();
    for (let i = 0; i < 6; i++) await min.click().catch(() => undefined);
    return (
      (await page.locator("main").innerText()).match(/\d+ (portie|personen?)[^\n]*/i)?.[0] ??
      "portietekst niet gevonden"
    );
  });
  await r.stap(page, "Dubbel tikken op 'Zet op mijn lijst'", async () => {
    const voor = ((await nepDb())["shopping_items"] ?? []).length;
    const k = page.getByRole("button", { name: /op mijn lijst/i }).first();
    await k.dblclick();
    await page.waitForTimeout(1500);
    const dlg = page.getByRole("dialog");
    if (await dlg.count()) {
      const ok = dlg.getByRole("button", { name: /^Zet \d+ op mijn lijst$|Zet op mijn lijst/ });
      if (await ok.count()) await ok.first().dblclick();
      await page.waitForTimeout(1500);
    }
    const na = ((await nepDb())["shopping_items"] ?? []).length;
    const namen = ((await nepDb())["shopping_items"] ?? []).map((i) => String(i["name"]));
    const dubbel = namen.filter((x, i) => namen.indexOf(x) !== i);
    return `items ${voor} → ${na}; dubbele namen: ${[...new Set(dubbel)].join(", ") || "geen"}`;
  });
  r.bewaar();
});

// ---------------------------------------------------------------- Persona F — hobbykok, tablet
test("persona F — gepassioneerde hobbykok (768 en 1024 px)", async ({ page }) => {
  const r = reis("F-hobbykok");
  await resetDemo();
  await page.setViewportSize({ width: 768, height: 1024 });
  await zetKlok(page, 14);
  await meldAan(page);
  const lang =
    "Langzaam gegaarde lamsschouder met ras el hanout, geroosterde wortelen, granaatappel en muntyoghurt";
  const ingr = Array.from(
    { length: 35 },
    (_, i) => `${i + 1} g ingrediënt nummer ${i + 1} met een lange omschrijving`,
  ).join("\n");

  await r.stap(page, "Recept met lange titel en 35 ingrediënten bewaren", async () => {
    await page.goto("/recepten/nieuw");
    const zelf = page.getByRole("button", { name: /zelf (invullen|typen|invoeren)/i });
    if (await zelf.count()) await zelf.first().click();
    await page.getByLabel("Naam van het gerecht").fill(lang);
    await page.getByLabel(/Ingrediënten — één per regel/).fill(ingr);
    await page
      .getByLabel(/Bereiding — één stap per regel/)
      .fill(Array.from({ length: 12 }, (_, i) => `Stap ${i + 1}: doe iets zorgvuldig.`).join("\n"));
    await page.getByRole("button", { name: "Bewaren", exact: true }).click();
    const dlg = page.getByRole("dialog", { name: "Klopt alles?" });
    if (await dlg.isVisible().catch(() => false))
      await dlg.getByRole("button", { name: "Bewaren", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Langzaam gegaarde");
  });
  await r.stap(page, "Detail op 1024 px", async () => {
    await page.setViewportSize({ width: 1024, height: 768 });
  });
  await r.stap(page, "Recept bewerken", async () => {
    await page
      .getByRole("link", { name: /bewerk|aanpassen/i })
      .or(page.getByRole("button", { name: /bewerk|aanpassen/i }))
      .first()
      .click();
    await expect(page.getByLabel("Naam van het gerecht")).toBeVisible();
  });
  await r.stap(page, "Keuken: lange titel in de lijst", async () => {
    await page.goto("/gerechten");
    await expect(page.getByText(/Langzaam gegaarde/).first()).toBeVisible();
  });
  await r.stap(page, "Kookmodus op tablet", async () => {
    await page
      .getByText(/Langzaam gegaarde/)
      .first()
      .click();
    await page
      .getByRole("button", { name: "Start koken" })
      .or(page.getByRole("link", { name: /Start koken/ }))
      .first()
      .click();
    await page.getByRole("button", { name: "Begin met koken" }).click();
  });
  await r.stap(page, "Recept verwijderd terwijl het in het weekmenu staat", async () => {
    const db = await nepDb();
    const plan = (db["meal_plan"] ?? []).find((m) => m["recipe_id"]);
    if (!plan) return "geen geplande maaltijd gevonden";
    const rec = (db["recipes"] ?? []).find((x) => x["id"] === plan["recipe_id"]);
    await page.goto(`/recepten/${String(plan["recipe_id"])}`);
    page.once("dialog", (d) => void d.accept());
    const acties = page.getByRole("button", { name: /Acties voor|Meer|Verwijder/ }).first();
    await acties.click();
    const del = page
      .getByRole("button", { name: /Verwijder/i })
      .or(page.getByRole("menuitem", { name: /Verwijder/i }));
    await del.first().click();
    const bev = page
      .getByRole("alertdialog")
      .or(page.getByRole("dialog"))
      .getByRole("button", { name: /Verwijder/i });
    if (await bev.count()) await bev.first().click();
    await page.waitForTimeout(800);
    await page.goto("/planner");
    await klaar(page);
    return `verwijderd: ${String(rec?.["title"])}; nog zichtbaar in Week: ${(await page.getByText(String(rec?.["title"])).count()) > 0}`;
  });
  await r.stap(page, "Recept-import vanaf foto/handgeschreven", async () => {
    await page.goto("/recepten/nieuw");
    await expect(page.getByRole("button", { name: /Foto van recept/ })).toBeVisible();
    return "knop aanwezig; AI niet gekoppeld in demo → niet functioneel testbaar";
  });
  r.bewaar();
});

// ---------------------------------------------------------------- Account verwijderen
test("negatief — account verwijderen (390 px)", async ({ page }) => {
  const r = reis("Z-account");
  await resetDemo();
  await page.setViewportSize({ width: 390, height: 844 });
  await zetKlok(page, 14);
  await meldAan(page);
  await r.stap(page, "Instellingen → Account verwijderen", async () => {
    await page.goto("/instellingen");
    await page
      .getByRole("button", { name: /Account verwijderen/ })
      .first()
      .click();
    await expect(page.getByLabel("Typ VERWIJDER")).toBeVisible();
  });
  await r.stap(page, "Bevestigen met VERWIJDER", async () => {
    await page.getByLabel("Typ VERWIJDER").fill("VERWIJDER");
    await page.getByRole("button", { name: "Definitief verwijderen" }).click();
    await page.waitForTimeout(2500);
    const t = (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ");
    return `${page.url().replace(/^https?:\/\/[^/]+/, "")} — ${t || "geen melding"}`;
  });
  r.bewaar();
});

// ---------------------------------------------------------------- Beheer: rollen en rechten
test("beheer — rollen, rechten en financiële afscherming", async ({ browser }) => {
  const r = reis("Y-beheer-rollen");
  const rol = async (role: string, extra: Record<string, unknown> = {}, sub = EIGENAAR) => {
    // Per rol een verse nep-db met precies één beheerdersrij.
    await resetDemo();
    await seedDb({
      admin_users: [
        {
          user_id: sub,
          role,
          active: true,
          can_view_private_content: false,
          note: "",
          read_only: false,
          mfa_required: false,
          ...extra,
        },
      ],
      profiles: [{ id: sub, display_name: `Test ${role}`, onboarding_klaar: true }],
    });
    return nieuwePagina(browser, 1280, sub);
  };
  const zichtbaar = async (p: Page, pad: string) => {
    await p.goto(pad);
    await klaar(p);
    await p.waitForTimeout(1200);
    const tekst = await p
      .locator("main")
      .innerText()
      .catch(() => "");
    const geweigerd = /Geen toegang|heeft dit recht niet|alleen voor/i.test(tekst);
    return { geweigerd, tekst: tekst.slice(0, 160).replace(/\n+/g, " · ") };
  };

  // 1. Gewone gebruiker
  {
    await resetDemo();
    const { ctx, page } = await nieuwePagina(browser, 1280);
    await r.stap(
      page,
      "Gewone gebruiker opent /beheer/finance",
      async () => {
        const z = await zichtbaar(page, "/beheer/finance");
        if (!z.geweigerd && /Omzet/.test(z.tekst))
          throw new Error(`financiële cijfers zichtbaar: ${z.tekst}`);
        return z.tekst;
      },
      false,
    );
    await ctx.close();
  }
  // 2. Iemand anders dan de eigenaar, zelfs als super_admin in admin_users
  {
    const { ctx, page } = await rol("super_admin", {}, JAN);
    await r.stap(
      page,
      "Tweede beheerder (super_admin, niet de eigenaar) opent /beheer",
      async () => {
        const z = await zichtbaar(page, "/beheer");
        return `${z.geweigerd ? "GEWEIGERD" : "TOEGANG"} — ${z.tekst}`;
      },
      false,
    );
    await ctx.close();
  }
  // 3. Eigenaar met rol support → finance?
  for (const role of ["support", "content_manager", "analyst"]) {
    const { ctx, page } = await rol(role);
    await r.stap(
      page,
      `Rol ${role} opent Finance`,
      async () => {
        const z = await zichtbaar(page, "/beheer/finance");
        return `${z.geweigerd ? "GEWEIGERD" : "TOEGANG"} — ${z.tekst}`;
      },
      false,
    );
    await r.stap(
      page,
      `Rol ${role} opent Gebruikers`,
      async () => {
        const z = await zichtbaar(page, "/beheer/gebruikers");
        return `${z.geweigerd ? "GEWEIGERD" : "TOEGANG"} — ${z.tekst}`;
      },
      false,
    );
    await ctx.close();
  }
  // 4. MFA verplicht, sessie zonder 2e stap (aal1)
  {
    const { ctx, page } = await rol("super_admin", { mfa_required: true });
    await r.stap(
      page,
      "MFA verplicht, sessie aal1: Finance-cijfers",
      async () => {
        const z = await zichtbaar(page, "/beheer/finance");
        return `${/Omzet/.test(z.tekst) ? "CIJFERS ZICHTBAAR" : "geen cijfers"} — ${z.tekst}`;
      },
      false,
    );
    await ctx.close();
  }
  // 5. Schermen van het controlecentrum (eigenaar, super_admin) op 390 en 1280
  for (const breedte of [390, 1280]) {
    const { ctx, page } = await rol("super_admin");
    await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 });
    for (const pad of [
      "",
      "finance",
      "kosten",
      "credits",
      "gebruikers",
      "support",
      "systeem",
      "instellingen",
      "team",
      "groepen",
    ])
      await r.stap(page, `Beheer ${pad || "start"} op ${breedte} px`, async () => {
        await page.goto(`/beheer${pad ? `/${pad}` : ""}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        return (await page.locator("main").innerText()).slice(0, 260).replace(/\n+/g, " · ");
      });
    await ctx.close();
  }
  r.bewaar();
});
