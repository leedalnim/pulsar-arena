/**
 * sw.js — service worker for offline play (PWA).
 * ---------------------------------------------------------------------------
 * Stale-while-revalidate over same-origin GETs: the first online visit fills
 * the cache as the app's ES modules / CSS / icons are fetched; afterwards the
 * game loads and runs fully offline (all gameplay is procedural — no backend).
 * Cross-origin requests (e.g. Google Fonts) are left to the network and fall
 * back to system fonts when offline. Bump CACHE to invalidate old assets.
 * ---------------------------------------------------------------------------
 */
const CACHE = 'pulsar-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin hit the network

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
