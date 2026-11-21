/**
 * Directe API-aanroepen op serverfuncties, buiten de UI om. We nemen de echte aanroep op die het
 * Finance-scherm doet (als eigenaar) en spelen die opnieuw af met andere tokens:
 * geen token, gewone gebruiker, verlopen token, sessie zonder 2FA. Nep-Supabase, fictieve data.
 */
import type { APIRequestContext, Request } from "@playwright/test";
import { EIGENAAR } from "./beheer-paden";
import { MFA_AFDWINGEN } from "../../src/lib/mfa-beleid";
import { NEP_SUPABASE, expect, meldAan, resetDemo, seedDb, test, zetKlok } from "./helpers";

async function token(opties: Record<string, string> = {}) {
  const q = new URLSearchParams(opties).toString();
  const r = (await (await fetch(`${NEP_SUPABASE}/__token?${q}`)).json()) as { token: string };
  return r.token;
}

async function beheerder(mfa_required = false) {
  await resetDemo();
  await seedDb({
    admin_users: [
      {
        user_id: EIGENAAR,
        role: "super_admin",
        active: true,
        can_view_private_content: false,
        note: "",
        read_only: false,
        mfa_required,
      },
    ],
    profiles: [{ id: EIGENAAR, display_name: "Eigenaar (demo)", onboarding_klaar: true }],
  });
}

/** Neemt de serverfunctie-aanroep van het Finance-scherm op (die met de omzetcijfers). */
async function neemFinanceOp(page: import("@playwright/test").Page) {
  let opgenomen: Request | null = null;
  page.on("response", async (r) => {
    if (!r.url().includes("/_serverFn/")) return;
    const tekst = await r.text().catch(() => "");
    if (tekst.includes("omzetVorig")) opgenomen = r.request();
  });
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/finance");
  await expect(page.getByText("Betalingen niet gekoppeld")).toBeVisible();
  await expect.poll(() => opgenomen !== null).toBe(true);
  return opgenomen as unknown as Request;
}

async function speelAf(api: APIRequestContext, req: Request, auth: string | null) {
  const headers = { ...req.headers() };
  delete headers["authorization"];
  if (auth) headers["authorization"] = `Bearer ${auth}`;
  const r = await api.fetch(req.url(), {
    method: req.method(),
    headers,
    data: req.postData() ?? undefined,
  });
  return { status: r.status(), tekst: await r.text() };
}

test.describe.configure({ timeout: 90_000 });

test("directe aanroep: zonder token, gewone gebruiker, verlopen token → geen cijfers", async ({
  page,
  request,
  extern,
}) => {
  await beheerder();
  const req = await neemFinanceOp(page);

  // Positieve controle: hetzelfde verzoek met een geldig eigenaarstoken geeft de cijfers.
  const ok = await speelAf(request, req, await token({ sub: EIGENAAR }));
  expect(ok.tekst).toContain("omzetVorig");

  const geen = await speelAf(request, req, null);
  expect(geen.tekst).not.toContain("omzetVorig");
  expect(geen.tekst).toMatch(/Unauthorized/);

  const gewoon = await speelAf(request, req, await token());
  expect(gewoon.tekst).not.toContain("omzetVorig");
  expect(gewoon.tekst).toMatch(/Geen toegang/);

  const verlopen = await speelAf(request, req, await token({ sub: EIGENAAR, vervalt: "-60" }));
  expect(verlopen.tekst).not.toContain("omzetVorig");
  expect(verlopen.tekst).toMatch(/Unauthorized/);

  const vervalst = await speelAf(request, req, "a.b.c");
  expect(vervalst.tekst).not.toContain("omzetVorig");
  void extern;
});

test("2FA verplicht: met aal2 wel cijfers (controle)", async ({ page, request, extern }) => {
  await beheerder(true);
  const req = await neemFinanceOp(page);
  const r = await speelAf(request, req, await token({ sub: EIGENAAR, aal: "aal2" }));
  expect(r.tekst).toContain("omzetVorig");
  void extern;
});

test("2FA: sessie zonder 2e stap (aal1) volgt de schakelaar MFA_AFDWINGEN (BUG-095)", async ({
  page,
  request,
  extern,
}) => {
  // BUG-095 (fase 8): afdwingen wacht op het akkoord van de eigenaar op het herstelplan; zelf
  // aanzetten is een autorisatiewijziging (CLAUDE.md) en kan de eigenaar buitensluiten. Deze test
  // volgt de schakelaar in src/lib/mfa-beleid.ts, zonder test.fail/test.skip:
  // - UIT (nu): bewijst dat de schakelaar de ENIGE reden is dat aal1 cijfers krijgt (vaststelling);
  // - AAN: aal1 krijgt geen cijfers en de server meldt waarom.
  // De regel zelf (mfaOntbreekt) is met afdwingen = true getest in admin-rechten.test.ts.
  await beheerder(true);
  const req = await neemFinanceOp(page);
  const r = await speelAf(request, req, await token({ sub: EIGENAAR, aal: "aal1" }));
  if (MFA_AFDWINGEN) {
    expect(r.tekst).not.toContain("omzetVorig");
    expect(r.tekst).toContain("tweede stap");
  } else {
    test.info().annotations.push({
      type: "BUG-095",
      description: "2FA nog niet afgedwongen op de server (wacht op akkoord herstelplan)",
    });
    expect(r.tekst).toContain("omzetVorig");
  }
  void extern;
});
