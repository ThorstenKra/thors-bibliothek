// Internetzugriff: im Modus „nur auf Anweisung“ (Standard) holt die App nichts von selbst aus dem Netz.
// Der Service Worker liest die Einstellung aus dem Cache „thors-bibliothek-einstellungen“ und
//  – liefert App-Dateien aus dem Zwischenspeicher (Updates nur über „Nach Update suchen“),
//  – lädt fremde Cover-Bilder nicht nach (fehlende Cover zeigen den Farbumschlag).
// Abrufe, die du ausdrücklich auslöst (Knöpfe mit 🌐), laufen über Netz.ladeCover bzw. fetch.
'use strict';
const Netz = {
  STORE: 'thors-bibliothek-einstellungen', KEY: './__netz', COVERS: 'thors-bibliothek-cover',
  manuell: true,
  async init() {
    try { this.manuell = localStorage.getItem('bb_netz') !== 'auto'; } catch (e) {}
    await this.sync();
  },
  async set(manuell) {
    this.manuell = manuell;
    try { localStorage.setItem('bb_netz', manuell ? 'manuell' : 'auto'); } catch (e) {}
    await this.sync();
  },
  async sync() {
    try { const c = await caches.open(this.STORE); await c.put(this.KEY, new Response(this.manuell ? 'manuell' : 'auto')); } catch (e) {}
  },
  extern: url => /^https?:\/\//.test(url || '') && !String(url).startsWith(location.origin),
  async hatCover(url) { try { return !!(await (await caches.open(this.COVERS)).match(url)); } catch (e) { return false; } },
  // Cover ausdrücklich laden und für später (auch offline) speichern
  async ladeCover(urls, fortschritt) {
    const c = await caches.open(this.COVERS); let ok = 0, i = 0;
    for (const u of urls) {
      i++;
      try {
        if (await c.match(u)) ok++;
        else { const r = await fetch(u, { mode: 'no-cors', referrerPolicy: 'no-referrer' }); if (r.ok || r.type === 'opaque') { await c.put(u, r); ok++; } }
      } catch (e) {}
      if (fortschritt) fortschritt(i, urls.length);
    }
    return ok;
  },
  async fehlendeCover(books) {
    const c = await caches.open(this.COVERS), out = [];
    for (const b of books) if (Netz.extern(b.cv) && !(await c.match(b.cv))) out.push(b.cv);
    return [...new Set(out)];
  },
};
