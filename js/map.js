// Themenlandkarte mit drei Ansichten, jeweils aus den aktuellen Daten berechnet:
//   Themen    – Themen als Punkte, gruppiert in farbigen Bereichen ihrer Hauptkategorie
//   Autoren   – Autoren, verbunden über ähnliche Themen und gemeinsame Bücher
//   Übersicht – Flächen: Kategorie → Genre (Belletristik, Science-Fiction) bzw. Hauptthema
'use strict';
let selectNode = null;
let mapMode = (() => { try { return localStorage.getItem('bb_mapmode') || 'themen'; } catch (e) { return 'themen'; } })();

// ---------- Hilfen ----------
const mapNorm = s => (s || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
function themeFilter(books, hiddenTags) {
  const cats = new Set(books.map(b => mapNorm(b.c)));
  const genre = new Set([...(typeof GENRE_TAGS !== 'undefined' ? GENRE_TAGS : []), ...(hiddenTags || [])].map(mapNorm));
  return t => !cats.has(mapNorm(t)) && !genre.has(mapNorm(t));
}
const themesOf = (b, ok) => [...new Set([...(b.tg || []), ...(b.tt || []), ...(b.ts || [])])].filter(ok);
const countBy = arr => arr.reduce((m, x) => (m.set(x, (m.get(x) || 0) + 1), m), new Map());
const topOf = m => [...m].sort((a, b) => b[1] - a[1]);
const catColor = c => PALETTE[c] || '#777';

// ---------- Ansicht „Themen“ ----------
function graphThemen(books, hiddenTags) {
  const ok = themeFilter(books, hiddenTags);
  const tagN = countBy(books.flatMap(b => themesOf(b, ok)));
  const tags = new Set([...tagN].filter(([, n]) => n >= 5).map(([t]) => t));
  const catOf = new Map(), catsByTag = new Map(), co = new Map();
  for (const b of books) {
    const bt = themesOf(b, ok).filter(t => tags.has(t));
    for (const t of bt) { if (!catsByTag.has(t)) catsByTag.set(t, new Map()); const m = catsByTag.get(t); m.set(b.c, (m.get(b.c) || 0) + 1); }
    for (let i = 0; i < bt.length; i++) for (let j = i + 1; j < bt.length; j++) { const k = [bt[i], bt[j]].sort().join('\u0000'); co.set(k, (co.get(k) || 0) + 1); }
  }
  for (const [t, m] of catsByTag) catOf.set(t, topOf(m)[0][0]);
  const nodes = [...tags].map(t => ({ id: 't:' + t, k: 't', n: t, v: tagN.get(t), c: catOf.get(t), cats: topOf(catsByTag.get(t)) }));
  const links = [...co].filter(([, w]) => w >= 6).map(([k, w]) => { const [a, b] = k.split('\u0000'); return { s: 't:' + a, t: 't:' + b, w }; });
  return { nodes, links };
}

// ---------- Ansicht „Autoren“ ----------
function graphAutoren(books, hiddenTags) {
  const ok = themeFilter(books, hiddenTags);
  const by = new Map();
  for (const b of books) for (const p of persons(b.a)) { if (!p || p === 'Unbekannt') continue; if (!by.has(p)) by.set(p, []); by.get(p).push(b); }
  const auth = [...by].filter(([, l]) => l.length >= 3);
  const raw = new Map(auth.map(([a, l]) => [a, countBy(l.flatMap(b => themesOf(b, ok)))]));
  // seltene Themen zählen mehr als allgegenwärtige (z. B. „Gesellschaftskritik“)
  const df = countBy([...raw.values()].flatMap(v => [...v.keys()]));
  const vec = new Map([...raw].map(([a, v]) => [a, new Map([...v].map(([t, n]) => [t, n * Math.log(1 + auth.length / df.get(t))]))]));
  const len = v => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) || 1;
  const cos = (x, y) => { let s = 0; for (const [k, a] of x) { const b = y.get(k); if (b) s += a * b; } return s / (len(x) * len(y)); };
  const nodes = auth.map(([a, l]) => ({ id: 'a:' + a, k: 'a', n: a, v: l.length, c: topOf(countBy(l.map(b => b.c)))[0][0],
    themes: topOf(raw.get(a)).slice(0, 8), genres: topOf(countBy(l.map(b => b.ge).filter(Boolean))) }));
  const E = new Map(); const add = (a, b, w, kind) => { const k = [a, b].sort().join('\u0000'); const e = E.get(k); if (!e || e.w < w) E.set(k, { w, kind }); };
  // ähnliche Themen: je Autor die drei nächsten Nachbarn
  for (const [a] of auth) {
    const sims = auth.filter(([b]) => b !== a).map(([b]) => [b, cos(vec.get(a), vec.get(b))]).filter(x => x[1] >= .35).sort((x, y) => y[1] - x[1]).slice(0, 3);
    sims.forEach(([b, s]) => add(a, b, Math.round(s * 100), 'sim'));
  }
  // gemeinsame Bücher (Mitautoren)
  const names = new Set(auth.map(x => x[0]));
  for (const b of books) { const ps = persons(b.a).filter(p => names.has(p)); for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) add(ps[i], ps[j], 100, 'co'); }
  const links = [...E].map(([k, e]) => { const [a, b] = k.split('\u0000'); return { s: 'a:' + a, t: 'a:' + b, w: e.w, kind: e.kind }; });
  return { nodes, links };
}

// ---------- Ansicht „Übersicht“ ----------
function treeUebersicht(books, hiddenTags) {
  const ok = themeFilter(books, hiddenTags);
  const byCat = new Map();
  for (const b of books) {
    let key, kind;
    const own = mapNorm(b.c).replace(/biografie/, 'biographie'), notOwn = t => { const n = mapNorm(t).replace(/biografie/, 'biographie'); return !own.includes(n) && !(n === 'science' && own === 'naturwissenschaft'); };
    if (b.ge && b.c === 'Belletristik') { key = b.ge; kind = 'g'; }
    else { const t = [...(b.tt || []), ...(b.tg || []), ...(b.ts || [])].find(x => ok(x) && notOwn(x) && !(b.c === 'Science-Fiction' && mapNorm(x) === 'science')); key = t || 'ohne Thema'; kind = t ? 't' : 'x'; }
    if (!byCat.has(b.c)) byCat.set(b.c, new Map());
    const m = byCat.get(b.c), id = kind + ':' + key;
    if (!m.has(id)) m.set(id, { n: key, kind, v: 0 }); m.get(id).v++;
  }
  return { n: 'Bibliothek', children: [...byCat].map(([c, m]) => ({ n: c, c, children: [...m.values()].map(x => ({ ...x, c })) })) };
}

// ---------- Zeichnen ----------
function buildMap() {
  const svg = d3.select('#svg'), wrap = document.getElementById('svgWrap');
  svg.selectAll('*').remove(); svg.on('.zoom', null); svg.on('click', null);
  const panel = document.getElementById('panel'); panel.classList.remove('show'); panel.innerHTML = '';
  document.querySelectorAll('#mapModes [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mapMode));
  const hidden = REGELN.karte_ausgeblendete_tags;
  const legend = document.getElementById('mapLegend');
  document.getElementById('mapHint').textContent = mapMode === 'uebersicht' ? '' : 'Ziehen zum Verschieben · Zoomen mit zwei Fingern oder Mausrad · Punkt antippen';
  document.querySelector('#svgWrap .zoomb').style.display = mapMode === 'uebersicht' ? 'none' : '';
  if (mapMode === 'uebersicht') return drawTreemap(svg, wrap, treeUebersicht(B, hidden), legend);
  const G = mapMode === 'autoren' ? graphAutoren(B, hidden) : graphThemen(B, hidden);
  drawGraph(svg, wrap, G, legend, panel);
}

function drawGraph(svg, wrap, G, legend, panel) {
  const autoren = mapMode === 'autoren';
  const W = 1400, H = 1100;
  const nodes = G.nodes.map(d => ({ ...d })), byId = new Map(nodes.map(d => [d.id, d]));
  const links = G.links.map(l => ({ source: byId.get(l.s), target: byId.get(l.t), w: l.w, kind: l.kind }));
  // Kategorien als Ankerpunkte auf einem Kreis, größte zuerst
  const catSize = topOf(countBy(nodes.flatMap(d => Array(d.v).fill(d.c))));
  const centers = new Map(catSize.map(([c], i) => { const a = i / catSize.length * 2 * Math.PI - Math.PI / 2, R = i === 0 ? 0 : 430; return [c, { x: W / 2 + R * Math.cos(a), y: H / 2 + R * .82 * Math.sin(a) }]; }));
  const r = d => autoren ? 3 + Math.sqrt(d.v) * 2.2 : 4 + Math.sqrt(d.v) * 1.5;
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).distance(autoren ? 50 : 60).strength(l => autoren ? (l.kind === 'co' ? .25 : .02 + l.w / 2000) : Math.min(.12, l.w / 200)))
    .force('charge', d3.forceManyBody().strength(autoren ? -45 : -70).distanceMax(260))
    .force('collide', d3.forceCollide(d => r(d) + (autoren ? 5 : 9)))
    .force('x', d3.forceX(d => centers.get(d.c).x).strength(.32))
    .force('y', d3.forceY(d => centers.get(d.c).y).strength(.32)).stop();
  for (let i = 0; i < 450; i++) sim.tick();

  const root = svg.append('g');
  // Bereiche je Kategorie (konvexe Hülle der zugehörigen Punkte)
  const hullG = root.append('g');
  const groups = d3.group(nodes, d => d.c);
  for (const [c, all] of groups) {
    // Ausreißer (weit weg vom Schwerpunkt) bekommen keinen Bereich, sonst überlagern sich die Flächen
    const mx = d3.median(all, d => d.x), my = d3.median(all, d => d.y);
    const dist = d => Math.hypot(d.x - mx, d.y - my), lim = Math.max(70, 1.8 * (d3.median(all, dist) || 0));
    const list = all.filter(d => dist(d) <= lim);
    const pts = list.flatMap(d => { const p = r(d) + 16; return [[d.x - p, d.y], [d.x + p, d.y], [d.x, d.y - p], [d.x, d.y + p]]; });
    const hull = d3.polygonHull(pts); if (!hull) continue;
    hullG.append('path').attr('class', 'hull').attr('d', d3.line().curve(d3.curveCatmullRomClosed.alpha(.5))(hull))
      .attr('fill', catColor(c)).attr('stroke', catColor(c));
    const cx = d3.mean(list, d => d.x), cy = d3.min(list, d => d.y) - 22;
    hullG.append('text').attr('class', 'hlabel').attr('x', cx).attr('y', cy).attr('text-anchor', 'middle').attr('fill', catColor(c))
      .text(c + (list.length > 1 ? '' : '')).style('cursor', 'pointer').on('click', e => { e.stopPropagation(); showInCatalog({ k: 'c', n: c }); });
  }
  const linkSel = root.append('g').selectAll('line').data(links).join('line').attr('class', l => 'link' + (l.kind === 'co' ? ' co' : ''))
    .attr('stroke-width', l => autoren ? (l.kind === 'co' ? 2 : .8 + l.w / 60) : Math.min(4, .5 + Math.sqrt(l.w) * .4))
    .attr('x1', l => l.source.x).attr('y1', l => l.source.y).attr('x2', l => l.target.x).attr('y2', l => l.target.y);
  const nodeSel = root.append('g').selectAll('g').data(nodes).join('g').attr('class', d => 'node ' + d.k)
    .attr('transform', d => `translate(${d.x},${d.y})`).style('cursor', 'pointer');
  nodeSel.append('circle').attr('r', r)
    .attr('fill', d => autoren ? catColor(d.c) : 'var(--card)').attr('stroke', d => autoren ? 'var(--card)' : catColor(d.c)).attr('stroke-width', autoren ? 1.5 : 2.2);
  nodeSel.append('text').text(d => d.n).attr('text-anchor', 'middle').attr('dy', d => -r(d) - 5);

  const nb = new Map(nodes.map(d => [d.id, new Set()]));
  links.forEach(l => { nb.get(l.source.id).add(l.target.id); nb.get(l.target.id).add(l.source.id); });
  let k = 1, sel = null;
  const big = autoren ? 7 : 14;
  const labelVisible = d => sel ? (d.id === sel.id || nb.get(sel.id).has(d.id)) : (d.v >= big || k > 1.6 || (k > 1.15 && d.v >= big / 2));
  function refresh() {
    nodeSel.classed('fade', d => sel && d.id !== sel.id && !nb.get(sel.id).has(d.id));
    nodeSel.select('text').style('display', d => labelVisible(d) ? null : 'none');
    linkSel.classed('hi', l => sel && (l.source.id === sel.id || l.target.id === sel.id))
      .classed('fade', l => sel && l.source.id !== sel.id && l.target.id !== sel.id);
  }
  const zoom = d3.zoom().scaleExtent([.25, 6]).on('zoom', e => { root.attr('transform', e.transform); const nk = e.transform.k; if (Math.abs(nk - k) > .05) { k = nk; refresh(); } });
  svg.call(zoom).on('dblclick.zoom', null);
  function fit(dur = 0) {
    const [x0, x1] = d3.extent(nodes, d => d.x), [y0, y1] = d3.extent(nodes, d => d.y);
    const w = wrap.clientWidth, h = wrap.clientHeight, s = Math.min(w / (x1 - x0 + 120), h / (y1 - y0 + 140));
    const t = d3.zoomIdentity.translate(w / 2 - s * (x0 + x1) / 2, h / 2 - s * (y0 + y1) / 2).scale(s);
    (dur ? svg.transition().duration(dur) : svg).call(zoom.transform, t);
  }
  function focus(d) { const w = wrap.clientWidth, h = wrap.clientHeight, s = Math.max(k, 1.6); svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(w / 2 - s * d.x, h / 2 - s * d.y).scale(s)); }

  const chips = (arr, attr, fmt) => `<div class="tagl">${arr.map(([n, w]) => `<button class="chip" ${attr}="${esc(n)}">${esc(n)}<i>${fmt ? fmt(w) : w}</i></button>`).join('')}</div>`;
  selectNode = (d, center) => {
    sel = d; refresh();
    if (!d) { panel.classList.remove('show'); return; }
    const nbs = links.filter(l => l.source.id === d.id || l.target.id === d.id).map(l => [l.source.id === d.id ? l.target : l.source, l]).sort((a, b) => b[1].w - a[1].w);
    let body;
    if (autoren) {
      const sims = nbs.filter(([, l]) => l.kind === 'sim'), cos = nbs.filter(([, l]) => l.kind === 'co');
      body = `<div class="k">Autor · ${d.v} Bücher · meist ${esc(d.c)}</div>
        <button class="btn on" id="toCat">Bücher im Katalog zeigen</button>
        ${d.genres.length ? `<h3>Genres</h3>${chips(d.genres, 'data-x')}` : ''}
        ${d.themes.length ? `<h3>Themen</h3>${chips(d.themes, 'data-x')}` : ''}
        ${cos.length ? `<h3>Gemeinsame Bücher mit</h3><div class="tagl">${cos.map(([o]) => `<button class="chip" data-node="${esc(o.id)}">${esc(o.n)}</button>`).join('')}</div>` : ''}
        ${sims.length ? `<h3>Ähnliche Autoren</h3><div class="tagl">${sims.map(([o, l]) => `<button class="chip" data-node="${esc(o.id)}">${esc(o.n)}<i>${l.w} %</i></button>`).join('')}</div>
          <p class="hint2">Prozent = Übereinstimmung der Themen ihrer Bücher.</p>` : ''}`;
    } else {
      body = `<div class="k">Thema · ${d.v} Bücher · Schwerpunkt ${esc(d.c)}</div>
        <button class="btn on" id="toCat">Bücher im Katalog zeigen</button>
        <h3>Kategorien</h3>${chips(d.cats, 'data-x')}
        ${nbs.length ? `<h3>Oft zusammen mit</h3><div class="tagl">${nbs.map(([o, l]) => `<button class="chip" data-node="${esc(o.id)}">${esc(o.n)}<i>${l.w}</i></button>`).join('')}</div>
          <p class="hint2">Zahl = Bücher, die beide Themen tragen.</p>` : ''}`;
    }
    panel.innerHTML = `<h2>${esc(d.n)}</h2>${body}`;
    panel.classList.add('show');
    document.getElementById('toCat').onclick = () => showInCatalog(d);
    if (center) focus(d);
    if (innerWidth < 700) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };
  panel.onclick = e => { const c = e.target.closest('[data-node]'); if (c) selectNode(byId.get(c.dataset.node), true); };
  nodeSel.on('click', (e, d) => { e.stopPropagation(); selectNode(sel && sel.id === d.id ? null : d); });
  svg.on('click', () => selectNode(null));
  document.getElementById('zin').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.5);
  document.getElementById('zout').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.5);
  document.getElementById('zfit').onclick = () => { selectNode(null); fit(400); };
  legend.innerHTML = autoren
    ? `<span>Punktgröße = Anzahl Bücher (ab 3) · Farbe = Hauptkategorie · Linie = ähnliche Themen</span><span><b class="lco"></b> gemeinsames Buch</span>`
    : `<span>Kreis = Thema (Tag, ab 5 Büchern) · Farbbereich = Kategorie, in der das Thema am häufigsten vorkommt · Linie = Themen teilen Bücher</span>`;
  const dl = document.getElementById('nodeList');
  dl.innerHTML = nodes.slice().sort((a, b) => cmp(a.n, b.n)).map(d => `<option value="${esc(d.n)}"></option>`).join('');
  const mq = document.getElementById('mq'); mq.placeholder = autoren ? 'Autor finden …' : 'Thema finden …'; mq.value = '';
  mq.onchange = e => { const v = norm(e.target.value.trim()); const d = nodes.find(n => norm(n.n) === v) || nodes.find(n => norm(n.n).includes(v)); if (d) selectNode(d, true); };
  refresh(); fit();
  window.mapFit = fit;
}

function drawTreemap(svg, wrap, tree, legend) {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const root = d3.hierarchy(tree).sum(d => d.children ? 0 : d.v).sort((a, b) => b.value - a.value);
  d3.treemap().size([w, h]).paddingOuter(3).paddingTop(d => d.depth === 1 ? 20 : 0).paddingInner(2).round(true)(root);
  const g = svg.append('g');
  const cat = g.selectAll('g.tc').data(root.children || []).join('g').attr('class', 'tc');
  cat.append('rect').attr('x', d => d.x0).attr('y', d => d.y0).attr('width', d => d.x1 - d.x0).attr('height', d => d.y1 - d.y0)
    .attr('fill', d => catColor(d.data.c)).attr('rx', 6);
  cat.append('text').attr('class', 'tmcat').attr('x', d => d.x0 + 7).attr('y', d => d.y0 + 14)
    .text(d => (d.x1 - d.x0) > 60 ? `${d.data.n} · ${d.value}` : '').style('cursor', 'pointer')
    .on('click', (e, d) => showInCatalog({ k: 'c', n: d.data.c }));
  const leaf = g.selectAll('g.tl').data(root.leaves()).join('g').attr('class', 'tl').style('cursor', 'pointer');
  leaf.append('rect').attr('x', d => d.x0).attr('y', d => d.y0).attr('width', d => Math.max(0, d.x1 - d.x0)).attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', 'var(--card)').attr('fill-opacity', d => d.data.kind === 'x' ? .55 : .86).attr('rx', 3);
  leaf.append('title').text(d => `${d.data.c} › ${d.data.n}: ${d.value} Bücher`);
  leaf.each(function (d) {
    const bw = d.x1 - d.x0, bh = d.y1 - d.y0; if (bw < 38 || bh < 16) return;
    const t = d3.select(this).append('text').attr('class', 'tmleaf').attr('x', d.x0 + 5).attr('y', d.y0 + 13);
    const name = d.data.n.length * 6.2 > bw - 8 ? d.data.n.slice(0, Math.max(3, Math.floor((bw - 14) / 6.2))) + '…' : d.data.n;
    t.append('tspan').text(name);
    if (bh > 28) t.append('tspan').attr('x', d.x0 + 5).attr('dy', 13).attr('class', 'tmn').text(d.value);
  });
  leaf.on('click', (e, d) => {
    const x = d.data;
    if (x.kind === 'g') showInCatalog({ k: 'g', n: x.n, c: x.c });
    else if (x.kind === 't') showInCatalog({ k: 't', n: x.n, c: x.c });
    else showInCatalog({ k: 'c', n: x.c });
  });
  legend.innerHTML = '<span>Fläche = Anzahl der Bücher · Belletristik nach Genre, alle anderen Kategorien nach Hauptthema (erstes Thema eines Buchs, das nicht die Kategorie wiederholt)</span>';
  document.getElementById('nodeList').innerHTML = '';
  const mq = document.getElementById('mq'); mq.placeholder = 'Kategorie, Genre oder Thema finden …'; mq.value = '';
  mq.onchange = e => { const v = norm(e.target.value.trim()); if (!v) return;
    leaf.select('rect').attr('stroke', d => norm(d.data.n).includes(v) || norm(d.data.c).includes(v) ? 'var(--ink)' : null).attr('stroke-width', 2.5); };
  selectNode = () => {};
  window.mapFit = () => { if (location.hash === '#landkarte') buildMap(); };
}

let _rz; addEventListener('resize', () => { clearTimeout(_rz); _rz = setTimeout(() => { if (window.mapFit && location.hash === '#landkarte') window.mapFit(); }, 250); });
