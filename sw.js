// MyTracc Service Worker v4
// Red primero: con conexión siempre se carga la última versión publicada; la
// copia guardada solo se usa sin conexión. Las peticiones a otros dominios
// (Supabase, fuentes, CDN) no pasan por aquí.
const CACHE_NAME = 'mytracc-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// ── INSTALL: guardar copia para usar sin conexión ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: red primero, copia guardada si no hay conexión ──
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req).then(cached =>
        cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
      )
    )
  );
});

// ── TIMER: mensaje desde la app para programar notificación ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_TIMER') {
    const { seconds, exerciseName } = e.data;
    setTimeout(() => {
      self.registration.showNotification('¡Descanso terminado! 💪', {
        body: exerciseName ? 'Siguiente serie: ' + exerciseName : 'A por la siguiente serie',
        vibrate: [200, 100, 200],
        tag: 'timer-end',
        renotify: true,
        requireInteraction: false,
        silent: false
      });
    }, seconds * 1000);
  }

  if (e.data && e.data.type === 'CANCEL_TIMER') {
    // No hay forma de cancelar un setTimeout desde SW directamente
  }
});

// ── NOTIFICATION CLICK: abrir la app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});
