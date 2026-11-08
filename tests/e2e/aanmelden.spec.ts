import {
  axeErnstig,
  expect,
  heeftHorizontaleScroll,
  kleineDoelen,
  nepLog,
  resetNep,
  test,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetNep();
  await page.goto("/aanmelden");
  // De knop wordt pas actief als de pagina interactief is.
  await expect(page.getByRole("button", { name: "Aanmelden", exact: true })).toBeEnabled();
});

test.describe("Aanmelden — kernflow", () => {
  test("toegankelijk: geen ernstige WCAG 2.2 AA-problemen", async ({ page, extern }) => {
    expect(await axeErnstig(page)).toEqual([]);
    void extern;
  });

  test("verkeerd wachtwoord: duidelijke Nederlandse uitleg in het formulier", async ({
    page,
    extern,
  }) => {
    await page.getByLabel("E-mailadres").fill("marie@example.com");
    await page.getByLabel("Wachtwoord", { exact: true }).fill("verkeerd123");
    await page.getByRole("button", { name: "Aanmelden", exact: true }).click();
    const fout = page.getByRole("alert").filter({ hasText: "klopt niet" });
    await expect(fout).toBeVisible();
    await expect(page.getByText("Invalid login credentials")).toHaveCount(0);
    await expect(page.getByLabel("E-mailadres")).toHaveAttribute("aria-invalid", "true");
    void extern;
  });

  test("te veel pogingen: vriendelijke boodschap", async ({ page, extern }) => {
    await page.getByLabel("E-mailadres").fill("druk@example.com");
    await page.getByLabel("Wachtwoord", { exact: true }).fill("geheim123");
    await page.getByRole("button", { name: "Aanmelden", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "te veel pogingen" })).toBeVisible();
    void extern;
  });

  test("wachtwoord tonen en verbergen", async ({ page, extern }) => {
    const veld = page.getByLabel("Wachtwoord", { exact: true });
    await veld.fill("geheim123");
    await expect(veld).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Toon wachtwoord" }).click();
    await expect(veld).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Verberg wachtwoord" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    void extern;
  });

  test("wachtwoord vergeten zonder e-mail: vraagt eerst het adres en zet de focus daar", async ({
    page,
    extern,
  }) => {
    await page.getByRole("button", { name: "Wachtwoord vergeten?" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Vul eerst je e-mailadres in" }),
    ).toBeVisible();
    await expect(page.getByLabel("E-mailadres")).toBeFocused();
    expect((await nepLog()).some((l) => l.path === "/auth/v1/recover")).toBe(false);
    void extern;
  });

  test("wachtwoord vergeten: neutrale bevestiging en juiste terugkeerlink", async ({
    page,
    extern,
  }) => {
    await page.getByLabel("E-mailadres").fill("marie@example.com");
    await page.getByRole("button", { name: "Wachtwoord vergeten?" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Als er een account bestaat" }),
    ).toBeVisible();
    const herstel = (await nepLog()).find((l) => l.path === "/auth/v1/recover");
    expect(herstel).toBeTruthy();
    expect(decodeURIComponent(herstel!.query)).toContain("/wachtwoord-herstellen");
    void extern;
  });

  test("volledig met toetsenbord: Enter in het wachtwoordveld meldt aan", async ({
    page,
    extern,
  }) => {
    await page.getByLabel("E-mailadres").focus();
    await page.keyboard.type("marie@example.com");
    await page.getByLabel("Wachtwoord", { exact: true }).focus();
    await page.keyboard.type("verkeerd123");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "klopt niet" })).toBeVisible();
    void extern;
  });

  test("tijdens het aanmelden is de knop uitgeschakeld (geen dubbele klik)", async ({
    page,
    extern,
  }) => {
    await page.getByLabel("E-mailadres").fill("traag@example.com");
    await page.getByLabel("Wachtwoord", { exact: true }).fill("geheim123");
    const knop = page.getByRole("button", { name: "Aanmelden", exact: true });
    await knop.click();
    await expect(knop).toBeDisabled();
    await expect(page.getByRole("alert").filter({ hasText: "klopt niet" })).toBeVisible();
    await expect(knop).toBeEnabled();
    expect((await nepLog()).filter((l) => l.path === "/auth/v1/token")).toHaveLength(1);
    void extern;
  });

  test("offline: zegt dat er geen verbinding is", async ({ page, context, extern }) => {
    await page.getByLabel("E-mailadres").fill("marie@example.com");
    await page.getByLabel("Wachtwoord", { exact: true }).fill("geheim123");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Aanmelden", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "geen verbinding" })).toBeVisible();
    await context.setOffline(false);
    void extern;
  });

  test("account maken: namen verplicht, bestaand adres krijgt uitleg", async ({ page, extern }) => {
    await page.getByRole("button", { name: /Nog geen account/ }).click();
    await page.getByLabel("E-mailadres").fill("bestaat@example.com");
    await page.getByLabel("Wachtwoord", { exact: true }).fill("geheim123");
    // Lege velden houdt de browser zelf tegen; enkel spaties vangt onze eigen controle.
    await page.getByLabel("Voornaam").fill("  ");
    await page.getByLabel("Achternaam").fill("  ");
    await page.getByRole("button", { name: "Account maken" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "voornaam en achternaam" }),
    ).toBeVisible();
    expect((await nepLog()).some((l) => l.path === "/auth/v1/signup")).toBe(false);
    await page.getByLabel("Voornaam").fill("Marie");
    await page.getByLabel("Achternaam").fill("Janssens");
    await page.getByRole("button", { name: "Account maken" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "bestaat al een account" }),
    ).toBeVisible();
    void extern;
  });

  test("mobiel: geen horizontaal scrollen", async ({ page, extern }) => {
    expect(await heeftHorizontaleScroll(page)).toBe(false);
    void extern;
  });

  test("aanraakdoelen zijn minstens 44 px", async ({ page, extern }) => {
    expect(await kleineDoelen(page, 44)).toEqual([]);
    void extern;
  });
});

test.describe("Beveiligde pagina's", () => {
  for (const pad of ["/", "/planner", "/boodschappen", "/gerechten"]) {
    test(`${pad} stuurt een afgemelde bezoeker naar aanmelden`, async ({ page, extern }) => {
      await page.goto(pad);
      await expect(page).toHaveURL(/\/aanmelden$/);
      void extern;
    });
  }
});
