// Datenprüfung: findet typische Unstimmigkeiten im Bestand und bietet einfache Bereinigungen an.
// Läuft komplett in der App (ohne Claude). Jede Bereinigung geht über saveBook → Änderungsliste.
'use strict';

const Pruefung = {
  // Schlüssel für eine Person: Nachname + erster Buchstabe des Vornamens, ohne Akzente, Punkte, Klammern
  key(p) {
    const t = norm(p).replace(/\(.*?\)/g, ' ').replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    return t.length ? { sur: t[t.length - 1], ini: t.length > 1 ? t[0][0] : '' } : null;
  },

  // 1. Namensvarianten: gleicher Nachname, gleicher Anfangsbuchstabe (oder nur Nachname), andere Schreibweise
  varianten(books) {
    const cnt = new Map();
    for (const b of books) for (const p of persons(b.a)) cnt.set(p, (cnt.get(p) || 0) + 1);
    const bySur = new Map();
    for (const [p, n] of cnt) { const k = Pruefung.key(p); if (!k || k.sur.length < 3) continue;
      if (!bySur.has(k.sur)) bySur.set(k.sur, []); bySur.get(k.sur).push({ p, n, ini: k.ini }); }
    const groups = [];
    for (const list of bySur.values()) {
      if (list.length < 2) continue;
      // nach Anfangsbuchstaben bündeln; Einträge ohne Vornamen gehören zu jeder Gruppe
      const inis = [...new Set(list.map(x => x.ini).filter(Boolean))];
      const bare = list.filter(x => !x.ini);
      for (const i of (inis.length ? inis : [''])) {
        const g = list.filter(x => x.ini === i).concat(i ? bare : []);
        if (g.length > 1) groups.push(g.sort((a, b) => b.n - a.n));
      }
    }
    return groups.sort((a, b) => b.reduce((s, x) => s + x.n, 0) - a.reduce((s, x) => s + x.n, 0));
  },

  // 2. Mehrere Personen im Autorfeld (oft Übersetzer oder Herausgeber)
  mehrere: books => books.filter(b => persons(b.a).length > 1 || /[,;&]\s*$/.test(b.a || '')),

  // 3. Mögliche Dubletten: gleicher Titel (ohne Satzzeichen) und gleicher Nachname
  dubletten(books) {
    const m = new Map();
    for (const b of books) {
      const t = norm(b.t).replace(/[^\p{L}\p{N}]+/gu, ''); const k = Pruefung.key(persons(b.a)[0] || '');
      if (!t || !k) continue;
      const id = t + '|' + k.sur; if (!m.has(id)) m.set(id, []); m.get(id).push(b);
    }
    return [...m.values()].filter(g => g.length > 1);
  },

  // 4. Ausreißer: Buch in anderer Kategorie als die große Mehrheit (≥ 75 %) der Bücher desselben Autors
  ausreisser(books) {
    const by = new Map();
    for (const b of books) { const p = persons(b.a)[0]; if (!p || p === 'Unbekannt') continue;
      if (!by.has(p)) by.set(p, []); by.get(p).push(b); }
    const out = [];
    for (const [p, list] of by) {
      if (list.length < 4) continue;
      const c = {}; list.forEach(b => c[b.c] = (c[b.c] || 0) + 1);
      const [top, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
      if (n / list.length < .75) continue;
      list.filter(b => b.c !== top).forEach(b => out.push({ b, top, p }));
    }
    return out;
  },

  // 5. Fehlende oder auffällige Angaben
  angaben: books => [
    ['Ohne Kategorie', books.filter(b => !b.c || b.c === 'Ohne Kategorie')],
    ['Autor fehlt oder „Unbekannt“', books.filter(b => !b.a || b.a === 'Unbekannt')],
    ['Autor in GROSSBUCHSTABEN', books.filter(b => /[A-ZÄÖÜ]{3}/.test(b.a || '') && b.a === b.a.toUpperCase())],
    ['Titel in GROSSBUCHSTABEN', books.filter(b => /[A-ZÄÖÜ]{4}/.test(b.t || '') && b.t === b.t.toUpperCase())],
    ['Ohne Sprache', books.filter(b => !b.l)],
  ].filter(x => x[1].length),
};

// ---------- Ansicht ----------
function buildPruefung() {
  const out = $('pruefOut'); if (!out) return;
  // geöffnete Abschnitte merken, damit sie nach einer Bereinigung offen bleiben
  const open = [...out.querySelectorAll('details')].map(d => d.open);
  const V = Pruefung.varianten(B), M = Pruefung.mehrere(B), D = Pruefung.dubletten(B), A = Pruefung.ausreisser(B), F = Pruefung.angaben(B);
  const bk = b => `<button class="lnk" data-open="${esc(b.id)}">${esc(b.t)}</button> <span class="mut">– ${esc(b.a)}${b.fm === 'Kindle' ? ' · Kindle' : ''}</span>`;
  const sec = (title, n, hint, body) => `<details class="pruef"><summary><b>${title}</b> <span class="cnt">${n}</span></summary><p class="hint2">${hint}</p>${body}</details>`;
  out.innerHTML =
    sec('Namensvarianten', V.length, 'Dieselbe Person, unterschiedlich geschrieben. Richtige Schreibweise wählen und vereinheitlichen – auch in Feldern mit mehreren Personen.',
      V.map((g, i) => `<div class="pg"><select data-v="${i}">${g.map(x => `<option value="${esc(x.p)}">${esc(x.p)} (${x.n})</option>`).join('')}</select>
        <button class="btn" data-unify="${i}">Vereinheitlichen</button>
        <span class="mut">${g.map(x => `<button class="lnk" data-author="${esc(x.p)}">${esc(x.p)}</button>`).join(' · ')}</span></div>`).join('')) +
    sec('Mehrere Personen im Autorfeld', M.length, 'Oft stehen Übersetzer oder Herausgeber mit im Autorfeld; dann fehlt das Buch beim Autor. „Rest verschieben“ lässt die erste Person als Autor und trägt die übrigen unter Übersetzer/Herausgeber ein. Echte Mitautoren einfach stehen lassen.',
      `<ul class="klist">${M.map(b => `<li>${bk(b)} <button class="btn sm" data-split="${esc(b.id)}">Rest → Übersetzer/Hrsg.</button></li>`).join('')}</ul>`) +
    sec('Mögliche Dubletten', D.length, 'Gleicher Titel und gleicher Autor. Oft gewollt (gedruckt und Kindle, verschiedene Ausgaben) – sonst eines löschen oder als „auch auf Kindle“ kennzeichnen.',
      `<ul class="klist">${D.map(g => `<li>${g.map(bk).join('<br>')}</li>`).join('')}</ul>`) +
    sec('Kategorie-Ausreißer', A.length, 'Bücher, die anders eingeordnet sind als fast alle anderen Bücher desselben Autors. Kann richtig sein – nur zur Kontrolle.',
      `<ul class="klist">${A.map(x => `<li>${bk(x.b)} <span class="mut">· hier ${esc(x.b.c)}, sonst ${esc(x.top)}</span></li>`).join('')}</ul>`) +
    sec('Fehlende oder auffällige Angaben', F.reduce((s, x) => s + x[1].length, 0), 'Zum Nachtragen in der jeweiligen Buchansicht.',
      F.map(([t, l]) => `<details><summary>${t} <span class="cnt">${l.length}</span></summary><ul class="klist">${l.slice(0, 300).map(b => `<li>${bk(b)}</li>`).join('')}</ul></details>`).join(''));
  out.querySelectorAll('details').forEach((d, i) => { if (open[i]) d.open = true; });
  out.onclick = async e => {
    const o = e.target.closest('[data-open]'); if (o) return openBook(B.find(b => b.id === o.dataset.open));
    const a = e.target.closest('[data-author]'); if (a) { Object.assign(state, { q: '', author: a.dataset.author, cat: '', tag: '', limit: 60 }); $('q').value = ''; drawFilters(); render(); location.hash = 'katalog'; scrollTo({ top: 0 }); return; }
    const u = e.target.closest('[data-unify]');
    if (u) {
      const g = V[+u.dataset.unify], ziel = out.querySelector(`select[data-v="${u.dataset.unify}"]`).value;
      const alt = new Set(g.map(x => x.p).filter(p => p !== ziel));
      const betr = B.filter(b => persons(b.a).some(p => alt.has(p)));
      if (!u.dataset.sure) { u.dataset.sure = '1'; u.textContent = `${betr.length} Bücher auf „${ziel}“ ändern? Nochmal tippen`; return; }
      for (const b of betr) await saveBook(b, { ...b, a: [...new Set(persons(b.a).map(p => alt.has(p) ? ziel : p))].join(', ') });
      toast(`${betr.length} Bücher vereinheitlicht`); return;
    }
    const s = e.target.closest('[data-split]');
    if (s) {
      const b = B.find(x => x.id === s.dataset.split), [first, ...rest] = persons(b.a);
      const ue = [...new Set([...persons(b.ue), ...rest])].join(', ');
      await saveBook(b, { ...b, a: first, ue }); toast(`${first} · Übersetzer/Hrsg.: ${ue}`);
    }
  };
}
