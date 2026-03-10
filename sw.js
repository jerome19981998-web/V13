// CinéMatch Service Worker
const CACHE = 'cinematch-v1';

// Ressources à mettre en cache au démarrage
const PRECACHE = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Outfit:wght@300;400;500;600&display=swap',
];

// Installation — mise en cache des ressources statiques
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activation — nettoyage des anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — stratégie Network First pour l'app, Cache First pour les fonts
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Toujours réseau pour Supabase (données temps réel)
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('tmdb.org') ||
      url.hostname.includes('image.tmdb.org')) {
    return; // pas de cache pour les APIs
  }

  // Cache First pour les fonts Google
  if (url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('fonts.googleapis.com')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Network First pour l'app — fallback cache si hors-ligne
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Mettre à jour le cache avec la nouvelle version
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        // Fallback hors-ligne
        return new Response(
          `<!DOCTYPE html><html><head><meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>body{background:#07070f;color:#e8e0d4;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;flex-direction:column;gap:16px;}
          </style></head><body>
          <div style="font-size:48px">🎬</div>
          <div style="font-size:20px;font-weight:600">CinéMatch</div>
          <div style="font-size:14px;opacity:.6">Pas de connexion internet.<br>Reconnecte-toi pour accéder à l'app.</div>
          </body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }))
  );
});
