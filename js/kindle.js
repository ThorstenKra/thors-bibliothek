// Kindle-Abgleich: liest den Amazon-Datenexport (ZIP aus „Meine Daten anfordern“ → Kindle) direkt im Browser
// und gleicht ihn mit der Bibliothek ab. Braucht weder Claude noch einen Server.
'use strict';

const Kindle = {
  // ---------- CSV (mit Anführungszeichen und Zeilenumbrüchen in Feldern) ----------
  parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    const head = rows.shift() || [];
    return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  },

  clean(name) {
    return String(name || '').replace(/\s*\((German|English|Spanish|French) Edition\)\s*$/, '')
      .replace(/\s*\([^)]*(Reihe|Classics|Taschenbuch|Bibliothek|Edition|Landmark)[^)]*\)\s*/g, ' ').trim();
  },
  language(name) {
    const m = String(name).match(/\((German|English|Spanish|French) Edition\)/);
    if (m) return { German: 'Deutsch', English: 'Englisch', Spanish: 'Spanisch', French: 'Französisch' }[m[1]];
    const w = new Set(String(name).toLowerCase().match(/[a-záéíóúñàèçâêîôû']+/g) || []);
    const any = l => l.some(x => w.has(x));
    if (any(['the', 'of', 'and', 'complete', 'works', 'book', 'volume', 'our', 'dream', 'stories'])) return 'Englisch';
    if (any(['el', 'los', 'las', 'cuentos', 'obras', 'del', 'novelas', 'rimas', 'vida', 'sueño', 'quién', 'conquista'])) return 'Spanisch';
    if (any(['le', 'les', 'histoires', 'trois', 'petit', 'soir'])) return 'Französisch';
    return 'Deutsch';
  },
  n(s) { return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); },
  mainTitle(t) { return Kindle.n(String(t || '').split(/:| - | – |\. /)[0]); },
  TRANS: { tolstoy: 'tolstoj', tolstoi: 'tolstoj', dostojewski: 'dostoevskij', dostoevsky: 'dostoevskij' },
  names(a) { return new Set(Kindle.n(a).split(' ').filter(w => w.length > 3).map(w => Kindle.TRANS[w] || w)); },
  band(t) { return (Kindle.n(t).match(/band\s*(\d+)/g) || []).join('|'); },
  author(a) { // Kindle: „Nachname, Vorname“ → „Vorname Nachname“
    a = String(a || '').trim();
    const p = a.split(','); return p.length === 2 ? (p[1].trim() + ' ' + p[0].trim()).trim() : a;
  },
  similar(a, b) { // Ähnlichkeit 0..1 (Levenshtein), nur für kurze Haupttitel
    if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) * .15) return 0;
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
    }
    return 1 - d[b.length] / Math.max(a.length, b.length);
  },

  // ---------- ZIP lesen ----------
  async readExport(files, onStep) {
    const entries = [];
    for (const f of files) {
      const zip = await JSZip.loadAsync(f);
      zip.forEach((path, e) => { if (!e.dir) entries.push({ path, e }); });
    }
    const find = re => entries.filter(x => re.test(x.path));
    const text = x => x.e.async('string');
    onStep && onStep('Bibliothek lesen …');
    const rows = [];
    for (const x of find(/Digital\.Content\.Ownership\/[^/]+\.json$/)) {
      for (const d of JSON.parse(await text(x))) {
        const r = d.resource || {};
        if (r.resourceType !== 'KindleEBook') continue;
        for (const rt of d.rights || []) {
          const o = (rt.origin || {}).originType;
          if (o === 'KindleDictionary' || o === 'KindleUserGuide') continue;
          rows.push({ asin: r.ASIN, name: r['Product Name'] || '', origin: o, status: rt.rightStatus, acq: (rt.acquiredDate || '').slice(0, 10) });
        }
      }
    }
    if (!rows.length) throw new Error('In der Datei wurden keine Kindle-Bücher gefunden. Bitte die ZIP-Datei aus „Meine Daten anfordern“ → Kindle wählen.');
    rows.sort((a, b) => (b.status === 'Active') - (a.status === 'Active') || b.acq.localeCompare(a.acq));
    const byAsin = new Map(); rows.forEach(r => { if (!byAsin.has(r.asin)) byAsin.set(r.asin, r); });

    onStep && onStep('Gelesene Bücher …');
    const done = {};
    for (const x of find(/UserUniqueTitlesCompleted[^/]*\.csv$/))
      for (const r of Kindle.parseCSV(await text(x))) {
        const p = String(Object.values(r)[0] || '').split('_');
        if (p.length >= 2 && (!done[p[0]] || p[1] > done[p[0]])) done[p[0]] = p[1];
      }
    onStep && onStep('Markierungen und Notizen …');
    const hl = {}, notes = {};
    for (const x of find(/whispersync\.csv$/))
      for (const r of Kindle.parseCSV(await text(x))) {
        if (r['Is Deleted'] === 'Yes') continue;
        if (r['Annotation Type'] === 'kindle.highlight') (hl[r.ASIN] = hl[r.ASIN] || new Set()).add(r['Creation Date']);
        if (r['Annotation Type'] === 'kindle.note' && r.Note && r.Note !== 'Not Available') {
          const l = notes[r.ASIN] = notes[r.ASIN] || []; if (!l.includes(r.Note)) l.push(r.Note);
        }
      }
    const auth = {};
    for (const x of find(/AuthorNameRelationship[^/]*\.csv$/))
      for (const r of Kindle.parseCSV(await text(x))) if (r['Author Name'] && r['Author Name'] !== 'Not Available' && !auth[r.ASIN]) auth[r.ASIN] = r['Author Name'];

    return [...byAsin.values()].map(r => ({
      asin: r.asin, titel: Kindle.clean(r.name), original: r.name, autor: auth[r.asin] || '', sprache: Kindle.language(r.name),
      herkunft: r.origin, status: r.status, erworben: r.acq, beendet: done[r.asin] || '',
      markierungen: hl[r.asin] ? hl[r.asin].size : 0, notizen: notes[r.asin] || [],
    }));
  },

  // ---------- Abgleich: was würde sich ändern? ----------
  plan(kindle, all) {
    const live = all.filter(b => !b.del);
    const byKa = new Map(); live.forEach(b => { if (b.ka) byKa.set(b.ka, b); });
    const ids = new Set(all.map(b => b.id));
    const idx = new Map(); live.forEach(b => { const k = Kindle.mainTitle(b.t); if (!idx.has(k)) idx.set(k, []); idx.get(k).push(b); });
    const keys = [...idx.keys()];
    const upd = new Map(); const neu = []; const seenNew = new Set();
    const change = (b, f, v) => { const u = upd.get(b.id) || { b, set: {}, why: [] }; u.set[f] = v; upd.set(b.id, u); return u; };
    for (const x of kindle) {
      if (x.status !== 'Active') continue;
      let hit = byKa.has(x.asin) ? [byKa.get(x.asin)] : [];
      if (!hit.length) {
        const mt = Kindle.mainTitle(x.titel), ks = Kindle.names(x.autor);
        let cand = idx.get(mt) || [];
        if (!cand.length && mt.length > 6) {
          let best = null, s = 0; for (const k of keys) { if (k.slice(0, 4) !== mt.slice(0, 4)) continue; const v = Kindle.similar(mt, k); if (v > s) { s = v; best = k; } }
          if (s >= .88) cand = idx.get(best);
        }
        hit = cand.filter(b => [...ks].some(w => Kindle.names(b.a).has(w)) && Kindle.band(x.original) === Kindle.band(b.t));
        if (!hit.length && cand.length && !ks.size) hit = cand;
      }
      if (hit.length) {
        for (const b of hit) {
          if (!b.kd) change(b, 'kd', 1).why.push('auch auf Kindle');
          if (!b.ka) change(b, 'ka', x.asin);
          // mehrere Kindle-Ausgaben können zu einem Buch gehören: nur „mehr“ bzw. „später“ übernehmen
          const cur = upd.get(b.id)?.set || {};
          if (x.beendet && x.beendet > (cur.kdf || b.kdf || '')) change(b, 'kdf', x.beendet);
          if (x.markierungen > (cur.km || b.km || 0)) change(b, 'km', x.markierungen);
          const newNotes = x.notizen.filter(n => !(b.kn || []).includes(n));
          if (newNotes.length) change(b, 'kn', [...(b.kn || []), ...newNotes]).why.push(`${newNotes.length} neue Kindle-Notiz${newNotes.length > 1 ? 'en' : ''}`);
          if (x.beendet && !['Gelesen', 'Abgebrochen'].includes(b.st)) {
            const u = change(b, 'st', 'Gelesen'); u.set.stk = 1; if (!b.df) u.set.df = x.beendet;
            u.why.push(`Status ${b.st} → Gelesen (auf Kindle beendet ${x.beendet.split('-').reverse().join('.')})`);
          }
        }
        continue;
      }
      if (x.herkunft !== 'Purchase' || ids.has('kd-' + x.asin)) continue;
      const dk = Kindle.mainTitle(x.titel) + '|' + Kindle.band(x.original) + '|' + Kindle.n(x.autor);
      if (seenNew.has(dk)) continue; seenNew.add(dk);
      let t = x.titel; for (let i = 0; i < 3; i++) t = t.replace(/\s*[([][^)\]]*[)\]]\s*$/, '').trim();
      let s = ''; const p = t.indexOf(': '); if (p > 0) { s = t.slice(p + 2).trim(); t = t.slice(0, p).trim(); }
      neu.push({ id: 'kd-' + x.asin, t, s, a: Kindle.author(x.autor) || 'Unbekannt', al: x.autor, c: 'Ohne Kategorie', tg: [], l: x.sprache,
        st: x.beendet ? 'Gelesen' : 'Ungelesen', r: 0, df: x.beendet, da: x.erworben, fm: 'Kindle', kd: 1, ka: x.asin,
        km: x.markierungen || 0, kn: x.notizen, kdf: x.beendet,
        cv: `https://m.media-amazon.com/images/P/${x.asin}.01._SCLZZZZZZZ_.jpg` });
    }
    return { updates: [...upd.values()], neu };
  },
};
