/* Service Worker for Blog Platform */
const CACHE_VERSION = 'v1';
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// Basic offline fallback HTML (no external deps)
const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline - Blog Platform</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif; margin: 0; padding: 2rem; background:#f8f9fa; color:#212529; }
    .card { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    h1 { font-size: 1.5rem; margin: 0 0 .75rem; }
    p { margin: .5rem 0; }
    a.btn { display:inline-block; margin-top:1rem; background:#0d6efd; color:#fff; padding:.6rem 1rem; border-radius: .5rem; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card" role="region" aria-label="Offline notice">
    <h1>Anda sedang offline</h1>
    <p>Koneksi internet tidak tersedia. Beberapa fitur mungkin tidak dapat digunakan.</p>
    <p>Silakan periksa koneksi Anda dan coba lagi.</p>
    <a class="btn" href="/">Kembali ke Beranda</a>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Precache only minimal shell assets that are guaranteed to exist
      return cache.addAll([
        '/',
      ]).catch(() => undefined);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  // Navigation requests: try network, then cache, then offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Optionally, update runtime cache for navigations
          const respClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, respClone)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
          return new Response(OFFLINE_FALLBACK_HTML, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
        })
    );
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Cache-first for same-origin static assets
  if (isSameOrigin && (/\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf)$/i.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const respClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, respClone)).catch(() => {});
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Stale-while-revalidate for other GET requests
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        const respClone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, respClone)).catch(() => {});
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
