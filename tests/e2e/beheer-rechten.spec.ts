/**
 * Rechten in het Control Center (harde poort). Nep-Supabase, verzonnen eigenaar.
 * - Financiële cijfers alleen voor super_admin/admin, en de server weigert ook (BUG-091).
 * - Meldingenbeheer loopt via dezelfde bewaker als de rest (BUG-090).
 * - "Betalingen actief" kan niet aan zonder betaalprovider (BUG-094).
 */
import { expect, meldAan, resetDemo, seedDb, test, zetKlok } from "./helpers";
import { EIGENAAR } from "./beheer-paden";

async function alsRol(role: string) {
  await resetDemo();
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

test.describe.configure({ timeout: 90_000 });

test("super_admin ziet de financiële cijfers", async ({ page, extern }) => {
  await alsRol("super_admin");
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/finance");
  await expect(page.getByText("Betalingen niet gekoppeld")).toBeVisible();
  // BUG-099: eerlijke labels; demo-band zodat demogetallen nooit voor echt doorgaan.
  await expect(page.getByText("Omzet min AI-kosten").first()).toBeVisible();
  await expect(page.getByText(/Demogegevens: verzonnen testgegevens/)).toBeVisible();
  void extern;
});

test("BUG-098: zonder recht een duidelijke melding, geen lege tabel", async ({ page, extern }) => {
  await alsRol("analyst");
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/gebruikers");
  await expect(page.getByText("Je rol heeft dit recht niet.")).toBeVisible();
  await expect(page.getByText(/0 gebruikers/)).toHaveCount(0);
  void extern;
});

for (const rol of ["support", "analyst", "content_manager"])
  test(`${rol} krijgt geen financiële cijfers, ook niet via de server`, async ({
    page,
    extern,
  }) => {
    await alsRol(rol);
    await zetKlok(page, 14);
    await meldAan(page, EIGENAAR);
    await page.goto("/beheer/finance");
    await expect(page.getByText("Je rol heeft dit recht niet.")).toBeVisible();
    await expect(page.getByText("Betalingen niet gekoppeld")).toHaveCount(0);
    // Geen menulink naar financiële schermen (de groep "Finance" mag wel naar AI-gebruik wijzen).
    await expect(
      page.locator(
        'a[href="/beheer/finance"], a[href="/beheer/credits"], a[href="/beheer/kosten"]',
      ),
    ).toHaveCount(0);
    void extern;
  });

test("meldingenbeheer werkt voor de eigenaar via de bewaker", async ({ page, extern }) => {
  await alsRol("super_admin");
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/meldingen");
  await expect(page.getByText("Gebruikers met meldingen")).toBeVisible();
  void extern;
});

test("betalingen kunnen niet aan zonder betaalprovider", async ({ page, extern }) => {
  await alsRol("super_admin");
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/instellingen");
  const schakelaar = page.getByRole("switch", { name: "Betalingen actief" });
  await expect(schakelaar).toBeDisabled();
  await expect(page.getByText(/Kan pas aan als er een betaalprovider gekoppeld is/)).toBeVisible();
  void extern;
});
