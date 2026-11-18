// Service Worker: hält die App offline verfügbar. Bei neuer Version CACHE hochzählen.
const CACHE = 'thors-bibliothek-v1.4.1';
const COVERS = 'thors-bibliothek-cover'; // bleibt über App-Versionen erhalten
const FILES = ['./', 'index.html', 'css/app.css', 'css/app2.css', 'js/data.js', 'js/isbn.js', 'js/map.js', 'js/kindle.js', 'js/app.js',
  'vendor/d3.min.js', 'vendor/zxing.min.js', 'vendor/jszip.min.js', 'manifest.webmanifest', 'icons/icon-192-v2.png', 'icons/icon-512-v2.png', 'icons/apple-touch-icon-v2.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== COVERS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Cover-Bilder anderer Server: einmal laden, dann aus dem Zwischenspeicher (auch offline)
  if (url.origin !== location.origin && e.request.destination === 'image') {
    e.respondWith(caches.open(COVERS).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok || r.type === 'opaque') c.put(e.request, r.clone());
      return r;
    }))));
    return;
  }
  if (url.origin !== location.origin) return; // ISBN-Abfragen gehen direkt ins Netz
  // App-Dateien: zuerst Netz (für Updates), sonst Cache (offline)
  // no-cache: am Server nachfragen statt die 10-Minuten-Zwischenspeicherung von GitHub Pages zu nutzen
  const req = e.request.mode === 'navigate' ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request, { cache: 'no-cache' });
  e.respondWith(req.then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
