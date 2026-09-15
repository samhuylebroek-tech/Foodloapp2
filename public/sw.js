// Kleine offline-hulp: bewaart bezochte pagina's en bestanden,
// zodat je je klantenkaart ook zonder internet kan tonen.
const CACHE = "foodlo-offline-v1";

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
        const kopie = res.clone();
        caches.open(CACHE).then((c) => c.put(req, kopie)).catch(() => undefined);
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
