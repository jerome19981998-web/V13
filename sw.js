// CinéMatch Service Worker — v3
// Stratégies : Network-first pour l'app, Cache-first pour fonts/images

const CACHE_VERSION = 'cinematch-v3';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGE_CACHE   = `${CACHE_VERSION}-images`;
const FONT_CACHE    = `${CACHE_VERSION}-fonts`;

// Fichiers précachés au premier install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

// Page offline de fallback
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>CinéMatch — Hors ligne</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{
      background:#07070f;color:#e8e0d4;
      font-family:'Outfit',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;
      min-height:100dvh;text-align:center;flex-direction:column;gap:16px;
      padding:24px;
    }
    .icon{font-size:56px;}
    h1{font-size:22px;font-weight:700;}
    p{font-size:14px;opacity:.55;line-height:1.7;max-width:260px;}
    button{
      margin-top:8px;padding:12px 28px;
      background:#ff3f5b;border:none;border-radius:14px;
      color:#fff;font-size:15px;font-weight:600;cursor:pointer;
    }
  </style>
</head>
<body>
  <div class="icon">🎬</div>
  <h1>CinéMatch</h1>
  <p>Pas de connexion internet.<br>Reconnecte-toi pour accéder à l'app.</p>
  <button onclick="location.reload()">Réessayer</button>
</body>
</html>`;

// ─── INSTALL ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // addAll échoue si un asset est introuvable — on attrape silencieusement
      await cache.addAll(PRECACHE_ASSETS).catch(() => {});
      // Précacher la page offline directement en mémoire
      await cache.put(
        new Request('/__offline'),
        new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      );
      await self.skipWaiting();
    })()
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Supprimer les anciens caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => k.startsWith('cinematch-') && k !== STATIC_CACHE && k !== IMAGE_CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      );
      await self.clients.claim();
      // Notifier les onglets ouverts qu'une nouvelle version est disponible
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
    })()
  );
});

// ─── FETCH ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Requêtes non-GET → toujours réseau, jamais de cache
  if (request.method !== 'GET') return;

  // 2. Supabase / TMDB / APIs externes → réseau uniquement, pas de cache
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('tmdb.org')    ||
    url.hostname.includes('image.tmdb.org') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    return; // laisse le browser gérer normalement
  }

  // 3. Google Fonts → Cache-first (les fonts changent très rarement)
  if (
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // 4. Images TMDB déjà téléchargées (posters) → Cache-first avec fallback réseau
  if (url.pathname.includes('/t/p/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // 5. App shell (/) et assets statiques → Network-first avec fallback cache
  event.respondWith(networkFirst(request));
});

// ─── STRATÉGIES ────────────────────────────────────────────────────────────

/**
 * Network-first : essaie le réseau, met en cache, 
 * utilise le cache si hors-ligne, page offline en dernier recours.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone()); // async, on n'attend pas
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback : page offline pour les navigations HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match('/__offline', { cacheName: STATIC_CACHE });
      if (offlinePage) return offlinePage;
    }
    return new Response('Hors ligne', { status: 503 });
  }
}

/**
 * Cache-first : sert depuis le cache si dispo, 
 * sinon réseau + mise en cache pour la prochaine fois.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ─── MESSAGE ───────────────────────────────────────────────────────────────
// Reçoit les messages envoyés depuis l'app (ex : forcer la mise à jour)
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
