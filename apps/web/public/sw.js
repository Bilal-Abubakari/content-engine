/*
 * ContentEngine service worker.
 *
 * Its main job is to make the app installable (a fetch handler is required for
 * the browser's install prompt) and to keep the app shell resilient offline.
 * Strategy is deliberately conservative so it never serves stale API data:
 *   - Navigation requests: network-first, falling back to the cached offline
 *     shell only when the network is unavailable.
 *   - Same-origin static assets (icons, _next/static): cache-first.
 *   - Everything else (APIs, cross-origin): passed straight through.
 */
const CACHE = 'contentengine-v1';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return; // Never intercept cross-origin (provider APIs, avatars, etc.).
  }

  // App navigations: try the network, fall back to the cached offline shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  // Static build assets and icons: cache-first for instant repeat loads.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
