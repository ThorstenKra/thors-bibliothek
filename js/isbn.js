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
  // Eigene Schleife statt ZXing.decodeFromConstraints: Die eingebaute Videoschleife erkannte nichts
  // (Zeichenfläche wurde vor dem Laden des Videos angelegt). Wir lesen alle 200 ms ein Bild aus dem
  // Video, schneiden den mittleren Streifen aus und dekodieren ihn. Wo der Browser einen eigenen
  // Barcode-Erkenner hat (BarcodeDetector), wird der zuerst benutzt.
  _stream: null, _timer: null,
  _hints() {
    const h = new Map();
    h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A]);
    h.set(ZXing.DecodeHintType.TRY_HARDER, true);
    return h;
  },
  _decodeCanvas(canvas, reader) {
    try {
      const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(canvas)));
      return reader.decode(bmp).getText();
    } catch (e) { return null; } finally { try { reader.reset(); } catch (e) {} }
  },
  _isbnFrom(text) { const c = ISBN.to13(text); return c && /^97[89]/.test(c) ? c : null; },

  async startScan(videoEl, onCode) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Kamera wird von diesem Browser nicht unterstützt (HTTPS nötig).');
    const native = ('BarcodeDetector' in window) ? await BarcodeDetector.getSupportedFormats().then(f => f.includes('ean_13') ? new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] }) : null).catch(() => null) : null;
    if (!native && !window.ZXing) throw new Error('Scanner-Bibliothek nicht geladen – App bitte neu öffnen.');
    ISBN.stopScan();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    ISBN._stream = stream;
    videoEl.setAttribute('playsinline', ''); videoEl.muted = true; videoEl.srcObject = stream;
    await videoEl.play().catch(() => {});
    const reader = window.ZXing ? new ZXing.MultiFormatReader() : null;
    if (reader) reader.setHints(ISBN._hints());
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    let busy = false, done = false;
    const tick = async () => {
      if (done || busy || !ISBN._stream) return;
      const w = videoEl.videoWidth, h = videoEl.videoHeight; if (!w || !h) return;
      busy = true;
      try {
        let text = null;
        if (native) { const r = await native.detect(videoEl).catch(() => []); text = r[0] && r[0].rawValue; }
        if (!text && reader) {
          // mittlerer Streifen (wo die rote Linie ist), auf höchstens 1000 px Breite verkleinert
          const sx = w * .05, sw = w * .9, sy = h * .25, sh = h * .5, k = Math.min(1, 1000 / sw);
          canvas.width = Math.round(sw * k); canvas.height = Math.round(sh * k);
          ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          text = ISBN._decodeCanvas(canvas, reader);
        }
        const code = text && ISBN._isbnFrom(text);
        if (code) { done = true; ISBN.stopScan(); if (navigator.vibrate) navigator.vibrate(60); onCode(code); }
      } finally { busy = false; }
    };
    ISBN._timer = setInterval(tick, 200);
  },
  stopScan() {
    clearInterval(ISBN._timer); ISBN._timer = null;
    if (ISBN._stream) ISBN._stream.getTracks().forEach(t => t.stop());
    ISBN._stream = null;
  },

  // Ersatzweg: Foto des Barcodes (Kamera-App des Geräts, mit Autofokus) auswerten
  async scanImageFile(file) {
    if (!window.ZXing) throw new Error('Scanner-Bibliothek nicht geladen – App bitte neu öffnen.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const reader = new ZXing.MultiFormatReader(); reader.setHints(ISBN._hints());
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
      // mehrere Größen probieren: Handyfotos sind groß, Barcodes manchmal klein im Bild
      for (const max of [1600, 1000, 2400]) {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * k); canvas.height = Math.round(img.height * k);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const code = ISBN._isbnFrom(ISBN._decodeCanvas(canvas, reader) || '');
        if (code) return code;
      }
      return null;
    } finally { URL.revokeObjectURL(url); }
  },
};
