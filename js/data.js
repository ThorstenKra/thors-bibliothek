// Datenhaltung: IndexedDB auf dem Gerät, Import/Export als offenes JSON- bzw. CSV-Format.
// Keine Abhängigkeit von Claude oder einem Server.
'use strict';

const DB_NAME = 'thors-bibliothek';
const DB_VERSION = 1;
const FORMAT = 'thors-bibliothek';
const FORMAT_VERSION = 1;

let _db = null;
function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}
function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

const Data = {
  async allBooks() { return tx('books', 'readonly', s => reqP(s.getAll())); },
  async putBooks(list) { return tx('books', 'readwrite', s => { list.forEach(b => s.put(b)); }); },
  async clearBooks() { return tx('books', 'readwrite', s => s.clear()); },
  async getMeta(key, fallback) {
    const v = await tx('meta', 'readonly', s => reqP(s.get(key)));
    return v === undefined ? fallback : v;
  },
  async setMeta(key, value) { return tx('meta', 'readwrite', s => s.put(value, key)); },

  newId() { return 'b-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); },
  now() { return new Date().toISOString(); },
  today() { return new Date().toISOString().slice(0, 10); },

  // ---------- Änderungen protokollieren ----------
  async log(art, text) {
    const h = await Data.getMeta('historie', []);
    h.push({ datum: Data.today(), art, text });
    await Data.setMeta('historie', h);
  },
  async logChange(row) { // [Art, Titel, Autor, Änderung, Datum]
    const a = await Data.getMeta('aenderungen', []);
    a.push(row);
    await Data.setMeta('aenderungen', a);
    await Data.setMeta('ungesichert', (await Data.getMeta('ungesichert', 0)) + 1);
  },

  // ---------- Sicherung ----------
  async exportObject() {
    return {
      format: FORMAT, version: FORMAT_VERSION, exportiert: Data.now(),
      geraet: navigator.userAgent.includes('iPad') ? 'iPad' : navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Desktop',
      buecher: await Data.allBooks(),
      historie: await Data.getMeta('historie', []),
      aenderungen: await Data.getMeta('aenderungen', []),
    };
  },

  // Zusammenführen: pro Buch gewinnt der neuere Stand (Feld u). Gelöschte Bücher bleiben als
  // Markierung (del) erhalten, damit sich Löschungen über Sicherungsdateien auf andere Geräte übertragen.
  async importObject(obj, mode = 'merge') {
    if (obj && obj.format === FORMAT && obj.typ === 'ergaenzung') return Data.importSupplement(obj);
    if (!obj || obj.format !== FORMAT || !Array.isArray(obj.buecher)) throw new Error('Keine gültige Sicherungsdatei von Thors Bibliothek.');
    if (obj.version > FORMAT_VERSION) throw new Error('Die Datei stammt aus einer neueren App-Version. Bitte die App aktualisieren.');
    const cur = mode === 'replace' ? [] : await Data.allBooks();
    const byId = new Map(cur.map(b => [b.id, b]));
    let neu = 0, aktualisiert = 0;
    const put = [];
    for (const b of obj.buecher) {
      const c = byId.get(b.id);
      if (!c) { put.push(b); neu++; }
      else if ((b.u || '') > (c.u || '')) { put.push(b); aktualisiert++; }
    }
    if (mode === 'replace') await Data.clearBooks();
    await Data.putBooks(put);
    // Historie und Änderungen: vereinigen, Dubletten vermeiden
    const merge = async (key, rows, keyFn) => {
      const have = mode === 'replace' ? [] : await Data.getMeta(key, []);
      const seen = new Set(have.map(keyFn));
      for (const r of rows || []) if (!seen.has(keyFn(r))) { have.push(r); seen.add(keyFn(r)); }
      await Data.setMeta(key, have);
    };
    await merge('historie', obj.historie, r => JSON.stringify(r));
    await merge('aenderungen', obj.aenderungen, r => JSON.stringify(r));
    return { neu, aktualisiert, gesamt: obj.buecher.length };
  },

  // Ergänzungsdatei: füllt nur leere Felder vorhandener Bücher (eigene Änderungen bleiben unberührt).
  // Optional „aendern“: { id: { feld: { von, nach } } } ändert ein gefülltes Feld gezielt – aber nur,
  // wenn es noch genau den Wert „von“ hat. Hat Thor das Feld inzwischen selbst geändert, bleibt es.
  async importSupplement(obj) {
    const books = await Data.allBooks(); const byId = new Map(books.map(b => [b.id, b]));
    const put = new Map(); const now = Data.now(); const same = (x, y) => JSON.stringify(x ?? '') === JSON.stringify(y ?? '');
    let geaendert = 0, uebersprungen = 0;
    for (const [id, fields] of Object.entries(obj.felder || {})) {
      const b = byId.get(id); if (!b || b.del) continue;
      let ch = false;
      // leer = nicht gesetzt; „Ohne Kategorie“ zählt bei der Kategorie ebenfalls als leer
      for (const [k, v] of Object.entries(fields)) if (v && (!b[k] || (Array.isArray(b[k]) && !b[k].length) || (k === 'c' && b[k] === 'Ohne Kategorie'))) { b[k] = v; ch = true; }
      if (ch) { b.u = now; put.set(id, b); }
    }
    const NAMES = { c: 'Kategorie', ge: 'Genre', a: 'Autor', ue: 'Übersetzer/Hrsg.', st: 'Status', fm: 'Format', tg: 'Tags', tt: 'Themen', kd: 'Auch auf Kindle', ka: 'Kindle-ASIN', kdf: 'Auf Kindle beendet', km: 'Kindle-Markierungen', kn: 'Kindle-Notizen', del: 'Gelöscht' };
    for (const [id, fields] of Object.entries(obj.aendern || {})) {
      const b = byId.get(id); if (!b || b.del) continue;
      for (const [k, d] of Object.entries(fields)) {
        if (!d || !('nach' in d)) continue;
        if (same(b[k], d.nach)) continue;               // schon erledigt (Datei zweimal geladen)
        if (!same(b[k], d.von)) { uebersprungen++; continue; } // inzwischen selbst geändert
        b[k] = d.nach; b.u = now; put.set(id, b); geaendert++;
        const fmt = v => Array.isArray(v) ? (v.length ? v.length + ' Einträge' : '—') : v === true || v === 1 ? 'ja' : (v === '' || v == null ? '—' : v);
        await Data.logChange(k === 'del' ? ['Gelöscht', b.t, b.a, 'gelöscht (Ergänzung)', Data.today()] : ['Bearbeitet', b.t, b.a, `${NAMES[k] || k}: ${fmt(d.von)} → ${fmt(d.nach)} (Ergänzung)`, Data.today()]);
      }
    }
    await Data.putBooks([...put.values()]);
    return { neu: 0, aktualisiert: put.size, geaendert, uebersprungen, gesamt: Object.keys(obj.felder || {}).length + Object.keys(obj.aendern || {}).length, ergaenzung: true };
  },

  // CSV im Stil des BookBuddy-Exports (lesbar in Numbers/Excel)
  async exportCSV() {
    const cols = [['Title', 't'], ['Subtitle', 's'], ['Author', 'a'], ['Übersetzer/Herausgeber', 'ue'], ['Publisher', 'p'], ['Year Published', 'y'],
      ['Kategorie', 'c'], ['Genre', 'ge'], ['Genre (BookBuddy)', 'g'], ['Tags', 'tg'], ['Vorgeschlagene Tags', 'ts'], ['Themen', 'tt'],
      ['Language', 'l'], ['Number of Pages', 'pg'], ['ISBN', 'i'], ['Status', 'st'], ['Rating', 'r'],
      ['Date Started', 'ds'], ['Date Finished', 'df'], ['Date Added', 'da'], ['Format', 'fm'], ['Auch auf Kindle', 'kd'], ['Kindle-ASIN', 'ka'],
      ['Standort', 'loc'], ['Cover', 'cv'], ['Verliehen an', 'lendTo'], ['Verliehen seit', 'lendSince'], ['Summary', 'su'], ['Notes', 'n'], ['Kindle-Notizen', 'kn']];
    const esc = v => { const s = Array.isArray(v) ? v.join(', ') : v === true ? 'ja' : (v ?? '') + ''; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const books = (await Data.allBooks()).filter(b => !b.del);
    return '﻿' + [cols.map(c => c[0]).join(',')].concat(books.map(b => cols.map(c => esc(b[c[1]])).join(','))).join('\n');
  },

  // Datei an den Nutzer geben: auf iPad/iPhone über das Teilen-Menü ("In Dateien sichern" → iCloud Drive)
  async saveFile(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return 'geteilt'; }
      catch (e) { if (e.name === 'AbortError') return 'abgebrochen'; }
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'heruntergeladen';
  },

  async persist() {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
    return false;
  },
};
