// Service Worker: hält die App offline verfügbar. Bei neuer Version CACHE hochzählen.
const CACHE = 'thors-bibliothek-v1.0.0';
const FILES = ['./', 'index.html', 'css/app.css', 'css/app2.css', 'js/data.js', 'js/isbn.js', 'js/map.js', 'js/app.js',
  'vendor/d3.min.js', 'vendor/zxing.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // ISBN-Abfragen gehen direkt ins Netz
  // App-Dateien: zuerst Netz (für Updates), sonst Cache (offline)
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
