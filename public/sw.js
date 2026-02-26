/* eslint-disable no-restricted-globals */
/* global workbox */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

try {
  importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js");
} catch {
  // If Workbox CDN is unavailable, the app still works without runtime mp3 caching.
}

if (self.workbox) {
  self.workbox.core.setCacheNameDetails({
    prefix: "cozyfocus",
    suffix: "v1"
  });

  self.workbox.routing.registerRoute(
    ({ request, url }) => request.method === "GET" && url.pathname.endsWith(".mp3"),
    new self.workbox.strategies.CacheFirst({
      cacheName: "cozyfocus-ambient-audio",
      plugins: [
        new self.workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 30
        })
      ]
    })
  );
}
