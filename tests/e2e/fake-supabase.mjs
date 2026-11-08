// Nep-Supabase voor end-to-end-tests. Draait enkel lokaal (127.0.0.1).
// Antwoordt met vaste, voorspelbare data en houdt bij welke oproepen gebeurden,
// zodat tests nooit een echte (productie)database raken.
import http from "node:http";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);
const log = [];

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-expose-headers": "*",
};

function stuur(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", ...cors });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    if (url.pathname === "/__log") return stuur(res, 200, log);
    if (url.pathname === "/__reset") {
      log.length = 0;
      return stuur(res, 200, { ok: true });
    }
    let body = null;
    try {
      body = data ? JSON.parse(data) : null;
    } catch {
      body = data;
    }
    log.push({ method: req.method, path: url.pathname, query: url.search, body });

    // --- Auth ---
    if (url.pathname === "/auth/v1/token") {
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
    if (url.pathname === "/auth/v1/user") return stuur(res, 401, { code: 401, msg: "no session" });
    if (url.pathname.startsWith("/auth/v1/")) return stuur(res, 200, {});

    // --- Data ---
    if (url.pathname.startsWith("/rest/v1/")) return stuur(res, 200, []);
    if (url.pathname.startsWith("/storage/v1/")) return stuur(res, 404, { error: "not found" });
    return stuur(res, 404, { error: "onbekend in nep-Supabase" });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`nep-supabase luistert op http://127.0.0.1:${PORT}`);
});
