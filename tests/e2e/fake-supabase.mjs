// Nep-Supabase voor end-to-end-tests. Draait enkel lokaal (127.0.0.1).
// Bevat een testgebruiker, een kleine database in het geheugen en
// stuurknoppen (/__*) waarmee tests storingen kunnen nabootsen.
// Raakt nooit een echte (productie)database.
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { maakDb, rest } from "./nep-db.mjs";
import { demoSeed } from "./demo-data.mjs";

const FOTO_MAP = path.join(path.dirname(fileURLToPath(import.meta.url)), "demo-fotos");

/** DEMO=1: rijke voorbeelddata + login met demo@foodlo.be / demo1234 (lokale preview). */
const DEMO = process.env.DEMO === "1";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);

export const TEST_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "marie@example.com",
  app_metadata: { provider: "email" },
  user_metadata: { display_name: "Marie Test", voornaam: "Marie", achternaam: "Test" },
  created_at: "2026-01-01T00:00:00Z",
};
// Geldige base64url-lengte (veelvoud van 4), anders weigert getClaims() het token op de server.
export const TEST_TOKEN_PREFIX = "nep-tokn";

function seed() {
  return {
    profiles: [
      {
        id: TEST_USER.id,
        display_name: "Marie Test",
        handle: "marie",
        taal: "nl",
        thema: "sage",
        onboarding_klaar: true,
        welkom_mail_verstuurd: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    user_credits: [
      {
        user_id: TEST_USER.id,
        balance: 50,
        gratis_totaal: 50,
        gebruikt_totaal: 0,
        gekocht_totaal: 0,
      },
    ],
    notification_preferences: [
      { user_id: TEST_USER.id, onboarding_gezien: true, tijdzone: "Europe/Brussels" },
    ],
  };
}

const metDemo = (aan) => {
  if (!aan) return seed();
  const { extraProfielen, ...demo } = demoSeed();
  const basis = seed();
  return { ...basis, ...demo, profiles: [...basis.profiles, ...extraProfielen] };
};
const db = maakDb(metDemo(DEMO));
const log = [];
/** Storingen per pad: { pad: { soort: "fout"|"traag"|"netwerk", keer, ms, status } } */
const storingen = new Map();

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD",
  "access-control-expose-headers": "*",
};

function stuur(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cors, ...extra });
  res.end(body === null || body === undefined ? "" : JSON.stringify(body));
}

function b64url(o) {
  return Buffer.from(JSON.stringify(o)).toString("base64url");
}
/** HS256-vormige JWT: supabase-js kan die niet lokaal verifiëren en vraagt /auth/v1/user. */
export function maakToken(sub = TEST_USER.id, opties = {}) {
  const kop = b64url({ alg: "HS256", typ: "JWT" });
  const nu = Math.floor(Date.now() / 1000);
  const inhoud = b64url({
    sub,
    aud: "authenticated",
    role: "authenticated",
    email: TEST_USER.email,
    // `vervalt` (seconden vanaf nu) en `aal` zijn instelbaar voor beveiligingstests.
    exp: nu + (opties.vervalt ?? 3600 * 24),
    iat: nu,
    aal: opties.aal ?? "aal1",
    session_id: "nep-sessie",
  });
  return `${kop}.${inhoud}.${TEST_TOKEN_PREFIX}`;
}
const geldigToken = (auth) =>
  (auth ?? "").startsWith("Bearer ") && auth.endsWith(`.${TEST_TOKEN_PREFIX}`);

/** Verzonnen beheersleutel voor tests en demo (geen echt geheim). */
export const NEP_BEHEERSLEUTEL = "sb_secret_nep_alleen_lokaal";

const RPC_STANDAARD = {
  credits_saldo: { saldo: 50 },
  mijn_credits: { balance: 50 },
  is_admin: false,
  heeft_admin: false,
};

const server = http.createServer((req, res) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    // Eén foute aanvraag mag de hele nep-server nooit laten crashen.
    verwerk().catch((e) => {
      console.error("[nep-supabase] fout:", e instanceof Error ? e.message : e);
      if (!res.headersSent) stuur(res, 500, { message: "nep-fout" });
    });
  });
  const verwerk = async () => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }

    // ---- Stuurknoppen voor tests ----
    if (url.pathname === "/__log") return stuur(res, 200, log);
    if (url.pathname === "/__reset") {
      log.length = 0;
      storingen.clear();
      db.reset(metDemo(DEMO || url.searchParams.get("demo") === "1"));
      return stuur(res, 200, { ok: true });
    }
    if (url.pathname === "/__db") return stuur(res, 200, Object.fromEntries(db.tabellen));
    if (url.pathname === "/__token") {
      // ?sub=<id>: sessie voor een andere (verzonnen) gebruiker, bv. de beheerder in de audit.
      const sub = url.searchParams.get("sub") || TEST_USER.id;
      const vervalt = url.searchParams.get("vervalt");
      const token = maakToken(sub, {
        vervalt: vervalt === null ? undefined : Number(vervalt),
        aal: url.searchParams.get("aal") ?? undefined,
      });
      return stuur(res, 200, { token, user: { ...TEST_USER, id: sub } });
    }
    if (url.pathname === "/__storing" && req.method === "POST") {
      const s = JSON.parse(data || "{}");
      storingen.set(s.pad, { keer: 1, ...s });
      return stuur(res, 200, { ok: true });
    }
    if (url.pathname === "/__seed" && req.method === "POST") {
      const s = JSON.parse(data || "{}");
      for (const [tabel, rijen] of Object.entries(s)) db.t(tabel).push(...rijen);
      return stuur(res, 200, { ok: true });
    }

    let body = null;
    try {
      body = data ? JSON.parse(data) : null;
    } catch {
      body = data;
    }
    log.push({ method: req.method, path: url.pathname, query: url.search, body });

    // ---- Storing nabootsen (enkel voor de volgende N oproepen op dat pad/methode) ----
    for (const [pad, s] of storingen) {
      if (!url.pathname.startsWith(pad) || (s.methode && s.methode !== req.method) || s.keer <= 0)
        continue;
      s.keer -= 1;
      if (s.soort === "traag") await new Promise((r) => setTimeout(r, s.ms ?? 1500));
      if (s.soort === "netwerk") return req.socket.destroy();
      if (s.soort === "fout")
        return stuur(res, s.status ?? 500, { code: "XX000", message: "nep-fout" });
    }

    const auth = req.headers["authorization"];

    // ---- Auth ----
    if (url.pathname === "/auth/v1/token") {
      const demoLogin = DEMO && body?.email === "demo@foodlo.be" && body?.password === "demo1234";
      if (url.searchParams.get("grant_type") === "refresh_token" || demoLogin) {
        return stuur(res, 200, {
          access_token: maakToken(),
          refresh_token: "nep-refresh",
          token_type: "bearer",
          expires_in: 86400,
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          user: TEST_USER,
        });
      }
      if (body?.email === "traag@example.com") {
        return setTimeout(
          () =>
            stuur(res, 400, {
              code: 400,
              error_code: "invalid_credentials",
              msg: "Invalid login credentials",
            }),
          1500,
        );
      }
      if (body?.email === "druk@example.com") {
        return stuur(res, 429, {
          code: 429,
          error_code: "over_request_rate_limit",
          msg: "Request rate limit reached",
        });
      }
      return stuur(res, 400, {
        code: 400,
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      });
    }
    if (url.pathname === "/auth/v1/signup") {
      if (body?.email === "bestaat@example.com") {
        return stuur(res, 422, {
          code: 422,
          error_code: "user_already_exists",
          msg: "User already registered",
        });
      }
      return stuur(res, 422, {
        code: 422,
        error_code: "weak_password",
        msg: "Password should be at least 6 characters.",
      });
    }
    if (url.pathname === "/auth/v1/recover") return stuur(res, 200, {});
    if (url.pathname === "/auth/v1/user") {
      // Zoals echte Supabase: een verlopen token wordt geweigerd.
      let verlopen = false;
      try {
        const exp = JSON.parse(
          Buffer.from((auth ?? "").split(" ")[1].split(".")[1], "base64url").toString(),
        ).exp;
        verlopen = typeof exp === "number" && exp < Math.floor(Date.now() / 1000);
      } catch {
        /* geen leesbaar token: geldigToken beslist */
      }
      if (geldigToken(auth) && !verlopen) {
        let sub = TEST_USER.id;
        try {
          sub =
            JSON.parse(Buffer.from(auth.split(" ")[1].split(".")[1], "base64url").toString()).sub ??
            sub;
        } catch {
          /* standaardgebruiker */
        }
        // MFA (nep): factoren staan als rijen in "__factoren" (via /__seed).
        const factors = db
          .t("__factoren")
          .filter((f) => f.user_id === sub)
          .map(({ user_id: _u, ...f }) => f);
        return stuur(res, 200, { ...TEST_USER, id: sub, factors });
      }
      return stuur(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    }
    // MFA (nep): challenge en verify. Code 123456 is juist; verify geeft een aal2-sessie.
    const factor = url.pathname.match(/^\/auth\/v1\/factors\/([^/]+)\/(challenge|verify)$/);
    if (factor && req.method === "POST") {
      let sub = TEST_USER.id;
      try {
        sub = JSON.parse(Buffer.from(auth.split(" ")[1].split(".")[1], "base64url").toString()).sub;
      } catch {
        return stuur(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      }
      const bekend = db.t("__factoren").some((f) => f.id === factor[1] && f.user_id === sub);
      if (!bekend) return stuur(res, 404, { code: 404, error_code: "mfa_factor_not_found", msg: "Factor not found" });
      if (factor[2] === "challenge")
        return stuur(res, 200, {
          id: `uitdaging-${factor[1]}`,
          type: "totp",
          expires_at: Math.floor(Date.now() / 1000) + 300,
        });
      if (body?.code !== "123456")
        return stuur(res, 422, {
          code: 422,
          error_code: "mfa_verification_failed",
          msg: "Invalid TOTP code entered",
        });
      return stuur(res, 200, {
        access_token: maakToken(sub, { aal: "aal2" }),
        refresh_token: "nep-refresh",
        token_type: "bearer",
        expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        user: { ...TEST_USER, id: sub },
      });
    }
    if (url.pathname === "/auth/v1/logout") return stuur(res, 204, null);
    if (url.pathname.startsWith("/auth/v1/")) return stuur(res, 200, {});

    // ---- Data ----
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const naam = url.pathname.slice("/rest/v1/rpc/".length);
      return stuur(res, 200, RPC_STANDAARD[naam] ?? null);
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const tabel = url.pathname.slice("/rest/v1/".length);
      // Zonder geldige sessie geeft PostgREST (RLS) niets terug.
      // De servercode gebruikt een (nep-)beheersleutel; die mag alles lezen, zoals in het echt.
      const beheer = req.headers["apikey"] === NEP_BEHEERSLEUTEL;
      if (!geldigToken(auth) && !beheer && req.method === "GET") return stuur(res, 200, []);
      const params = [...url.searchParams.entries()];
      const p = Object.assign(params, { get: (k) => url.searchParams.get(k) });
      const r = rest(db, { method: req.method, tabel, params: p, body, headers: req.headers });
      return stuur(res, r.status, r.body, r.kop);
    }
    // Opslag: alleen de demofoto's (pad "demo/<bestand>"). createSignedUrl -> getekende URL -> bestand.
    const teken = url.pathname.match(
      /^\/storage\/v1\/object\/sign\/recipe-photos\/(demo\/[a-z0-9-]+\.jpg)$/,
    );
    if (teken && req.method === "POST") {
      return stuur(res, 200, { signedURL: `/object/sign/recipe-photos/${teken[1]}?token=demo` });
    }
    if (teken && req.method === "GET") {
      const bestand = path.join(FOTO_MAP, path.basename(teken[1]));
      if (!existsSync(bestand)) return stuur(res, 404, { error: "geen demofoto" });
      res.writeHead(200, {
        "content-type": "image/jpeg",
        "cache-control": "max-age=3600",
        ...cors,
      });
      return res.end(readFileSync(bestand));
    }
    // Opslag (nep): bestanden staan als rijen { bucket_id, name } in de tabel "__opslag".
    // list = de bestanden direct in een map; remove = wissen (zoals de Storage-API).
    const lijst = url.pathname.match(/^\/storage\/v1\/object\/list\/([a-z-]+)$/);
    if (lijst && req.method === "POST") {
      const map = String(body?.prefix ?? "").replace(/\/$/, "");
      const alle = db.t("__opslag").filter((o) => o.bucket_id === lijst[1]);
      const hier = alle
        .filter((o) => o.name.startsWith(`${map}/`) && !o.name.slice(map.length + 1).includes("/"))
        .map((o) => ({ name: o.name.slice(map.length + 1), id: o.name, metadata: {} }));
      const van = Number(body?.offset ?? 0);
      return stuur(res, 200, hier.slice(van, van + Number(body?.limit ?? 100)));
    }
    const wis = url.pathname.match(/^\/storage\/v1\/object\/([a-z-]+)$/);
    if (wis && req.method === "DELETE") {
      const paden = new Set(body?.prefixes ?? []);
      const t = db.t("__opslag");
      const weg = t.filter((o) => o.bucket_id === wis[1] && paden.has(o.name));
      for (const o of weg) t.splice(t.indexOf(o), 1);
      return stuur(
        res,
        200,
        weg.map((o) => ({ name: o.name })),
      );
    }
    if (url.pathname.startsWith("/storage/v1/"))
      return stuur(res, 400, { error: "niet in nep-Supabase" });
    if (url.pathname.startsWith("/functions/v1/"))
      return stuur(res, 404, { error: "geen functies" });
    return stuur(res, 404, { error: "onbekend in nep-Supabase" });
  };
});

// Standaard alleen op deze computer. Alleen de demo met DEMO_LAN=1 zet dit op 0.0.0.0.
const HOST = process.env["FAKE_SUPABASE_HOST"] ?? "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`nep-supabase luistert op http://${HOST}:${PORT}`);
});
