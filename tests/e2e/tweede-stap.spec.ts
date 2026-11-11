/**
 * 2-staps verificatie bij een volgende aanmelding (BUG-095, 2FA-HERSTELPLAN §2–§3).
 * Een beheerder met een gekoppelde authenticator en een sessie zonder tweede stap (aal1)
 * kan in het Control Center de 6-cijferige code ingeven en krijgt dan een aal2-sessie.
 * Nep-Supabase (code 123456 is juist), verzonnen beheerder. Afdwingen staat UIT.
 */
import { EIGENAAR } from "./beheer-paden";
import { expect, meldAan, nepLog, resetDemo, seedDb, test, zetKlok } from "./helpers";

async function beheerderMetFactoren(
  factoren: { id: string; status: string; friendly_name: string }[],
) {
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
        mfa_required: true,
      },
    ],
    profiles: [{ id: EIGENAAR, display_name: "Eigenaar (demo)", onboarding_klaar: true }],
    __factoren: factoren.map((f) => ({ ...f, user_id: EIGENAAR, factor_type: "totp" })),
  });
}

test.describe.configure({ timeout: 90_000 });

test("met authenticator: foute code geeft uitleg, juiste code geeft aal2", async ({
  page,
  extern,
}) => {
  await beheerderMetFactoren([
    { id: "factor-telefoon", status: "verified", friendly_name: "Telefoon" },
  ]);
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/finance");
  const stap = page.getByRole("region", { name: /2-staps verificatie is verplicht/ });
  await expect(stap).toBeVisible();
  const veld = stap.getByLabel("Code uit je authenticator-app");
  await expect(veld).toHaveAttribute("autocomplete", "one-time-code");
  await expect(veld).toHaveAttribute("inputmode", "numeric");

  // Te kort: geen verzoek, wel uitleg.
  await veld.fill("123");
  await stap.getByRole("button", { name: "Bevestigen" }).click();
  await expect(stap.getByRole("alert")).toHaveText("Typ de 6 cijfers uit je authenticator-app.");

  // Fout: Nederlandse uitleg, geen Engelse ruwe fout.
  await veld.fill("000 000");
  await stap.getByRole("button", { name: "Bevestigen" }).click();
  await expect(stap.getByRole("alert")).toContainText("Die code klopt niet");
  await expect(page.getByText(/Invalid TOTP/)).toHaveCount(0);

  // Juist (met spatie): sessie wordt aal2, de melding verdwijnt.
  await veld.fill("123 456");
  await stap.getByRole("button", { name: "Bevestigen" }).click();
  await expect(page.getByText("Bevestigd in 2 stappen")).toBeVisible();
  await expect(stap).toHaveCount(0);
  const verify = (await nepLog()).filter((l) => /\/auth\/v1\/factors\/.+\/verify$/.test(l.path));
  expect(verify.length).toBe(2);
  void extern;
});

test("zonder authenticator: verwijst naar instellen, geen invoerveld", async ({ page, extern }) => {
  await beheerderMetFactoren([]);
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/finance");
  const stap = page.getByRole("region", { name: /2-staps verificatie is verplicht/ });
  await expect(stap.getByRole("link", { name: "Nu instellen" })).toBeVisible();
  await expect(stap.getByLabel("Code uit je authenticator-app")).toHaveCount(0);
  void extern;
});

test("laatste authenticator verwijderen vraagt eerst bevestiging met duidelijke waarschuwing", async ({
  page,
  extern,
}) => {
  await beheerderMetFactoren([
    { id: "factor-telefoon", status: "verified", friendly_name: "Telefoon" },
  ]);
  await zetKlok(page, 14);
  await meldAan(page, EIGENAAR);
  await page.goto("/beheer/beveiliging");
  await expect(page.getByText("Telefoon · actief")).toBeVisible();
  await expect(page.getByText(/reserve-authenticator/).first()).toBeVisible();
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  const vraag = page.getByRole("alertdialog", { name: "Authenticator verwijderen?" });
  await expect(vraag).toContainText("laatste authenticator");
  await vraag.getByRole("button", { name: "Annuleren" }).click();
  await expect(vraag).toHaveCount(0);
  // Er is niets verwijderd.
  expect((await nepLog()).some((l) => l.method === "DELETE" && l.path.includes("/factors/"))).toBe(
    false,
  );
  void extern;
});
