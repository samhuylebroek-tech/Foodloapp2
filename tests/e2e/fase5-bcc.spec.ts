/**
 * Fase 5 — Business Control Center en partnerportaal in TESTMODUS (nep-Supabase, verzonnen data):
 * - aanvraag → BCC keurt goed → partner maakt campagne met testbudget → BCC keurt goed →
 *   vertoning en klik tellen (gesponsord_tel, alleen dagtotalen) → testfactuur bij de partner;
 * - omzet en makeruitbetaling kloppen met een abonnement uit fase 4; het centrale percentage
 *   verschuift alleen maker ↔ platform; "testuitbetaling vastleggen" betaalt niets uit;
 * - moderator ziet geen omzet (ook niet via de server); analist kan niets beslissen;
 * - gewone gebruiker komt niet in /beheer, ook niet met een directe aanvraag;
 * - partner A ziet nooit gegevens van partner B;
 * - teamuitnodiging zonder e-mail; het auditlog toont elke actie.
 */
import type { APIRequestContext, Page, Request } from "@playwright/test";
import { EIGENAAR } from "./beheer-paden";
import { MAKER_IDS } from "./demo-data.mjs";
import { expect, meldAan, NEP_SUPABASE, nepDb, resetDemo, seedDb, test, zetKlok } from "./helpers";

const IK = "11111111-1111-4111-8111-111111111111";
const ELS = "5a5a5a5a-0000-4000-8000-000000000001";
const HOEVE = "5b5b5b5b-0000-4000-8000-000000000001";
const KRUIDEN = "5b5b5b5b-0000-4000-8000-000000000002";
const DEMO_BETALING = "cacacaca-0000-4000-8000-000000000001";

function isoDag(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function patch(tabel: string, id: string, velden: Record<string, unknown>) {
  await fetch(`${NEP_SUPABASE}/rest/v1/${tabel}?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: "sb_secret_nep_alleen_lokaal", "content-type": "application/json" },
    body: JSON.stringify(velden),
  });
}

async function alsRol(role: string) {
  await seedDb({
    admin_users: [
      {
        user_id: EIGENAAR,
        role,
        active: true,
        can_view_private_content: false,
        note: "",
        read_only: false,
        mfa_required: false,
      },
    ],
    profiles: [{ id: EIGENAAR, display_name: "Eigenaar (demo)", onboarding_klaar: true }],
  });
}

async function nieuwePagina(page: Page, sub?: string) {
  const ctx = await page
    .context()
    .browser()!
    .newContext({
      baseURL: "http://127.0.0.1:4339",
      locale: "nl-BE",
      timezoneId: "Europe/Brussels",
      viewport: page.viewportSize() ?? { width: 412, height: 915 },
    });
  const p = await ctx.newPage();
  await zetKlok(p, 14);
  await meldAan(p, sub);
  return { p, ctx };
}

async function token(opties: Record<string, string> = {}) {
  const q = new URLSearchParams(opties).toString();
  return ((await (await fetch(`${NEP_SUPABASE}/__token?${q}`)).json()) as { token: string }).token;
}

/** Neemt de eerste serverfunctie-aanroep op waarvan het antwoord `merk` bevat. */
function neemOp(page: Page, merk: string) {
  const opname: { req: Request | null; tekst: string } = { req: null, tekst: "" };
  page.on("response", async (r) => {
    if (!r.url().includes("/_serverFn/") || opname.req) return;
    const tekst = await r.text().catch(() => "");
    if (tekst.includes(merk)) {
      opname.req = r.request();
      opname.tekst = tekst;
    }
  });
  return opname;
}

async function speelAf(
  api: APIRequestContext,
  req: Request,
  auth: string | null,
  body?: (b: string) => string,
) {
  const headers = { ...req.headers() };
  delete headers["authorization"];
  if (auth) headers["authorization"] = `Bearer ${auth}`;
  // Een aanvaller buiten de browser kan Origin vrij kiezen; de CSRF-controle houdt hem dus niet
  // tegen. Alleen de rolcontrole op de server mag beslissen.
  headers["origin"] = new URL(req.url()).origin;
  const ruw = req.postData() ?? undefined;
  const r = await api.fetch(req.url(), {
    method: req.method(),
    headers,
    data: ruw && body ? body(ruw) : ruw,
  });
  return r.text();
}

const db = () => nepDb();
const audit = async () => ((await db()).admin_audit_log ?? []).map((r) => String(r["action"]));

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await resetDemo();
  await zetKlok(page, 14);
});

test("aanvraag → BCC keurt goed → campagne met testbudget → BCC keurt goed → vertoning en klik tellen", async ({
  page,
  extern,
}) => {
  await alsRol("super_admin");

  // 1. Marie vraagt aan.
  await meldAan(page);
  await page.goto("/partner");
  const form = page.getByRole("form", { name: "Aanvraag partner worden" });
  await form.getByLabel("Naam van je organisatie").fill("Soepbar Marie");
  await form.getByLabel("Soort organisatie").selectOption("restaurant");
  await form.getByRole("button", { name: "Aanvraag versturen" }).click();
  await expect(page.getByText(/Je aanvraag voor Soepbar Marie is ontvangen/)).toBeVisible();

  // 2. Het team keurt goed en wijst de andere (verzonnen) aanvraag af met een reden.
  const team = await nieuwePagina(page, EIGENAAR);
  await team.p.goto("/beheer/partners");
  await expect(team.p.getByRole("button", { name: "Open (2)" })).toBeVisible();
  const mijn = team.p.getByRole("article", { name: "Aanvraag Soepbar Marie" });
  await expect(mijn.getByText("Restaurant")).toBeVisible();
  await mijn.getByRole("button", { name: "Aanvraag goedkeuren" }).click();
  await expect(team.p.getByText(/Aanvraag goedgekeurd/).first()).toBeVisible();
  const korenaar = team.p.getByRole("article", { name: "Aanvraag Bakkerij De Korenaar" });
  await korenaar.getByRole("button", { name: "Afwijzen…" }).click();
  await expect(korenaar.getByRole("button", { name: "Afwijzen bevestigen" })).toBeDisabled();
  await korenaar.getByLabel(/Reden van afwijzen/).fill("Graag eerst een website met https.");
  await korenaar.getByRole("button", { name: "Afwijzen bevestigen" }).click();
  await expect(team.p.getByText("Geen open aanvragen. Alles is behandeld.")).toBeVisible();
  const partner = (await db()).partners?.find((p) => p["naam"] === "Soepbar Marie");
  expect(partner?.["verificatie_status"]).toBe("geverifieerd");
  expect(
    (await db()).partner_leden?.find((l) => l["partner_id"] === partner?.["id"]),
  ).toMatchObject({ user_id: IK, rol: "eigenaar" });
  expect(
    (await db()).partner_aanvragen?.find((a) => a["bedrijfsnaam"] === "Bakkerij De Korenaar"),
  ).toMatchObject({ status: "geweigerd", beoordeling_reden: "Graag eerst een website met https." });

  // 3. Marie heeft nu een partneromgeving: alleen eigen campagnes (partner A ziet B nooit).
  await page.goto("/partner/campagnes");
  await expect(page.getByText("Jouw rol: Eigenaar")).toBeVisible();
  await expect(page.getByText("Nog geen campagnes.")).toBeVisible();
  await expect(page.getByText("Pompoen van bij ons")).toHaveCount(0);
  await expect(page.getByText("Kruiden voor de winter")).toHaveCount(0);
  await page.getByRole("button", { name: "Nieuwe campagne" }).click();
  const cf = page.getByRole("form", { name: "Nieuwe campagne" });
  await cf.getByLabel("Naam van de campagne").fill("Soepweken");
  await cf.getByLabel("Begint op").fill(isoDag(-15));
  await cf.getByLabel("Eindigt op").fill(isoDag(10));
  await cf.getByLabel(/Testbudget in euro/).fill("abc");
  await expect(cf.getByText(/Vul een bedrag in euro in/)).toBeVisible();
  await cf.getByLabel(/Testbudget in euro/).fill("150");
  await cf.getByRole("button", { name: "Campagne bewaren" }).click();
  const kaart = page.getByRole("article", { name: "Campagne Soepweken" });
  await expect(kaart.getByText(/Testbudget: €\s150,00/)).toBeVisible();
  await kaart.getByRole("link", { name: "Inhoud koppelen" }).click();
  const kf = page.getByRole("form", { name: "Inhoud koppelen" });
  await kf.getByLabel("Campagne").selectOption({ label: "Soepweken" });
  await kf
    .getByLabel("Recept", { exact: true })
    .selectOption({ label: "Wortelsoep met sinaasappel" });
  await kf.getByRole("button", { name: "Koppelen aan campagne" }).click();
  await expect(page.getByText("Recept: Wortelsoep met sinaasappel")).toBeVisible();
  await page.goto("/partner/campagnes");
  await kaart.getByRole("button", { name: "Indienen ter goedkeuring" }).click();
  await expect(kaart.getByText("Wacht op goedkeuring door Foodlo")).toBeVisible();

  // 4. Het team keurt de campagne goed in het BCC; testbudget → testfactuur.
  await team.p.goto("/beheer/campagnes");
  const wacht = team.p.getByRole("region", { name: /Wacht op goedkeuring \(1\)/ });
  const bcc = wacht.getByRole("article", { name: "Campagne Soepweken" });
  await expect(bcc.getByText("Soepbar Marie")).toBeVisible();
  await expect(bcc.getByText(/testbudget €\s150,00/)).toBeVisible();
  await bcc.getByRole("button", { name: "Campagne goedkeuren" }).click();
  await expect(team.p.getByText(/Campagne goedgekeurd\. Testfactuur TEST-/)).toBeVisible();
  const camp = (await db()).campagnes?.find((c) => c["naam"] === "Soepweken");
  expect(camp?.["status"]).toBe("goedgekeurd");
  expect((await db()).facturen?.find((f) => f["campagne_id"] === camp?.["id"])).toMatchObject({
    bedrag_cent: 15000,
    status: "open",
    test: true,
    partner_id: partner?.["id"],
  });

  // 5. Ontdek toont de campagne; vertoning en klik tellen (alleen dagtotalen, nooit wie).
  await page.goto("/inspiratie");
  const plek = page.getByRole("region", { name: "Gesponsord" });
  await expect(plek.getByText("In samenwerking met Soepbar Marie")).toBeVisible();
  const stat = async () =>
    ((await db()).gesponsord_statistiek ?? []).filter((s) => s["campagne_id"] === camp?.["id"]);
  await expect.poll(async () => (await stat())[0]?.["vertoningen"]).toBe(1);
  await page.reload();
  await expect(plek.getByText("In samenwerking met Soepbar Marie")).toBeVisible();
  await page.waitForTimeout(500);
  expect((await stat())[0]?.["vertoningen"], "één vertoning per dag per tabblad").toBe(1);
  await plek.getByRole("link", { name: /Wortelsoep met sinaasappel/ }).click();
  await expect.poll(async () => (await stat())[0]?.["klikken"]).toBe(1);
  expect(Object.keys((await stat())[0] ?? {}).sort()).toEqual(
    ["campagne_id", "dag", "id", "klikken", "vertoningen"].sort(),
  );

  // 6. Het BCC en de partner zien dezelfde cijfers.
  await team.p.reload();
  await expect(
    team.p.getByLabel("Cijfers van Soepweken").filter({ hasText: "1 vertoningen" }),
  ).toContainText("1 klikken · CTR 100 %");
  await page.goto("/partner/campagnes");
  await expect(page.getByLabel("Cijfers van Soepweken")).toContainText(
    "1 keer getoond · 1 keer bekeken",
  );
  await page.goto("/partner/abonnement");
  await expect(page.getByText(/Campagne «Soepweken»: testbudget/)).toBeVisible();
  await expect(page.getByText("testfactuur, niet te betalen")).toBeVisible();

  // 7. Het auditlog toont elke beheeractie, in gewone taal.
  await team.p.goto("/beheer/logboek");
  await expect(team.p.getByText("Partneraanvraag goedgekeurd")).toBeVisible();
  await expect(team.p.getByText("Partneraanvraag afgewezen")).toBeVisible();
  await expect(team.p.getByText("Campagne goedgekeurd", { exact: true })).toBeVisible();
  await expect(team.p.getByText("Eigenaar (demo)").first()).toBeVisible();
  await team.ctx.close();
  expect(await audit()).toEqual(
    expect.arrayContaining([
      "partner.aanvraag.goedgekeurd",
      "partner.aanvraag.geweigerd",
      "bcc.campagne.goedgekeurd",
    ]),
  );
  expect(extern).toEqual([]);
});

test("omzet en makeruitbetaling testmodus kloppen met een fase-4-abonnement", async ({
  page,
  extern,
}) => {
  await alsRol("super_admin");
  // De demobetaling (Jan → Chef Ahmed) in dezelfde maand als vandaag, zodat de som vast ligt.
  await patch("maker_betalingen", DEMO_BETALING, { created_at: new Date().toISOString() });

  // Marie abonneert zich in testmodus (fase 4).
  await meldAan(page);
  await page.goto("/makers/chef-ahmed");
  const blok = page.getByTestId("maker-abonneren");
  await blok.getByRole("button", { name: "Abonneren in testmodus" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Ja, abonneren (test)" }).click();
  await expect(blok.getByRole("status")).toContainText("Je bent abonnee (testmodus)");
  const betalingen = ((await db()).maker_betalingen ?? []).filter(
    (b) => b["creator_id"] === MAKER_IDS.ahmed,
  );
  expect(betalingen.map((b) => b["bedrag_cent"])).toEqual([399, 399]);

  const team = await nieuwePagina(page, EIGENAAR);
  await team.p.goto("/beheer/omzet");
  await expect(team.p.getByText(/Alle bedragen komen uit de testbetaalprovider/)).toBeVisible();
  const maand = new Date().toLocaleDateString("nl-BE", { month: "long", year: "numeric" });
  const rij = team.p.getByRole("row", { name: maand });
  // 2 × € 3,99 = € 7,98, waarvan btw 2 × € 0,69; geen partnerplannen of premium in deze maand.
  await expect(rij.getByRole("cell").nth(0)).toContainText(/€\s7,98\s\(2\)/);
  await expect(rij.getByRole("cell").nth(4)).toHaveText(/€\s7,98/);
  await expect(rij.getByRole("cell").nth(5)).toHaveText(/€\s1,38/);
  await expect(rij.getByRole("cell").nth(6)).toHaveText(/€\s6,60/);

  // Uitbetaling: per betaling btw 0,69, betaalkosten 0,31, platform 15 % = 0,50, maker 2,49.
  await team.p.goto("/beheer/uitbetalingen");
  const ahmed = team.p.getByRole("row", { name: "Chef Ahmed" });
  await expect(ahmed.getByRole("cell").nth(5)).toHaveText(/€\s4,98/);
  await expect(ahmed.getByRole("cell").nth(4)).toHaveText(/€\s1,00/);
  await expect(ahmed).toContainText("Zou uitbetaald worden");
  await expect(ahmed).toContainText("KYC niet gekoppeld");
  await expect(team.p.getByText(/Er wordt niets uitbetaald/)).toBeVisible();

  // Centraal percentage: 20 % → platform 0,66 en maker 2,33 per betaling.
  const pf = team.p.getByRole("form", { name: "Platformdeel wijzigen" });
  await pf.getByLabel(/Nieuw platformdeel/).fill("60");
  await expect(pf.getByText(/tussen 0 en 50/)).toBeVisible();
  await expect(pf.getByRole("button", { name: "Platformdeel bewaren" })).toBeDisabled();
  await pf.getByLabel(/Nieuw platformdeel/).fill("20");
  await pf.getByRole("button", { name: "Platformdeel bewaren" }).click();
  await expect(team.p.getByText(/Platformdeel staat nu op 20 %/)).toBeVisible();
  await expect(ahmed.getByRole("cell").nth(5)).toHaveText(/€\s4,66/);
  await expect(ahmed.getByRole("cell").nth(4)).toHaveText(/€\s1,32/);

  await team.p.getByRole("button", { name: "Testuitbetaling vastleggen…" }).click();
  await team.p.getByRole("button", { name: "Ja, vastleggen (test)" }).click();
  await expect(team.p.getByText(/Testuitbetaling vastgelegd voor 1 maker/)).toBeVisible();
  const vast = (await db()).maker_uitbetalingen ?? [];
  expect(vast).toHaveLength(1);
  expect(vast[0]).toMatchObject({
    creator_id: MAKER_IDS.ahmed,
    maker_cent: 466,
    platform_cent: 132,
    status: "zou_uitbetaald_worden",
    kyc: "niet_gekoppeld",
    test: true,
  });
  expect(await audit()).toEqual(
    expect.arrayContaining(["bcc.verdeling.gewijzigd", "bcc.uitbetaling.testrun"]),
  );
  await team.ctx.close();
  expect(extern).toEqual([]);
});

test("moderator ziet geen omzet of uitbetalingen, ook niet via de server; analist beslist niets", async ({
  page,
  extern,
}) => {
  await alsRol("content_manager");
  const omzet = neemOp(page, "Je rol heeft dit recht niet");
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/omzet");
  await expect(page.getByText("Je rol heeft dit recht niet.")).toBeVisible();
  await expect(page.getByText("Per maand", { exact: true })).toHaveCount(0);
  await expect.poll(() => omzet.tekst).toMatch(/Je rol heeft dit recht niet/);
  expect(omzet.tekst).not.toContain("maanden");
  await page.goto("/beheer/uitbetalingen");
  await expect(page.getByText("Je rol heeft dit recht niet.")).toBeVisible();
  await expect(
    page.locator('a[href="/beheer/omzet"], a[href="/beheer/uitbetalingen"]'),
  ).toHaveCount(0);
  // Wel: partneraanvragen beoordelen.
  await page.goto("/beheer/partners");
  await expect(
    page
      .getByRole("article", { name: "Aanvraag Bakkerij De Korenaar" })
      .getByRole("button", { name: "Aanvraag goedkeuren" }),
  ).toBeVisible();

  // Analist: campagnes bekijken, niets beslissen of beëindigen.
  await resetDemo();
  await alsRol("analyst");
  await page.goto("/beheer/campagnes");
  const pompoen = page.getByRole("article", { name: "Campagne Pompoen van bij ons" });
  await expect(pompoen).toContainText("Boerderij Hoeve Groen");
  await expect(pompoen.getByRole("button")).toHaveCount(0);
  await page.goto("/beheer/partners");
  await expect(page.getByText("Je rol kan deze aanvraag bekijken, niet beslissen.")).toBeVisible();
  void extern;
});

test("gewone gebruiker komt niet in het BCC, ook niet met een directe aanvraag; partner A ziet B niet", async ({
  page,
  request,
  extern,
}) => {
  await alsRol("super_admin");
  // Opname van de echte aanvraag (als eigenaar) …
  const opname = neemOp(page, "Bakkerij De Korenaar");
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/partners");
  await expect(page.getByRole("article", { name: "Aanvraag Bakkerij De Korenaar" })).toBeVisible();
  await expect.poll(() => opname.req !== null).toBe(true);
  const req = opname.req as unknown as Request;
  expect(await speelAf(request, req, await token({ sub: EIGENAAR }))).toContain("Korenaar");
  // … opnieuw afgespeeld als gewone gebruiker, zonder token en met een vervalst token.
  const gewoon = await speelAf(request, req, await token());
  expect(gewoon).not.toContain("Korenaar");
  expect(gewoon).toMatch(/Geen toegang/);
  expect(await speelAf(request, req, null)).not.toContain("Korenaar");
  expect(await speelAf(request, req, "a.b.c")).not.toContain("Korenaar");

  // In de browser: een gewone gebruiker ziet "Geen toegang" op elk BCC-scherm.
  const marie = await nieuwePagina(page);
  for (const pad of [
    "/beheer/partners",
    "/beheer/omzet",
    "/beheer/uitbetalingen",
    "/beheer/team",
  ]) {
    await marie.p.goto(pad);
    await expect(marie.p.getByRole("heading", { name: "Geen toegang" })).toBeVisible();
  }
  await marie.ctx.close();

  // Partner A (Hoeve) vraagt de facturen van partner B (Kruiden) op met een aangepaste aanvraag.
  const els = await nieuwePagina(page, ELS);
  const abo = neemOp(els.p, "facturen");
  await els.p.goto("/partner/campagnes");
  await expect(els.p.getByText("Pompoen van bij ons")).toBeVisible();
  await expect(els.p.getByText("Kruiden voor de winter")).toHaveCount(0);
  await els.p.goto("/partner/abonnement");
  await expect.poll(() => abo.req !== null).toBe(true);
  const elsToken = await token({ sub: ELS });
  const vanB = await speelAf(request, abo.req as unknown as Request, elsToken, (b) =>
    b.replaceAll(HOEVE, KRUIDEN),
  );
  expect(vanB).toMatch(/Je bent geen lid van deze organisatie/);
  await els.ctx.close();

  // Teamuitnodiging in testmodus: geen e-mail, eigenaar kan je niet uitnodigen.
  await page.goto("/beheer/team");
  const uf = page.getByRole("form", { name: "Teamlid uitnodigen" });
  await expect(uf.getByLabel("Rol").locator("option")).toHaveText([
    /^Beheerder/,
    /^Moderator/,
    /^Analist/,
    /^Support/,
  ]);
  await uf.getByLabel("E-mailadres").fill("nieuw-teamlid@voorbeeld.test");
  await uf.getByLabel("Rol").selectOption("content_manager");
  await uf.getByRole("button", { name: "Uitnodiging klaarzetten (test)" }).click();
  await expect(page.getByText(/Er is geen e-mail verstuurd/).first()).toBeVisible();
  const lijst = page.getByRole("list", { name: "Uitnodigingen" });
  await expect(lijst).toContainText("nieuw-teamlid@voorbeeld.test");
  await expect(lijst).toContainText("Moderator");
  await uf.getByLabel("E-mailadres").fill("nieuw-teamlid@voorbeeld.test");
  await uf.getByRole("button", { name: "Uitnodiging klaarzetten (test)" }).click();
  await expect(uf.getByText("Voor dit adres staat al een uitnodiging klaar.")).toBeVisible();
  await lijst.getByRole("button", { name: "Intrekken" }).click();
  await expect(lijst).toContainText("ingetrokken");
  const rechten = page.getByRole("table", { name: "Wat elke rol mag per scherm" });
  await expect(rechten.getByRole("row", { name: /Omzet \(testmodus\)/ })).toContainText("Nee");
  const log = await audit();
  expect(log).toEqual(expect.arrayContaining(["bcc.team.uitgenodigd", "bcc.team.ingetrokken"]));
  // Het e-mailadres staat niet in het auditlog.
  expect(JSON.stringify((await db()).admin_audit_log)).not.toContain("nieuw-teamlid@");
  void extern;
});
