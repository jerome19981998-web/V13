// CinéMatch Service Worker — auto-update
const CACHE = 'cinematch-v2';
const PRECACHE = [
  '/',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        self.clients.matchAll({type:'window'}).then(clients => {
          clients.forEach(client => client.postMessage({type:'SW_UPDATED'}));
        });
      })
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(url.hostname.includes('supabase.co') ||
     url.hostname.includes('tmdb.org') ||
     url.hostname.includes('image.tmdb.org')){
    return;
  }
  if(url.hostname.includes('fonts.gstatic.com') ||
     url.hostname.includes('fonts.googleapis.com')){
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
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if(res.ok && e.request.method === 'GET'){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if(cached) return cached;
        return new Response(
          `<!DOCTYPE html><html><head><meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>body{background:#07070f;color:#e8e0d4;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;flex-direction:column;gap:16px;}</style>
          </head><body>
          <div style="font-size:48px">🎬</div>
          <div style="font-size:20px;font-weight:600">CinéMatch</div>
          <div style="font-size:14px;opacity:.6">Pas de connexion.<br>Reconnecte-toi pour accéder à l'app.</div>
          </body></html>`,
          {headers:{'Content-Type':'text/html'}}
        );
      }))
  );
});

self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
