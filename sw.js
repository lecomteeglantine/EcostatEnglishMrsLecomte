const CACHE_PREFIX = 'ecostat-english-';
const CACHE = `${CACHE_PREFIX}v6.2.2`;
const VERSION = '6.2.2';
const CORE = [
  './',
  './index.html',
  './session1-linkedin-rescue-squad.html',
  './session2-beat-the-ats.html',
  './styles.css?v=6.2.2',
  './fixes.css?v=6.2.2',
  './data.js?v=6.2.2',
  './app.js?v=6.2.2',
  './manifest.webmanifest?v=6.2.2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function fetchFresh(request) {
  return fetch(request, { cache: 'no-store' });
}

async function networkFirst(request, fallbackUrl = null) {
  try {
    const response = await fetchFresh(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl, { ignoreSearch: true });
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  const update = fetchFresh(request).then(async response => {
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || (await update) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  const file = url.pathname.slice(scope.pathname.length);
  const mutable = /^(?:index\.html|session1-linkedin-rescue-squad\.html|session2-beat-the-ats\.html|data\.js|app\.js|styles\.css|fixes\.css|manifest\.webmanifest)$/.test(file);
  event.respondWith(mutable ? networkFirst(request) : staleWhileRevalidate(request));
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'VERSION' && event.source) event.source.postMessage({ type: 'SW_VERSION', version: VERSION });
});
