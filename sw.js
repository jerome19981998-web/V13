// CinéMatch Service Worker v1
// Gère: Push notifications, offline cache, background sync

const CACHE = 'cinematch-v1';
const OFFLINE_URLS = ['/'];

// ─── Install & cache ─────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch: réseau d'abord, cache si offline ─────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return; // pas de cache pour les API

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Mettre en cache les assets statiques
        if (res.ok && (e.request.url.includes('.js') || e.request.url.includes('.css') || e.request.url === self.location.origin + '/')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'CinéMatch', body: 'Nouvelle notification', icon: '/icon-192.png', badge: '/icon-96.png', data: {} };
  
  try {
    const payload = e.data?.json();
    data = { ...data, ...payload };
  } catch (_) {
    data.body = e.data?.text() || data.body;
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-96.png',
    image: data.image,
    vibrate: [200, 100, 200],
    tag: data.tag || 'cinematch-' + Date.now(),
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: { url: data.url || '/', ...data.data },
    actions: data.actions || [],
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── Clic sur notification ────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si l'app est déjà ouverte → focus + navigation
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      return clients.openWindow(url);
    })
  );
});

// ─── Background sync (retry envoi message si offline) ────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-messages') {
    e.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  // Les messages en attente sont stockés dans IndexedDB par l'app
  // Le SW les renvoie quand la connexion revient
  const clients_list = await clients.matchAll();
  clients_list.forEach(c => c.postMessage({ type: 'SYNC_MESSAGES' }));
}
