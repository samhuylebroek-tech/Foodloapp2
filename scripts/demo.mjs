#!/usr/bin/env node
// Lokale V2-preview met voorbeelddata. Raakt NOOIT productie:
// de app praat met een nep-Supabase op 127.0.0.1, met verzonnen gegevens.
// Gebruik: bun run demo   → open http://127.0.0.1:4319 en meld aan met
//          demo@foodlo.be / demo1234
import { spawn } from "node:child_process";

const SUPA = "http://127.0.0.1:54399";
const env = {
  ...process.env,
  DEMO: "1",
  FAKE_SUPABASE_PORT: "54399",
  VITE_SUPABASE_URL: SUPA,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
  VITE_SUPABASE_PROJECT_ID: "demo",
  SUPABASE_URL: SUPA,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
  // Verzonnen sleutel die alleen de nep-Supabase kent (geen echt geheim).
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_nep_alleen_lokaal",
  LOVABLE_API_KEY: "",
  RESEND_API_KEY: "",
  VITE_FOODLO_APP_URL: "http://127.0.0.1:4319",
};

const kinderen = [
  spawn("node", ["tests/e2e/fake-supabase.mjs"], { env, stdio: "inherit" }),
  spawn("npx", ["vite", "dev", "--port", "4319", "--strictPort", "--host", "127.0.0.1"], {
    env,
    stdio: "inherit",
  }),
];
console.log(
  "\n  Foodlo V2-demo: http://127.0.0.1:4319  —  aanmelden met demo@foodlo.be / demo1234\n",
);
const stop = () => kinderen.forEach((k) => k.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
