const CACHE_NAME = 'leituras-oficial-v2';

// Install: only cache essential assets, don't cache HTML pages
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: delete ALL old caches to force fresh content
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for EVERYTHING - always try fresh content first
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for offline fallback
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve from cache
        return caches.match(request).then((cached) => {
          return cached || caches.match('/');
        });
      })
  );
});
