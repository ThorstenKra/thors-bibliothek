// Themenlandkarte: Netz aus Kategorien, Themen (Tags) und Autoren. Wird aus den aktuellen Daten berechnet.
'use strict';
const KIND = {c:'Kategorie', t:'Thema', a:'Autor'};
let selectNode = null;

function computeGraph(books, hiddenTags){
  const dup = new Set(hiddenTags || []);
  const all = b => [...new Set([...(b.tg||[]), ...(b.ts||[]), ...(b.tt||[])])];
  const cnt = (arr) => arr.reduce((m,x)=>(m.set(x,(m.get(x)||0)+1),m), new Map());
  const catN = cnt(books.map(b=>b.c));
  const tagN = cnt(books.flatMap(all));
  const autN = cnt(books.map(b=>b.a));
  // Tags, die wie eine Kategorie heißen (z. B. „Belletristik“, „Science Fiction“), nicht doppelt zeigen
  const norm = s => (s||'').toLowerCase().replace(/[^a-zäöüß]/g, '');
  const catNames = new Set([...catN.keys()].map(norm));
  const tags = new Set([...tagN].filter(([t,n])=>n>=5 && !dup.has(t) && !catNames.has(norm(t))).map(([t])=>t));
  const authors = new Set([...autN].filter(([a,n])=>n>=4 && a && a!=='Unbekannt').map(([a])=>a));
  const E = new Map(); const add = (a,b)=>{ const k=a+'\u0000'+b; E.set(k,(E.get(k)||0)+1); };
  for (const b of books){
    const bt = all(b).filter(t=>tags.has(t));
    if (authors.has(b.a)){ add('a:'+b.a,'c:'+b.c); bt.forEach(t=>add('a:'+b.a,'t:'+t)); }
    bt.forEach(t=>add('t:'+t,'c:'+b.c));
    for (let i=0;i<bt.length;i++) for (let j=i+1;j<bt.length;j++){ const [x,y]=[bt[i],bt[j]].sort(); add('t:'+x,'t:'+y); }
  }
  const links = [];
  for (const [k,w] of E){ const [s,t]=k.split('\u0000');
    const keep = s[0]==='a' ? true : (s[0]==='t' && t[0]==='c') ? w>=3 : w>=8;
    if (keep) links.push({s,t,w}); }
  const deg = new Map(); links.forEach(l=>{ deg.set(l.s,1); deg.set(l.t,1); });
  const nodes = [...[...catN].map(([c,v])=>({id:'c:'+c,k:'c',n:c,v})), ...[...tags].map(t=>({id:'t:'+t,k:'t',n:t,v:tagN.get(t)})),
    ...[...authors].map(a=>({id:'a:'+a,k:'a',n:a,v:autN.get(a)}))].filter(n=>deg.has(n.id));
  return {nodes, links};
}

function buildMap(G){
  const svg = d3.select('#svg'), wrap = document.getElementById('svgWrap');
  svg.selectAll('*').remove(); svg.on('.zoom', null);
  document.getElementById('panel').classList.remove('show');
  const W = 1400, H = 1100;
  const nodes = G.nodes.map(d=>({...d})), byId = new Map(nodes.map(d=>[d.id,d]));
  const links = G.links.map(l=>({source:byId.get(l.s), target:byId.get(l.t), w:l.w}));
  const r = d => d.k==='c' ? 10+Math.sqrt(d.v)*1.6 : d.k==='t' ? 4+Math.sqrt(d.v)*1.3 : 3+Math.sqrt(d.v)*1.1;
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).distance(l=> l.source.k==='a'&&l.target.k==='c' ? 70 : l.target.k==='c' ? 120 : 90)
          .strength(l=> Math.min(1, .04 + l.w/(l.source.k==='a'?8:40))))
    .force('charge', d3.forceManyBody().strength(d=> d.k==='c' ? -1100 : d.k==='t' ? -260 : -120))
    .force('collide', d3.forceCollide(d=>r(d)+ (d.k==='a'?14:18)))
    .force('x', d3.forceX(W/2).strength(.04)).force('y', d3.forceY(H/2).strength(.05))
    .stop();
  for (let i=0;i<450;i++) sim.tick();

  const root = svg.append('g');
  const linkSel = root.append('g').selectAll('line').data(links).join('line').attr('class','link')
    .attr('stroke-width', l=> Math.min(4, .5+Math.sqrt(l.w)*.5))
    .attr('x1',l=>l.source.x).attr('y1',l=>l.source.y).attr('x2',l=>l.target.x).attr('y2',l=>l.target.y);
  const nodeSel = root.append('g').selectAll('g').data(nodes).join('g').attr('class',d=>'node '+d.k)
    .attr('transform',d=>`translate(${d.x},${d.y})`).style('cursor','pointer');
  nodeSel.append('circle').attr('r', r)
    .attr('fill', d=> d.k==='c' ? (PALETTE[d.n]||'#777') : d.k==='t' ? 'var(--card)' : 'var(--ink)')
    .attr('stroke', d=> d.k==='t' ? 'var(--accent)' : 'var(--card)').attr('stroke-width', d=> d.k==='t'?2:1.5);
  nodeSel.append('text').text(d=>d.n).attr('text-anchor','middle').attr('dy', d=> -r(d)-5);

  const nb = new Map(nodes.map(d=>[d.id,new Set()]));
  links.forEach(l=>{ nb.get(l.source.id).add(l.target.id); nb.get(l.target.id).add(l.source.id); });
  const hidden = new Set();
  let k = 1, sel = null;
  const labelVisible = d => sel ? (d.id===sel.id || nb.get(sel.id).has(d.id)) :
    d.k==='c' || (d.k==='t' && (d.v>=14 || k>1.5)) || (d.k==='a' && (d.v>=8 || k>1.8)) || k>2.4;
  function refresh(){
    nodeSel.style('display', d=> hidden.has(d.k)?'none':null)
      .classed('fade', d=> sel && d.id!==sel.id && !nb.get(sel.id).has(d.id));
    nodeSel.select('text').style('display', d=> labelVisible(d)?null:'none');
    linkSel.style('display', l=> hidden.has(l.source.k)||hidden.has(l.target.k)?'none':null)
      .classed('hi', l=> sel && (l.source.id===sel.id||l.target.id===sel.id))
      .classed('fade', l=> sel && l.source.id!==sel.id && l.target.id!==sel.id);
  }
  const zoom = d3.zoom().scaleExtent([.25,6]).on('zoom', e=>{ root.attr('transform', e.transform); const nk=e.transform.k; if (Math.abs(nk-k)>.05){ k=nk; refresh(); } });
  svg.call(zoom).on('dblclick.zoom', null);
  function fit(dur=0){
    const vis = nodes.filter(d=>!hidden.has(d.k));
    const [x0,x1] = d3.extent(vis,d=>d.x), [y0,y1] = d3.extent(vis,d=>d.y);
    const w = wrap.clientWidth, h = wrap.clientHeight, s = Math.min(w/(x1-x0+80), h/(y1-y0+80));
    const t = d3.zoomIdentity.translate(w/2 - s*(x0+x1)/2, h/2 - s*(y0+y1)/2).scale(s);
    (dur? svg.transition().duration(dur) : svg).call(zoom.transform, t);
  }
  function focus(d){
    const w = wrap.clientWidth, h = wrap.clientHeight, s = Math.max(k, 1.6);
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(w/2 - s*d.x, h/2 - s*d.y).scale(s));
  }
  const panel = document.getElementById('panel');
  selectNode = (d, center) => {
    sel = d; refresh();
    if (!d){ panel.classList.remove('show'); return; }
    const groups = {c:[],t:[],a:[]};
    links.filter(l=>l.source.id===d.id||l.target.id===d.id).forEach(l=>{ const o = l.source.id===d.id?l.target:l.source; groups[o.k].push([o,l.w]); });
    const sec = (key,title) => groups[key].length ? `<h3>${title}</h3><div class="tagl">${groups[key].sort((a,b)=>b[1]-a[1]).map(([o,w])=>`<button class="chip" data-node="${esc(o.id)}">${esc(o.n)}<i>${w}</i></button>`).join('')}</div>` : '';
    panel.innerHTML = `<h2>${esc(d.n)}</h2><div class="k">${KIND[d.k]} · ${d.v} ${d.v===1?'Buch':'Bücher'}</div>
      <button class="btn on" id="toCat">Bücher im Katalog zeigen</button>
      ${sec('c','Kategorien')}${sec('t','Verbundene Themen')}${sec('a','Autoren')}
      <p style="color:var(--muted);font-size:12px;margin:10px 0 0">Die Zahl gibt an, wie viele Bücher die Verbindung tragen.</p>`;
    panel.classList.add('show');
    document.getElementById('toCat').onclick = ()=>showInCatalog(d);
    if (center) focus(d);
    if (innerWidth < 700) setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
  };
  panel.onclick = e => { const c = e.target.closest('[data-node]'); if (c) selectNode(byId.get(c.dataset.node), true); };
  nodeSel.on('click', (e,d)=>{ e.stopPropagation(); selectNode(sel&&sel.id===d.id?null:d); });
  svg.on('click', ()=> selectNode(null));
  document.querySelectorAll('.legend input').forEach(cb=>{ cb.checked=true; }); document.querySelectorAll('.legend input').forEach(cb=> cb.onchange = ()=>{ cb.checked?hidden.delete(cb.dataset.k):hidden.add(cb.dataset.k); refresh(); });
  document.getElementById('zin').onclick = ()=> svg.transition().duration(250).call(zoom.scaleBy, 1.5);
  document.getElementById('zout').onclick = ()=> svg.transition().duration(250).call(zoom.scaleBy, 1/1.5);
  document.getElementById('zfit').onclick = ()=> { selectNode(null); fit(400); };
  const dl = document.getElementById('nodeList');
  dl.innerHTML = nodes.slice().sort((a,b)=>cmp(a.n,b.n)).map(d=>`<option value="${esc(d.n)}">${KIND[d.k]}</option>`).join('');
  document.getElementById('mq').onchange = e => { const v = norm(e.target.value.trim()); const d = nodes.find(n=>norm(n.n)===v) || nodes.find(n=>norm(n.n).includes(v)); if (d){ hidden.delete(d.k); document.querySelector(`.legend input[data-k="${d.k}"]`).checked=true; selectNode(d, true); } };
  refresh(); fit();
  window.mapFit = fit;
}
let _rz; addEventListener('resize', ()=>{ clearTimeout(_rz); _rz=setTimeout(()=>{ if (window.mapFit && location.hash==='#landkarte') window.mapFit(); },250); });

