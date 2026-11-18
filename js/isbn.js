// ISBN: Prüfen, Umrechnen, Nachschlagen bei freien Buchdatenbanken, Barcode-Scan per Kamera.
'use strict';

const ISBN = {
  clean(s) { return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase(); },
  valid13(s) {
    if (!/^\d{13}$/.test(s)) return false;
    const sum = [...s].reduce((t, d, i) => t + (+d) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  },
  valid10(s) {
    if (!/^\d{9}[\dX]$/.test(s)) return false;
    const sum = [...s].reduce((t, d, i) => t + (d === 'X' ? 10 : +d) * (10 - i), 0);
    return sum % 11 === 0;
  },
  to13(s) {
    s = ISBN.clean(s);
    if (ISBN.valid13(s)) return s;
    if (ISBN.valid10(s)) {
      const b = '978' + s.slice(0, 9);
      const c = (10 - [...b].reduce((t, d, i) => t + (+d) * (i % 2 ? 3 : 1), 0) % 10) % 10;
      return b + c;
    }
    return null;
  },

  LANG: { de: 'Deutsch', ger: 'Deutsch', en: 'Englisch', eng: 'Englisch', es: 'Spanisch', spa: 'Spanisch', fr: 'Französisch', fre: 'Französisch', ro: 'Rumänisch', rum: 'Rumänisch', it: 'Italienisch', ita: 'Italienisch' },

  async fetchJSON(url, ms = 8000) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) return null; return await r.json(); }
    catch (e) { return null; } finally { clearTimeout(t); }
  },

  // Liefert ein Teil-Buchobjekt oder null. Braucht Internet, aber kein Claude.
  async lookup(isbn) {
    const out = { i: isbn };
    const g = await ISBN.fetchJSON(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const v = g && g.items && g.items[0] && g.items[0].volumeInfo;
    if (v) {
      Object.assign(out, {
        t: v.title || '', s: v.subtitle || '', a: (v.authors || []).join(', '), p: v.publisher || '',
        y: (v.publishedDate || '').slice(0, 4), pg: v.pageCount ? String(v.pageCount) : '',
        l: ISBN.LANG[v.language] || v.language || '', su: v.description || '', g: (v.categories || [])[0] || '',
        cv: ((v.imageLinks || {}).thumbnail || '').replace(/^http:/, 'https:').replace('&edge=curl', ''),
      });
    }
    if (!out.t || !out.a || !out.pg || !out.p) {
      const o = await ISBN.fetchJSON(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const d = o && o[`ISBN:${isbn}`];
      if (d) {
        out.t = out.t || d.title || ''; out.s = out.s || d.subtitle || '';
        out.a = out.a || (d.authors || []).map(x => x.name).join(', ');
        out.p = out.p || ((d.publishers || [])[0] || {}).name || '';
        out.y = out.y || ((d.publish_date || '').match(/\d{4}/) || [''])[0];
        out.pg = out.pg || (d.number_of_pages ? String(d.number_of_pages) : '');
        out.cv = out.cv || ((d.cover || {}).medium || '').replace(/^http:/, 'https:');
      }
    }
    return out.t ? out : null;
  },

  // ---------- Scanner ----------
  _reader: null,
  async startScan(videoEl, onCode) {
    if (!window.ZXing) throw new Error('Scanner-Bibliothek nicht geladen.');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Kamera wird von diesem Browser nicht unterstützt.');
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    ISBN._reader = new ZXing.BrowserMultiFormatReader(hints, 300);
    let done = false;
    await ISBN._reader.decodeFromConstraints({ video: { facingMode: 'environment', width: { ideal: 1280 } } }, videoEl, (res) => {
      if (!res || done) return;
      const code = ISBN.to13(res.getText());
      if (code && /^97[89]/.test(code)) { done = true; ISBN.stopScan(); onCode(code); }
    });
  },
  stopScan() { try { ISBN._reader && ISBN._reader.reset(); } catch (e) {} ISBN._reader = null; },
};
