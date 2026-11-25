const CACHE_NAME = "piat-faculty-attendance-shell-v3";
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/piat-logo.png",
  "/piat-app-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
];
const STATIC_PREFIXES = ["/assets/", "/_build/", "/_tanstack/"];
const STATIC_FILES = new Set(PRECACHE_URLS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("piat-faculty-attendance-shell-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const offlinePage = await cache.match("/offline.html");
        if (offlinePage) return offlinePage;
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
    );
    return;
  }

  const isAppAsset = STATIC_FILES.has(url.pathname) ||
    STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  if (!isAppAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) return cachedResponse;

      const response = await fetch(request);
      const cacheControl = response.headers.get("Cache-Control") || "";
      if (
        response.ok &&
        response.type === "basic" &&
        !/\b(private|no-store)\b/i.test(cacheControl) &&
        !response.headers.has("Set-Cookie")
      ) {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
