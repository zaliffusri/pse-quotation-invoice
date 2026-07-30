/* PSE System — Service Worker (offline shell) */
const CACHE = 'pse-shell-v1';
const PRECACHE = [
  '/',
  '/login.html',
  '/app.html',
  '/css/system.css',
  '/js/api.js',
  '/js/offline.js',
  '/js/app.js',
  '/assets/logo.png',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API — offline API handled in page JS
  if (url.pathname.startsWith('/api/')) return;

  // App shell: cache-first, then network, then offline fallback pages
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      // Refresh cache in background
      event.waitUntil(
        fetch(req).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
        }).catch(() => {})
      );
      return cached;
    }

    try {
      const res = await fetch(req);
      if (res && res.ok && (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.js') || url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.webmanifest') || url.pathname === '/')) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
      }
      return res;
    } catch {
      if (url.pathname === '/' || url.pathname === '/app' || url.pathname === '/app/') {
        return (await caches.match('/app.html')) || (await caches.match('/login.html'));
      }
      if (url.pathname.endsWith('.html')) {
        return (await caches.match(url.pathname)) || (await caches.match('/login.html'));
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
