// Service Worker: hält die App offline verfügbar. Bei neuer Version CACHE hochzählen.
const CACHE = 'thors-bibliothek-v1.8.0';
const COVERS = 'thors-bibliothek-cover'; // bleibt über App-Versionen erhalten
const STORE = 'thors-bibliothek-einstellungen'; // Einstellung „Internet nur auf Anweisung“ (js/netz.js)
// Standard: nur auf Anweisung. Nur wenn ausdrücklich „auto“ gespeichert ist, darf der Worker selbst ins Netz.
const manuell = () => caches.open(STORE).then(c => c.match('./__netz')).then(r => r ? r.text() : 'manuell').then(t => t !== 'auto').catch(() => true);
const FILES = ['./', 'index.html', 'css/app.css', 'css/app2.css', 'js/data.js', 'js/isbn.js', 'js/map.js', 'js/kindle.js', 'js/pruefung.js', 'js/netz.js', 'js/app.js',
  'vendor/d3.min.js', 'vendor/zxing.min.js', 'vendor/jszip.min.js', 'manifest.webmanifest', 'icons/icon-192-v2.png', 'icons/icon-512-v2.png', 'icons/apple-touch-icon-v2.png'];

self.addEventListener('install', e => {
  // cache: 'reload' – frische Dateien vom Server, nicht aus dem Browser-Zwischenspeicher
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== COVERS && k !== STORE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Cover-Bilder anderer Server: einmal laden, dann aus dem Zwischenspeicher (auch offline)
  if (url.origin !== location.origin && e.request.destination === 'image') {
    // Im Modus „nur auf Anweisung“ nichts nachladen: fehlendes Cover → Farbumschlag
    e.respondWith(caches.open(COVERS).then(c => c.match(e.request).then(hit => hit || manuell().then(m => m ? new Response('', { status: 404 }) :
      fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; })))));
    return;
  }
  if (url.origin !== location.origin) return; // ISBN-Abfragen gehen direkt ins Netz
  // App-Dateien. „Nur auf Anweisung“: aus dem Zwischenspeicher (Netz nur, wenn eine Datei fehlt);
  // neue Versionen kommen über „Nach Update suchen“. Sonst: zuerst Netz (für Updates), dann Cache.
  // no-cache: am Server nachfragen statt die 10-Minuten-Zwischenspeicherung von GitHub Pages zu nutzen
  const netz = () => (e.request.mode === 'navigate' ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request, { cache: 'no-cache' })).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  });
  const cache = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : null));
  e.respondWith(manuell().then(m => m
    ? cache().then(r => r || netz())
    : netz().catch(() => cache())));
});
