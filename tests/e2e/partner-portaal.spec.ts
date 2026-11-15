/**
 * Partnerportaal (voorstel 0011, alleen nep-Supabase met verzonnen partners):
 * - zonder partnerrol: uitleg + aanvraagformulier (rij in partner_aanvragen);
 * - partner maakt product en campagne, koppelt een recept en dient in; het Foodlo-team keurt goed
 *   in /beheer/moderatie; het item verschijnt gelabeld op de ene gesponsorde plek in Ontdek;
 * - analist ziet alleen-lezen; rapportage toont alleen dagtotalen, gemarkeerd als demogegevens;
 * - een allergie verbergt de gesponsorde plek (dezelfde regel als voorstellen).
 */
import type { Page } from "@playwright/test";
import { expect, meldAan, NEP_SUPABASE, nepDb, resetDemo, seedDb, test, zetKlok } from "./helpers";
import { EIGENAAR } from "./beheer-paden";

const IK = "11111111-1111-4111-8111-111111111111";
const ELS = "5a5a5a5a-0000-4000-8000-000000000001";
const TOM = "5a5a5a5a-0000-4000-8000-000000000002";
const HERFST = "5c5c5c5c-0000-4000-8000-000000000001";

function isoDag(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Zet een rij rechtstreeks in de nep-databank (zoals de server met de beheersleutel). */
async function patch(tabel: string, id: string, velden: Record<string, unknown>) {
  await fetch(`${NEP_SUPABASE}/rest/v1/${tabel}?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: "sb_secret_nep_alleen_lokaal", "content-type": "application/json" },
    body: JSON.stringify(velden),
  });
}

async function nieuwePagina(page: Page, sub?: string) {
  const ctx = await page
    .context()
    .browser()!
    .newContext({
      baseURL: "http://127.0.0.1:4339",
      locale: "nl-BE",
      viewport: page.viewportSize() ?? { width: 412, height: 915 },
    });
  const p = await ctx.newPage();
  await meldAan(p, sub);
  return { p, ctx };
}

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async () => {
  await resetDemo();
});

test("zonder partnerrol: uitleg en aanvraag versturen", async ({ page, extern }) => {
  await meldAan(page);
  await page.goto("/partner");
  await expect(page.getByText("Je account heeft nog geen partnerrol.")).toBeVisible();
  // Geen partnermenu en geen consumentenonderbalk.
  await expect(page.getByRole("navigation", { name: "Partnermenu" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Producten" })).toHaveCount(0);
  const form = page.getByRole("form", { name: "Aanvraag partner worden" });
  await expect(form.getByRole("button", { name: "Aanvraag versturen" })).toBeDisabled();
  await form.getByLabel("Naam van je organisatie").fill("Bakkerij De Test");
  await form.getByLabel("Soort organisatie").selectOption("retail");
  await form.getByLabel(/Website/).fill("bakkerij.example");
  await form.getByRole("button", { name: "Aanvraag versturen" }).click();
  await expect(page.getByText(/Je aanvraag voor Bakkerij De Test is ontvangen/)).toBeVisible();
  const aanvragen = (await nepDb()).partner_aanvragen ?? [];
  expect(aanvragen.map((a) => [a["user_id"], a["bedrijfsnaam"], a["soort"], a["status"]])).toEqual([
    [IK, "Bakkerij De Test", "retail", "nieuw"],
  ]);
  void extern;
});

test("partner maakt product en campagne, team keurt goed, gelabeld in Ontdek", async ({
  page,
  extern,
}) => {
  // De demo-campagne uitzetten, zodat de nieuwe campagne de enige gesponsorde plek krijgt.
  await patch("campagnes", HERFST, { status: "afgelopen" });
  await seedDb({
    admin_users: [
      {
        user_id: EIGENAAR,
        role: "content_manager",
        active: true,
        can_view_private_content: false,
        note: "",
        read_only: false,
        mfa_required: false,
      },
    ],
    profiles: [{ id: EIGENAAR, display_name: "Eigenaar (demo)", onboarding_klaar: true }],
  });

  await meldAan(page, ELS);
  await page.goto("/partner");
  await expect(page.getByText("Boerderij Hoeve Groen").first()).toBeVisible();
  await expect(page.getByText("Jouw rol: Eigenaar")).toBeVisible();
  // Overzicht met echte tellingen uit de tabellen.
  await expect(page.getByRole("link", { name: /Producten\s*2/ })).toBeVisible();

  // Product toevoegen met ingrediëntkoppeling.
  await page
    .getByRole("navigation", { name: "Partnermenu" })
    .getByRole("link", { name: "Producten" })
    .click();
  await page.getByRole("button", { name: "Product toevoegen" }).click();
  const pf = page.getByRole("form", { name: "Nieuw product" });
  await pf.getByLabel("Productnaam").fill("Wortelen van de hoeve");
  await pf.getByLabel("Hoort bij ingrediënt").fill("Wortelen");
  await pf.getByLabel(/EAN-code/).fill("123");
  await expect(pf.getByText(/8, 12, 13 of 14 cijfers/)).toBeVisible();
  await pf.getByLabel(/EAN-code/).fill("5412345000020");
  await pf.getByRole("button", { name: "Product bewaren" }).click();
  await expect(page.getByText("Hoort bij: wortelen · EAN 5412345000020")).toBeVisible();

  // Campagne aanmaken.
  await page
    .getByRole("navigation", { name: "Partnermenu" })
    .getByRole("link", { name: "Campagnes" })
    .click();
  await page.getByRole("button", { name: "Nieuwe campagne" }).click();
  const cf = page.getByRole("form", { name: "Nieuwe campagne" });
  await cf.getByLabel("Naam van de campagne").fill("Wortelweken");
  await cf.getByLabel("Begint op").fill(isoDag(-1));
  await cf.getByLabel("Eindigt op").fill(isoDag(14));
  await cf.getByRole("button", { name: "Campagne bewaren" }).click();
  const kaart = page.getByRole("article", { name: "Campagne Wortelweken" });
  await expect(kaart.getByText("Concept")).toBeVisible();
  // Indienen kan pas met gekoppelde inhoud.
  await expect(kaart.getByRole("button", { name: "Indienen ter goedkeuring" })).toBeDisabled();
  await expect(
    kaart.getByText("Koppel eerst een recept of product aan de campagne."),
  ).toBeVisible();

  // Recept koppelen.
  await kaart.getByRole("link", { name: "Inhoud koppelen" }).click();
  const kf = page.getByRole("form", { name: "Inhoud koppelen" });
  await expect(kf.getByLabel("Campagne")).toHaveValue(/.+/);
  await kf.getByLabel("Campagne").selectOption({ label: "Wortelweken" });
  await kf
    .getByLabel("Recept", { exact: true })
    .selectOption({ label: "Wortelsoep met sinaasappel" });
  await kf.getByRole("button", { name: "Koppelen aan campagne" }).click();
  await expect(page.getByText("Recept: Wortelsoep met sinaasappel")).toBeVisible();

  // Indienen.
  await page
    .getByRole("navigation", { name: "Partnermenu" })
    .getByRole("link", { name: "Campagnes" })
    .click();
  await kaart.getByRole("button", { name: "Indienen ter goedkeuring" }).click();
  await expect(kaart.getByText("Wacht op goedkeuring door Foodlo")).toBeVisible();

  // Vóór goedkeuring: niets in Ontdek.
  const marie = await nieuwePagina(page);
  await marie.p.goto("/inspiratie");
  await expect(marie.p.getByRole("heading", { name: "Makers om te volgen" })).toBeVisible();
  await expect(marie.p.getByText(/In samenwerking met/)).toHaveCount(0);

  // Het Foodlo-team keurt goed.
  const team = await nieuwePagina(page, EIGENAAR);
  await zetKlok(team.p, 14);
  await team.p.goto("/beheer/moderatie");
  const ingediend = team.p.getByRole("article", { name: "Campagne Wortelweken" });
  await expect(
    ingediend.getByText(/Recept: Wortelsoep met sinaasappel — label “Gesponsord”/),
  ).toBeVisible();
  await ingediend.getByRole("button", { name: "Campagne goedkeuren" }).click();
  await expect(team.p.getByText("Campagne goedgekeurd.")).toBeVisible();
  await team.ctx.close();

  // Nu gelabeld op de ene vaste plek in Ontdek, niet tussen de ideeën.
  await marie.p.reload();
  const plek = marie.p.getByRole("region", { name: "Gesponsord" });
  await expect(plek.getByText("In samenwerking met Boerderij Hoeve Groen")).toBeVisible();
  await expect(plek.locator("span", { hasText: /^Gesponsord$/ })).toBeVisible();
  await expect(plek.getByRole("link", { name: /Wortelsoep met sinaasappel/ })).toBeVisible();
  await expect(marie.p.getByText(/In samenwerking met/)).toHaveCount(1);
  await expect(
    marie.p.getByRole("list", { name: "Alle ideeën" }).getByText("Wortelsoep met sinaasappel"),
  ).toHaveCount(0);
  await marie.ctx.close();

  const db = await nepDb();
  expect(db.campagnes?.find((c) => c["naam"] === "Wortelweken")?.["status"]).toBe("goedgekeurd");
  expect(db.admin_audit_log?.some((r) => r["action"] === "moderatie.campagne.goedgekeurd")).toBe(
    true,
  );
  void extern;
});

test("analist: alleen lezen, rapportage met alleen dagtotalen (demogegevens)", async ({
  page,
  extern,
}) => {
  await meldAan(page, TOM);
  await page.goto("/partner/producten");
  await expect(page.getByText("Jouw rol: Analist")).toBeVisible();
  await expect(page.getByText("Butternut van Hoeve Groen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Product toevoegen" })).toHaveCount(0);
  await expect(page.getByText(/Je rol mag producten niet wijzigen/)).toBeVisible();

  await page.goto("/partner/rapportage");
  await expect(
    page.getByText("Demogegevens: verzonnen dagtotalen, geen echte cijfers."),
  ).toBeVisible();
  await expect(page.getByText("6.570")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  // Geen enkele gebruikersnaam of -id in de rapportage.
  await expect(page.getByRole("main")).not.toContainText(/Marie|11111111/);

  await page.goto("/partner/team");
  await expect(page.getByText("Els Van Hoeve")).toBeVisible();
  await expect(page.getByLabel(/Rol van/)).toHaveCount(0);
  void extern;
});

test("met een melkallergie geen gesponsorde pompoen met feta in Ontdek", async ({
  page,
  extern,
}) => {
  await meldAan(page);
  await page.goto("/inspiratie");
  await expect(page.getByText("In samenwerking met Boerderij Hoeve Groen")).toBeVisible();

  const ander = await nieuwePagina(page);
  await ander.p.addInitScript(
    ([id, waarde]) => window.localStorage.setItem(`foodlo:kennismaking:${id}`, waarde!),
    [IK, JSON.stringify({ allergieen: ["melk"] })] as const,
  );
  await ander.p.goto("/inspiratie");
  await expect(ander.p.getByRole("heading", { name: "Makers om te volgen" })).toBeVisible();
  await expect(ander.p.getByText(/In samenwerking met/)).toHaveCount(0);
  await ander.ctx.close();
  void extern;
});
