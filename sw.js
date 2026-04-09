// CinéLynker Service Worker v2
// Cache: statique (shell) + dynamique (API Supabase/TMDB)

const CACHE_SHELL    = 'cinelynker-shell-v2';    // App shell (HTML, fonts)
const CACHE_IMAGES   = 'cinelynker-images-v1';   // Posters TMDB
const CACHE_API      = 'cinelynker-api-v1';      // Données cinémas/films

const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install : pre-cache shell ─────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_SHELL)
      .then(c => c.addAll(SHELL_URLS).catch(() => {})) // ignore missing icons at first deploy
      .then(() => self.skipWaiting())
  );
});

// ── Activate : clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', e => {
  const keep = [CACHE_SHELL, CACHE_IMAGES, CACHE_API];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // POST/non-GET → always network
  if (e.request.method !== 'GET') return;

  // TMDB poster images → cache-first (images don't change)
  if (url.hostname === 'image.tmdb.org') {
    e.respondWith(cacheFirst(e.request, CACHE_IMAGES, 30 * 24 * 3600)); // 30 days
    return;
  }

  // Our own API (/api/*) → network-first, short timeout
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(e.request, CACHE_API, 5000));
    return;
  }

  // Supabase REST/Realtime → always network (real-time data)
  if (url.hostname.includes('supabase.co')) return;

  // App shell (HTML, manifest, icons) → cache-first with network update
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(e.request, CACHE_SHELL));
    return;
  }

  // Google Fonts, CDN → cache-first
  if (url.hostname.includes('fonts.') || url.hostname.includes('cdnjs.')) {
    e.respondWith(cacheFirst(e.request, CACHE_SHELL, 7 * 24 * 3600));
    return;
  }
});

// ── Cache strategies ──────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cached = await caches.match(request);
  if (cached) {
    // Check age if maxAge specified
    if (maxAgeSeconds) {
      const date = cached.headers.get('sw-cached-at');
      if (date && (Date.now() - parseInt(date)) > maxAgeSeconds * 1000) {
        // Expired — fetch in background
        fetch(request).then(res => putInCache(request, res, cacheName)).catch(() => {});
      }
    }
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) putInCache(request, response.clone(), cacheName);
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) putInCache(request, response.clone(), cacheName);
    return response;
  } catch {
    clearTimeout(timer);
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then(res => {
    if (res.ok) putInCache(request, res.clone(), cacheName);
    return res;
  }).catch(() => null);
  return cached || networkPromise || new Response('Offline', { status: 503 });
}

async function putInCache(request, response, cacheName) {
  if (!response || !response.ok) return;
  try {
    // Add timestamp header for cache expiry
    const headers = new Headers(response.headers);
    headers.set('sw-cached-at', Date.now().toString());
    const modifiedResponse = new Response(await response.blob(), { status: response.status, headers });
    const cache = await caches.open(cacheName);
    await cache.put(request, modifiedResponse);
  } catch(e) { /* quota exceeded etc */ }
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title:'CinéLynker 🎬', body:'Nouvelle notification', icon:'/icons/icon-192.png', badge:'/icons/icon-72.png', url:'/' };
  try { Object.assign(data, e.data?.json()); } catch { data.body = e.data?.text() || data.body; }

  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    tag: data.tag || 'cinelynker-' + Date.now(),
    renotify: true,
    data: { url: data.url },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.postMessage({ type: 'NAVIGATE', url }); return; }
      return clients.openWindow(url);
    })
  );
});

// ── Background sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-messages') {
    e.waitUntil(clients.matchAll().then(list => list.forEach(c => c.postMessage({ type: 'SYNC_MESSAGES' }))));
  }
});
