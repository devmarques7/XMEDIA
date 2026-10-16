// XMEDIA service worker: app instalável + abre offline com a última versão vista.
const CACHE = "xmedia-v2"; // v2: logo novo
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
);
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/auth")) return;
  // estáticos com hash: cache primeiro
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/pwa-icon")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => (caches.open(CACHE).then((c) => c.put(req, res.clone())), res))));
    return;
  }
  // páginas: rede primeiro, cache se offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => (caches.open(CACHE).then((c) => c.put(req, res.clone())), res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
    );
  }
});
