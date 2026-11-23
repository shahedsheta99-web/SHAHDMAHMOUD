// Service worker: lets the app open offline.
// "Network first, always revalidated": when online, every file is checked with
// GitHub (cache: 'no-cache'), so a phone never mixes old and new files after an
// update. When offline, the last saved copy is used.
const CACHE = 'pednutrition-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// Safari refuses pages that a service worker returns after a redirect, so copy them.
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (!same && url.hostname !== 'www.gstatic.com') return;
  e.respondWith((async () => {
    try {
      const res = await clean(same ? await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : await fetch(req));
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const home = await caches.match(new URL('./', location).href); if (home) return home; }
      throw err;
    }
  })());
});
