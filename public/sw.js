// Kleine offline-hulp: bewaart bezochte pagina's en bestanden,
// zodat je je klantenkaart ook zonder internet kan tonen.
const CACHE = "foodlo-offline-v5";

// Meldingen tonen en naar de juiste pagina springen.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { titel: "Foodlo", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.titel || "Foodlo", {
      body: d.body || "",
      icon: "/app-icon-512.png",
      badge: "/favicon.png",
      tag: d.tag || "foodlo",
      renotify: false,
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const doel = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lijst) => {
      for (const c of lijst) {
        if ("navigate" in c) return c.navigate(doel).then((w) => w && w.focus());
      }
      return self.clients.openWindow(doel);
    }),
  );
});

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Gegevens van de server nooit uit de cache serveren.
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api")) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Enkel geslaagde, gewone én volledig ontvangen antwoorden bewaren.
        // Een halve pagina (afgebroken verbinding) mag nooit in de cache belanden.
        if (res && res.ok && res.type === "basic") {
          const kopie = res.clone();
          e.waitUntil(
            kopie
              .arrayBuffer()
              .then(async (body) => {
                const volledig = new Response(body, {
                  status: kopie.status,
                  statusText: kopie.statusText,
                  headers: kopie.headers,
                });
                const c = await caches.open(CACHE);
                await c.put(req, volledig);
              })
              .catch(() => undefined),
          );
        }
        return res;
      })
      .catch(async () => {
        const uit = await caches.match(req);
        if (uit) return uit;
        if (req.mode === "navigate") {
          const shell = (await caches.match("/kaarten")) || (await caches.match("/"));
          if (shell) return shell;
        }
        return new Response("Offline", { status: 503 });
      }),
  );
});
