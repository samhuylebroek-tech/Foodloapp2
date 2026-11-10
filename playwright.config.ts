import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end-tests draaien tegen een lokale dev-server en een NEP-Supabase.
 * Elke request naar een ander adres dan 127.0.0.1/localhost wordt in de tests
 * geblokkeerd (zie tests/e2e/helpers.ts), zodat productie nooit geraakt wordt.
 */
// Eigen poorten, zodat de demo (4319/54399) mag blijven draaien tijdens het testen.
const APP_PORT = 4339;
const SUPA_PORT = 54439;
const SUPA_URL = `http://127.0.0.1:${SUPA_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/.resultaten",
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  timeout: 45_000,
  // Ruimer dan de standaard 5 s: een koude dev-server compileert de eerste pagina's
  // (en optimaliseert afhankelijkheden) soms pas na 10+ s.
  expect: { timeout: 20_000 },
  reporter: process.env["CI"]
    ? [["github"], ["list"], ["html", { outputFolder: "tests/e2e/.rapport", open: "never" }]]
    : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    locale: "nl-BE",
    timezoneId: "Europe/Brussels",
    trace: "retain-on-failure",
  },
  projects: [
    // Beginner op een kleine telefoon (Pixel 7, 412 px).
    {
      name: "telefoon",
      use: { ...devices["Pixel 7"] },
      testIgnore:
        /kernflow|schermen|kookstand|voorraad|personas|mobiel-breedtes|kringloop|navigatie|weekmenu-lijst|vandaag|winkelmodus|tablet|\/lijst\.spec|audit-mobiel/,
    },
    // Creator op desktop.
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      // De telefoonbreedtes hebben hun eigen project hieronder.
      testIgnore: /mobiel-breedtes|tablet|audit-mobiel/,
    },
    // Kernflow op de gevraagde breedtes (de desktop-run hierboven dekt 1280 px).
    {
      name: "mobiel-360",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } },
      testMatch: /kernflow|kookstand|voorraad/,
    },
    {
      name: "mobiel-390",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
      testMatch:
        /kernflow|schermen|personas|schermen-alle|mobiel-breedtes|kringloop|navigatie|weekmenu-lijst|vandaag|winkelmodus|\/lijst\.spec|audit-mobiel/,
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true },
      testMatch: /kernflow|tablet|navigatie|winkelmodus|vandaag|schermen-review|\/lijst\.spec/,
    },
  ],
  webServer: [
    {
      command: `node tests/e2e/fake-supabase.mjs`,
      url: `${SUPA_URL}/__log`,
      env: { FAKE_SUPABASE_PORT: String(SUPA_PORT) },
      reuseExistingServer: !process.env["CI"],
    },
    {
      command: `npx vite dev --port ${APP_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${APP_PORT}/aanmelden`,
      timeout: 120_000,
      reuseExistingServer: !process.env["CI"],
      env: {
        // Echte omgevingsvariabelen worden hier bewust overschreven.
        VITE_SUPABASE_URL: SUPA_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_nep",
        VITE_SUPABASE_PROJECT_ID: "e2e-nep",
        SUPABASE_URL: SUPA_URL,
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_nep",
        // Verzonnen sleutel die alleen de nep-Supabase kent (geen echt geheim).
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_nep_alleen_lokaal",
        LOVABLE_API_KEY: "",
        RESEND_API_KEY: "",
        VITE_FOODLO_APP_URL: `http://127.0.0.1:${APP_PORT}`,
      },
    },
  ],
});
