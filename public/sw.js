const SHELL_CACHE = 'preq-shell-v1';
const STATIC_ASSETS = ['/', '/dashboard', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response.ok) {
          return response;
        }

        const responseCopy = response.clone();
        void caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, responseCopy));
        return response;
      });
    }),
  );
});
