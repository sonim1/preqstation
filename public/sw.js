const BOARD_CACHE = 'preq-board-v2';
const STATIC_CACHE = 'preq-static-v2';
const MANAGED_CACHES = [BOARD_CACHE, STATIC_CACHE];
const MANAGED_CACHE_PREFIXES = ['preq-board-', 'preq-static-'];
const OFFLINE_FALLBACK_URL = '/offline.html';
const PRECACHED_ASSETS = ['/manifest.webmanifest', OFFLINE_FALLBACK_URL];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isBoardNavigation(url) {
  return url.pathname === '/board' || url.pathname.startsWith('/board/');
}

function isProjectsNavigation(url) {
  return url.pathname === '/projects';
}

function isManagedNavigation(url) {
  return isBoardNavigation(url) || isProjectsNavigation(url);
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return (
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:css|gif|ico|jpg|jpeg|js|png|svg|webp|woff|woff2)$/i.test(url.pathname)
  );
}

function buildBoardCacheKey(url) {
  return `${url.origin}${url.pathname}`;
}

async function getOfflineFallbackResponse() {
  const offlineResponse = await caches.match(OFFLINE_FALLBACK_URL);
  if (offlineResponse) {
    return offlineResponse;
  }

  return new Response('Offline fallback is unavailable.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHED_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              MANAGED_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix)) &&
              !MANAGED_CACHES.includes(cacheName),
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (!isSameOrigin(url) || isApiRequest(url)) {
    return;
  }

  if (event.request.mode === 'navigate' && isManagedNavigation(url)) {
    const cacheKey = buildBoardCacheKey(url);
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const responseCopy = response.clone();
            void caches.open(BOARD_CACHE).then((cache) => cache.put(cacheKey, responseCopy));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(cacheKey);
          if (cachedResponse) {
            return cachedResponse;
          }

          return getOfflineFallbackResponse();
        }),
    );
    return;
  }

  if (!isStaticAsset(url)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response.ok || response.redirected) {
          return response;
        }

        const responseCopy = response.clone();
        void caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, responseCopy));
        return response;
      });
    }),
  );
});
