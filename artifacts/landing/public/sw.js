const CACHE = "taskdesk-v3";
const PRECACHE = ["/", "/favicon.png", "/taskdesk-logo.png", "/site.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// This service worker is registered at the origin root, so its maximum scope
// covers every path — including other artifacts served under sub-paths like
// /app/ (ticketing) or /mobile/. To avoid ever caching/serving stale content
// for those artifacts, only intercept requests for the landing page's own
// precached assets/root document. Everything else falls through untouched
// (no e.respondWith call), so the browser handles it as if no SW existed.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (!PRECACHE.includes(url.pathname)) return;

  if (url.pathname === "/") {
    // Network-first for the HTML shell so a new deploy is picked up as soon
    // as possible; fall back to cache only when offline/network fails.
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
