#!/usr/bin/env node
// Lokale V2-preview met voorbeelddata. Raakt NOOIT productie:
// de app praat met een nep-Supabase op 127.0.0.1, met verzonnen gegevens.
// Gebruik: bun run demo   → open http://127.0.0.1:4319 en meld aan met
//          demo@foodlo.be / demo1234
//
// DEMO_LAN=1 bun run demo → ook bereikbaar voor telefoons op hetzelfde wifi-netwerk
// (praktijktest, docs/foodloapp-v2/PRAKTIJKTEST-TOESTELLEN.md). Alleen na akkoord van de
// eigenaar, alleen op een vertrouwd thuisnetwerk, en daarna weer stoppen.
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const LAN = process.env["DEMO_LAN"] === "1";
const lanIp = () =>
  Object.values(networkInterfaces())
    .flat()
    .find(
      (i) =>
        i &&
        i.family === "IPv4" &&
        !i.internal &&
        /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(i.address),
    )?.address;
const IP = LAN ? lanIp() : "127.0.0.1";
if (!IP) {
  console.error(
    "Geen privé-netwerkadres (192.168.x, 10.x, 172.16–31.x) gevonden; LAN-demo gestopt.",
  );
  process.exit(1);
}
const BIND = LAN ? "0.0.0.0" : "127.0.0.1";
const SUPA = `http://${IP}:54399`;
const env = {
  ...process.env,
  DEMO: "1",
  FAKE_SUPABASE_PORT: "54399",
  FAKE_SUPABASE_HOST: BIND,
  VITE_SUPABASE_URL: SUPA,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
  VITE_SUPABASE_PROJECT_ID: "demo",
  SUPABASE_URL: SUPA,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
  // Verzonnen sleutel die alleen de nep-Supabase kent (geen echt geheim).
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_nep_alleen_lokaal",
  LOVABLE_API_KEY: "",
  RESEND_API_KEY: "",
  VITE_FOODLO_APP_URL: `http://${IP}:4319`,
};

const kinderen = [
  spawn("node", ["tests/e2e/fake-supabase.mjs"], { env, stdio: "inherit" }),
  spawn("npx", ["vite", "dev", "--port", "4319", "--strictPort", "--host", BIND], {
    env,
    stdio: "inherit",
  }),
];
console.log(
  `\n  Foodlo V2-demo: http://${IP}:4319  —  aanmelden met demo@foodlo.be / demo1234\n` +
    (LAN
      ? "  LET OP: bereikbaar voor iedereen op dit netwerk (alleen nepgegevens). Stop met Ctrl+C.\n"
      : ""),
);
const stop = () => kinderen.forEach((k) => k.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
