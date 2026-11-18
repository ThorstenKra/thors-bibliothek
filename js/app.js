// Thors Bibliothek – Oberfläche. Läuft komplett im Browser, Daten in IndexedDB (siehe data.js).
'use strict';
const APP_VERSION = '1.3.2';

// ---------- Hilfsfunktionen ----------
const $ = id => document.getElementById(id);
const PALETTE = {
  "Belletristik":"#7b3f35","Philosophie":"#2f4b63","Psychologie":"#5b4a7a","Gesellschaft":"#4d6b4f",
  "Politik & Recht":"#8a5a2b","Geschichte":"#6b5a3a","Religion & Spiritualität":"#6a3e5c","Medizin & Gesundheit":"#2f6b6a",
  "Naturwissenschaft":"#245a7a","Wirtschaft":"#55606b","Musik & Kunst":"#9a4a5a","Bildung & Ratgeber":"#6b7a3a",
  "Biografie":"#7a6a4a","Literaturwissenschaft":"#5a3a3a","Technik & Informatik":"#3a4a6a","Sonstiges":"#6b6560","Ohne Kategorie":"#85807a"
};
const CATEGORIES = Object.keys(PALETTE);
const STATUS = ['Ungelesen', 'Lese ich', 'Gelesen', 'Abgebrochen', 'Wunschliste'];
const shade = (hex, k) => { const n=parseInt(hex.slice(1),16); const r=n>>16,g=n>>8&255,b=n&255; return `rgb(${Math.round(r*k)},${Math.round(g*k)},${Math.round(b*k)})`; };
const hash = s => { let h=0; for (const c of String(s)) h=(h*31+c.charCodeAt(0))|0; return Math.abs(h); };
const coverBg = b => { const base=PALETTE[b.c]||'#666'; const v=.78+(hash(b.t)%30)/100; return `linear-gradient(160deg, ${shade(base,v+.08)} 0%, ${shade(base,v-.12)} 100%)`; };
const esc = s => String(s??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const stars = r => r ? '★'.repeat(r)+'<span style="opacity:.3">'+'★'.repeat(5-r)+'</span>' : '';
const fmtDate = d => d ? String(d).slice(0,10).split('-').reverse().join('.') : '';
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const cmp = (a,b) => String(a||'').localeCompare(String(b||''),'de',{sensitivity:'base'});
const LS = (k,v) => { try { if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v);} catch(e){ return null; } };
const list = s => String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),3200); }

// ---------- Zustand ----------
let ALL = [], B = [], REGELN = {}, mapDirty = true;
const state = { fmt:'', sug:true, q:'', cat:'', st:'', lang:'', tag:'', sort:'added', view: LS('bb_view')||'grid', limit:60 };

async function load(){
  ALL = await Data.allBooks();
  B = ALL.filter(b=>!b.del);
  B.forEach(b=>{ b.hay = norm([b.t,b.s,b.a,b.p,(b.tg||[]).join(' '),(b.ts||[]).join(' '),(b.tt||[]).join(' '),b.su,b.n,(b.kn||[]).join(' '),b.i,b.loc,b.lendTo].join(' ')); });
  REGELN = await Data.getMeta('regeln', {});
  mapDirty = true;
}

// ---------- Kopfbereich ----------
async function drawHeader(){
  const read = B.filter(b=>b.st==='Gelesen');
  const items = [[B.length,'Bücher'],[read.length,'gelesen'],[B.filter(b=>b.st==='Lese ich').length,'in Arbeit'],
    [new Set(B.map(b=>b.a)).size,'Autoren'],[B.filter(b=>b.kd).length,'auf Kindle'],
    [read.reduce((s,b)=>s+(+b.pg||0),0),'Seiten gelesen']];
  const lend = B.filter(b=>b.lendTo).length; if (lend) items.push([lend,'verliehen']);
  $('stats').innerHTML = items.map(([v,l])=>`<div class="stat"><b>${Number(v).toLocaleString('de-DE')}</b><span>${l}</span></div>`).join('');
  const last = await Data.getMeta('letzteSicherung', null);
  $('subline').textContent = 'Lokal auf diesem Gerät' + (last ? ' · letzte Sicherung ' + fmtDate(last) : ' · noch keine Sicherung');
  const dirty = await Data.getMeta('ungesichert', 0);
  const old = !last || (Date.now() - new Date(last).getTime()) > 7*864e5;
  $('backupBanner').innerHTML = dirty && old ? `<div class="banner">${dirty} ${dirty===1?'Änderung ist':'Änderungen sind'} noch nicht gesichert. <button class="btn on" id="bannerBackup">Jetzt sichern</button></div>` : '';
  const bb = $('bannerBackup'); if (bb) bb.onclick = backupJSON;
}

// ---------- Katalog ----------
function drawFilters(){
  const cc = {}; B.forEach(b=>cc[b.c]=(cc[b.c]||0)+1);
  const cats = Object.entries(cc).sort((a,b)=>b[1]-a[1]);
  $('cats').innerHTML = `<button class="chip ${state.cat?'':'on'}" data-c="">Alle<i>${B.length}</i></button>` +
    cats.map(([c,n])=>`<button class="chip ${state.cat===c?'on':''}" data-c="${esc(c)}">${esc(c)}<i>${n}</i></button>`).join('');
  const lc = {}; B.forEach(b=>{ if(b.l) lc[b.l]=(lc[b.l]||0)+1; });
  $('lang').innerHTML = '<option value="">Alle Sprachen</option>' + Object.entries(lc).sort((a,b)=>b[1]-a[1]).map(([l,n])=>`<option value="${esc(l)}">${esc(l)} (${n})</option>`).join('');
  $('lang').value = state.lang;
  $('st').innerHTML = '<option value="">Alle Status</option>' + STATUS.map(s=>`<option>${s}</option>`).join('');
  $('st').value = state.st;
}
$('cats').onclick = e => { const t=e.target.closest('.chip'); if(!t) return; state.cat=t.dataset.c; state.limit=60; drawFilters(); render(); };

const strip = t => String(t||'').replace(/^[„"',.¿¡»«\s]+/,'');
const sorters = {
  added:(a,b)=>String(b.da||'').localeCompare(String(a.da||'')),
  title:(a,b)=>cmp(strip(a.t),strip(b.t)),
  author:(a,b)=>cmp(a.al||a.a,b.al||b.a)||cmp(a.t,b.t),
  year:(a,b)=>(+b.y||0)-(+a.y||0),
  rating:(a,b)=>(b.r||0)-(a.r||0)||cmp(a.t,b.t),
  finished:(a,b)=>String(b.df||'').localeCompare(String(a.df||'')),
  pages:(a,b)=>(+b.pg||0)-(+a.pg||0),
  edited:(a,b)=>String(b.u||'').localeCompare(String(a.u||'')),
};
function filtered(){
  const terms = norm(state.q).split(/\s+/).filter(Boolean);
  let r = B.filter(b =>
    (!state.cat || b.c===state.cat) &&
    (!state.fmt || (state.fmt==='bb'&&b.fm!=='Kindle') || (state.fmt==='kd'&&b.kd) || (state.fmt==='ko'&&b.fm==='Kindle') || (state.fmt==='lend'&&b.lendTo)) &&
    (!state.st || b.st===state.st) && (!state.lang || b.l===state.lang) &&
    (!state.tag || (b.tg||[]).includes(state.tag) || (state.sug && ((b.ts||[]).includes(state.tag) || (b.tt||[]).includes(state.tag)))) &&
    terms.every(t=>b.hay.includes(t)));
  if (state.sort==='finished') r = r.filter(b=>b.df);
  return r.sort(sorters[state.sort]);
}
function card(b){
  const badge = b.lendTo ? '<span class="badge">verliehen</span>' : b.st==='Lese ich' ? '<span class="badge">lese ich</span>' : b.st==='Gelesen' ? '<span class="badge">✓ gelesen</span>' : b.st==='Wunschliste' ? '<span class="badge">Wunsch</span>' : '';
  const meta = [b.r?`<span class="stars">${stars(b.r)}</span>`:'',esc(b.y||''),b.pg?`${b.pg} S.`:'',b.kd?'<span style="color:var(--accent)">Kindle</span>':''].filter(Boolean).join(' · ')||'&nbsp;';
  return `<button class="book" data-id="${esc(b.id)}"><div class="cover" style="background:${coverBg(b)}">${coverImg(b)}${badge}
    <div class="ct">${esc(b.t)}</div><div class="ca">${esc(b.a)}</div></div><div class="meta">${meta}</div></button>`;
}
// Cover: Bild über dem gestalteten Einband; lädt es nicht (oder nur ein Platzhalter-Pixel), bleibt der Einband sichtbar.
const coverImg = b => b.cv ? `<img class="cvimg" src="${esc(b.cv)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
document.addEventListener('load', e => { const i = e.target; if (i.classList && i.classList.contains('cvimg')) { if (i.naturalWidth < 20 || i.naturalHeight < 20) i.remove(); else i.closest('.cover, .dcover')?.classList.add('hasimg'); } }, true);
document.addEventListener('error', e => { const i = e.target; if (i.classList && i.classList.contains('cvimg')) i.remove(); }, true);
function row(b){
  return `<button class="book row" data-id="${esc(b.id)}"><span class="sw" style="background:${PALETTE[b.c]||'#777'}"></span>${b.cv?`<span class="rthumb">${coverImg(b)}</span>`:''}
    <span><div class="rt">${esc(b.t)}</div><div class="ra">${esc(b.a)}${b.y?' · '+b.y:''} · ${esc(b.c)}</div></span>
    <span class="rr">${b.r?`<span class="stars">${stars(b.r)}</span><br>`:''}${esc(b.st)}${b.kd?'<br><span style="color:var(--accent)">Kindle</span>':''}</span></button>`;
}
function render(){
  const r = filtered(), out = $('out'), info = $('info');
  info.innerHTML = `<span>${r.length.toLocaleString('de-DE')} ${r.length===1?'Buch':'Bücher'}</span>` +
    (state.tag ? `<span class="active-tag" id="clrTag">Tag: ${esc(state.tag)} ✕</span> <label style="display:flex;gap:5px;align-items:center"><input type="checkbox" id="sugT" ${state.sug?'checked':''}>inkl. Vorschläge</label>` : '');
  const t = $('clrTag'); if (t) t.onclick = ()=>{ state.tag=''; render(); };
  const sg = $('sugT'); if (sg) sg.onchange = ()=>{ state.sug=sg.checked; state.limit=60; render(); };
  if (!r.length){ out.innerHTML = '<div class="empty">Keine Bücher gefunden.</div>'; return; }
  out.innerHTML = `<div class="${state.view}">${r.slice(0,state.limit).map(state.view==='grid'?card:row).join('')}</div>` +
    (r.length>state.limit ? `<button class="btn more" id="more">Weitere ${Math.min(60,r.length-state.limit)} anzeigen (${(r.length-state.limit).toLocaleString('de-DE')} übrig)</button>` : '');
  const m = $('more'); if (m) m.onclick = ()=>{ state.limit+=60; render(); };
}
$('out').onclick = e => { const t=e.target.closest('.book'); if(t) openBook(B.find(b=>b.id===t.dataset.id)); };
let qto; $('q').oninput = ()=>{ clearTimeout(qto); qto=setTimeout(()=>{ state.q=$('q').value; state.limit=60; render(); },150); };
$('st').onchange = e=>{ state.st=e.target.value; state.limit=60; render(); };
$('lang').onchange = e=>{ state.lang=e.target.value; state.limit=60; render(); };
$('fmt').onchange = e=>{ state.fmt=e.target.value; state.limit=60; render(); };
$('sort').onchange = e=>{ state.sort=e.target.value; state.limit=60; render(); };
const setView = v => { state.view=v; LS('bb_view',v); $('vGrid').classList.toggle('on',v==='grid'); $('vList').classList.toggle('on',v==='list'); render(); };
$('vGrid').onclick=()=>setView('grid'); $('vList').onclick=()=>setView('list');

function showInCatalog(n){
  Object.assign(state,{q:'',cat:'',tag:'',st:'',lang:'',fmt:'',sug:true,limit:60}); $('q').value=''; $('fmt').value='';
  if (n.k==='c') state.cat=n.n; else if (n.k==='t') state.tag=n.n; else { state.q=n.n; $('q').value=n.n; }
  drawFilters(); render(); location.hash='katalog'; scrollTo({top:0});
}

// ---------- Detailansicht ----------
const dlg = $('dlg');
function openBook(b){
  if (!b) return;
  $('dh').style.background = coverBg(b);
  $('dh').innerHTML = `<button class="x" aria-label="Schließen">✕</button>${b.cv?`<div class="dcover">${coverImg(b)}</div>`:''}
    <h2>${esc(b.t)}</h2>${b.s?`<div style="opacity:.9">${esc(b.s)}</div>`:''}<div style="margin-top:8px;opacity:.95">${esc(b.a)}</div>`;
  const f = [['Status',esc(b.st)+(b.stk?' <span class="mut">(aus Kindle übernommen)</span>':'')],
    ['Format',b.fm==='Kindle'?'Kindle-E-Book':b.kd?'Gedruckt · auch auf Kindle':'Gedruckt'],
    ['Verliehen',b.lendTo?`an ${esc(b.lendTo)}${b.lendSince?' seit '+fmtDate(b.lendSince):''}`:''],
    ['Standort',esc(b.loc)],
    ['Bewertung',b.r?`<span class="stars">${stars(b.r)}</span>`:''],
    ['Kategorie',esc(b.c)+(b.g&&b.g!==b.c?` <span class="mut">(${esc(b.g)})</span>`:'')],
    ['Verlag',esc(b.p)],['Jahr',esc(b.y)],['Seiten',esc(b.pg)],['Sprache',esc(b.l)],['ISBN',esc(b.i)],
    ['Begonnen',fmtDate(b.ds)],['Beendet',fmtDate(b.df)],['Auf Kindle beendet',b.kdf&&b.kdf!==b.df?fmtDate(b.kdf):''],
    ['Kindle-Markierungen',b.km?`${b.km} <span class="mut">(Text nicht im Export)</span>`:''],['Hinzugefügt',fmtDate(b.da)]].filter(x=>x[1]);
  const chips = (arr,cls='') => `<div class="tagl">${arr.map(t=>`<button class="chip ${cls}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  $('db').innerHTML =
    `<div class="btnrow" style="margin-bottom:12px"><button class="btn on" id="bEdit">Bearbeiten</button>` +
    STATUS.filter(s=>s!==b.st).slice(0,3).map(s=>`<button class="btn" data-st="${s}">→ ${s}</button>`).join('') + `</div>` +
    (b.ka ? `<div class="btnrow kindlerow"><a class="btn on" href="https://lesen.amazon.de/?asin=${encodeURIComponent(b.ka)}" target="_blank" rel="noopener">📖 Buch lesen (Kindle im Browser)</a>
      <a class="btn" id="kApp" href="kindle://book?action=open&asin=${encodeURIComponent(b.ka)}">Kindle-App (Titel wird kopiert)</a>
      <a class="btn" href="https://www.amazon.de/dp/${encodeURIComponent(b.ka)}" target="_blank" rel="noopener">Bei Amazon</a></div>` : '') +
    `<dl class="facts">${f.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` +
    (b.tg&&b.tg.length?`<h3>Tags</h3>${chips(b.tg)}`:'') +
    (b.tt&&b.tt.length?`<h3>Inhaltliche Themen (Vorschlag)</h3>${chips(b.tt,'sug')}`:'') +
    (b.ts&&b.ts.length?`<h3>Vorgeschlagene Tags</h3>${chips(b.ts,'sug')}`:'') +
    (b.su?`<h3>Klappentext</h3><p>${esc(b.su)}</p>`:'') +
    (b.n?`<h3>Notizen</h3><div class="note">${esc(b.n)}</div>`:'') +
    (b.kn&&b.kn.length?`<h3>Kindle-Notizen</h3>${b.kn.map(n=>`<div class="note" style="margin-bottom:8px">${esc(n)}</div>`).join('')}`:'') +
    `<h3>Mehr vom Autor</h3><div class="tagl"><button class="chip" data-author="${esc(b.a)}">Alle Bücher von ${esc(b.a)}</button></div>`;
  dlg.dataset.id = b.id;
  if (!dlg.open) dlg.showModal(); $('db').scrollTop=0;
}
dlg.onclick = async e => {
  if (e.target===dlg || e.target.closest('.x')) return dlg.close();
  const b = B.find(x=>x.id===dlg.dataset.id);
  if (e.target.closest('#bEdit')) { dlg.close(); return editBook(b); }
  const s = e.target.closest('[data-st]');
  if (s) { await saveBook(b, {...b, st:s.dataset.st, ...(s.dataset.st==='Gelesen'&&!b.df?{df:Data.today()}:{}), ...(s.dataset.st==='Lese ich'&&!b.ds?{ds:Data.today()}:{})}); toast(`Status: ${s.dataset.st}`); return openBook(B.find(x=>x.id===b.id)); }
  const ka = e.target.closest('#kApp');
  if (ka) { e.preventDefault(); try { await navigator.clipboard.writeText(b.t); toast('Titel kopiert – in der Kindle-App in die Suche einfügen'); } catch(err) {} setTimeout(()=>{ location.href = ka.getAttribute('href'); }, 600); return; }
  const tg = e.target.closest('[data-tag]'); if (tg){ state.tag=tg.dataset.tag; state.limit=60; dlg.close(); render(); location.hash='katalog'; scrollTo({top:0}); }
  const au = e.target.closest('[data-author]'); if (au){ Object.assign(state,{q:au.dataset.author,cat:'',tag:'',limit:60}); $('q').value=state.q; drawFilters(); dlg.close(); render(); location.hash='katalog'; scrollTo({top:0}); }
};

// ---------- Bearbeiten / Neu ----------
const FIELDS = [
  ['t','Titel','text',true],['s','Untertitel','text'],['a','Autor(en)','text',true],['p','Verlag','text'],
  ['y','Erscheinungsjahr','text'],['i','ISBN','text'],['pg','Seiten','text'],['l','Sprache','text'],
  ['c','Kategorie','cat'],['st','Status','status'],['r','Bewertung','rating'],['fmt','Format','format'],
  ['ds','Begonnen','date'],['df','Beendet','date'],['da','Hinzugefügt','date'],['loc','Standort (Regal)','text'],
  ['lendTo','Verliehen an','text'],['lendSince','Verliehen seit','date'],
  ['cv','Cover','cover'],['ka','Kindle-ASIN','text'],['tg','Tags (mit Komma getrennt)','list'],['tt','Inhaltliche Themen','list'],['su','Klappentext','area'],['n','Notizen','area'],
];
const LABEL = Object.fromEntries(FIELDS.map(f=>[f[0],f[1].replace(/ \(.*\)/,'')]));
function editBook(b, prefill){
  const isNew = !b; const v = {...(b||{}), ...(prefill||{})};
  if (isNew){ v.st = v.st||'Ungelesen'; v.da = v.da||Data.today(); v.c = v.c||'Ohne Kategorie'; }
  v.fmt = v.fm==='Kindle' ? 'kindle' : v.kd ? 'beides' : 'buch';
  const input = ([k,label,type,req]) => {
    const val = Array.isArray(v[k]) ? v[k].join(', ') : (v[k]??'');
    let el;
    if (type==='cat') el = `<select name="${k}">${[...new Set([...CATEGORIES, v.c].filter(Boolean))].map(c=>`<option ${c===v.c?'selected':''}>${esc(c)}</option>`).join('')}</select>`;
    else if (type==='status') el = `<select name="${k}">${STATUS.map(s=>`<option ${s===v.st?'selected':''}>${s}</option>`).join('')}</select>`;
    else if (type==='rating') el = `<select name="${k}">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${n===(v.r||0)?'selected':''}>${n?'★'.repeat(n):'keine'}</option>`).join('')}</select>`;
    else if (type==='format') el = `<select name="fmt"><option value="buch" ${v.fmt==='buch'?'selected':''}>Gedruckt</option><option value="beides" ${v.fmt==='beides'?'selected':''}>Gedruckt + Kindle</option><option value="kindle" ${v.fmt==='kindle'?'selected':''}>Nur Kindle</option></select>`;
    else if (type==='cover') el = `<div class="cvedit"><div class="cvprev">${v.cv?`<img src="${esc(v.cv)}" alt="" referrerpolicy="no-referrer">`:'<span class="mut">kein Cover</span>'}</div>
        <div class="btnrow"><label class="btn filebtn">📷 Cover fotografieren<input type="file" accept="image/*" capture="environment" id="cvFile" hidden></label>
        <button type="button" class="btn" id="cvClear">Entfernen</button></div>
        <input name="cv" type="hidden" value="${esc(v.cv||'')}"><input type="url" id="cvUrl" placeholder="oder Bild-Adresse (https://…)" value="${esc(/^data:/.test(v.cv||'')?'':(v.cv||''))}"></div>`;
    else if (type==='area') el = `<textarea name="${k}" rows="${k==='su'?5:3}">${esc(val)}</textarea>`;
    else el = `<input name="${k}" type="${type==='date'?'date':'text'}" value="${esc(String(val).slice(0, type==='date'?10:undefined))}" ${req?'required':''} ${k==='y'||k==='pg'?'inputmode="numeric"':''}>`;
    return `<label class="fl ${type==='cover'||type==='area'||type==='list'||k==='t'||k==='s'||k==='a'?'wide':''}"><span>${label}</span>${el}</label>`;
  };
  $('editForm').innerHTML = `<div class="eh"><h2>${isNew?'Neues Buch':'Bearbeiten'}</h2><button type="button" class="btn" id="eCancel">Abbrechen</button></div>
    <div class="eb"><div class="fgrid">${FIELDS.map(input).join('')}</div>
    ${isNew?'':`<p style="margin-top:18px"><button type="button" class="btn danger" id="eDel">Buch löschen</button></p>`}</div>
    <div class="ef"><button type="submit" class="btn on" id="eSave">${isNew?'Hinzufügen':'Speichern'}</button></div>`;
  $('eCancel').onclick = ()=>$('edit').close();
  const cvIn = $('editForm').querySelector('input[name=cv]'), cvPrev = $('editForm').querySelector('.cvprev');
  const setCv = u => { cvIn.value = u; cvPrev.innerHTML = u ? `<img src="${esc(u)}" alt="" referrerpolicy="no-referrer">` : '<span class="mut">kein Cover</span>'; };
  $('cvFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; setCv(await shrinkImage(f)); $('cvUrl').value=''; };
  $('cvClear').onclick = ()=>{ setCv(''); $('cvUrl').value=''; };
  $('cvUrl').onchange = e => { const u = e.target.value.trim(); if (!u || /^https:\/\//.test(u)) setCv(u); else toast('Bitte eine https-Adresse angeben.'); };
  if (!isNew) $('eDel').onclick = async ()=>{
    if (!$('eDel').dataset.sure){ $('eDel').dataset.sure='1'; $('eDel').textContent='Wirklich löschen? Nochmal tippen'; return; }
    await saveBook(b, {...b, del:true}); $('edit').close(); toast('Buch gelöscht');
  };
  $('editForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData($('editForm')); const n = {...(b||{})};
    for (const [k,,type] of FIELDS){
      if (type==='format') continue;
      let x = fd.get(k); if (x===null) continue;
      x = type==='list' ? list(x) : type==='rating' ? +x : String(x).trim();
      n[k] = x;
    }
    const f = fd.get('fmt'); n.fm = f==='kindle' ? 'Kindle' : ''; n.kd = f!=='buch' ? 1 : 0;
    if (n.i) { const i13 = ISBN.to13(n.i); if (i13) n.i = i13; }
    if (!n.t || !n.a) return toast('Titel und Autor werden gebraucht.');
    if (isNew){ n.id = Data.newId(); n.tg = n.tg||[]; }
    await saveBook(isNew?null:b, n);
    $('edit').close(); toast(isNew?'Buch hinzugefügt':'Gespeichert');
    openBook(B.find(x=>x.id===n.id));
  };
  $('edit').showModal(); $('editForm').querySelector('.eb').scrollTop = 0;
}

// Foto verkleinern (max. 480 px), damit Sicherungen klein bleiben
function shrinkImage(file){
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width*k); c.height = Math.round(img.height*k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .8)); };
    img.onerror = rej; img.src = url;
  });
}
async function saveBook(old, n){
  n = {...n}; delete n.hay; delete n.fmt;
  ['fm','kd','lendTo','lendSince','loc','stk'].forEach(k=>{ if(!n[k]) delete n[k]; });
  n.u = Data.now();
  if (old && n.st!==old.st) delete n.stk;
  await Data.putBooks([n]);
  let text;
  if (!old) text = 'neu angelegt';
  else if (n.del) text = 'gelöscht';
  else {
    const ch = [];
    for (const k of Object.keys(LABEL)){
      const a = JSON.stringify(old[k]??(Array.isArray(n[k])?[]:'')), c = JSON.stringify(n[k]??(Array.isArray(old[k])?[]:''));
      if (a!==c && !(['""','[]','0','null'].includes(a) && ['""','[]','0','null'].includes(c))) ch.push(k==='su'||k==='n'||k==='cv' ? `${LABEL[k]} geändert` : `${LABEL[k]}: ${fmtV(old[k])} → ${fmtV(n[k])}`);
    }
    if ((old.fm||'')!==(n.fm||'') || !!old.kd!==!!n.kd) ch.push('Format geändert');
    if (!ch.length) { await load(); refreshViews(); return; }
    text = ch.join('; ');
  }
  await Data.logChange([old?(n.del?'Gelöscht':'Bearbeitet'):'Neu', n.t, n.a, text, Data.today()]);
  await load(); refreshViews();
}
const fmtV = v => Array.isArray(v) ? (v.join(', ')||'—') : (v===''||v==null||v===0) ? '—' : /^\d{4}-\d\d-\d\d/.test(v) ? fmtDate(v) : String(v);

// ---------- Hinzufügen: Scan / ISBN / von Hand ----------
const addDlg = $('addDlg');
function openAdd(){
  $('addBody').innerHTML = `<div class="eh"><h2>Buch hinzufügen</h2><button class="btn" id="aClose">Schließen</button></div>
    <div class="scanbox"><video id="vid" playsinline muted></video><div class="scanline"></div></div>
    <div class="btnrow"><button class="btn on" id="aScan">📷 Barcode scannen</button></div>
    <label class="fl wide" style="margin-top:14px"><span>ISBN eingeben</span>
      <div style="display:flex;gap:8px"><input id="aIsbn" inputmode="numeric" placeholder="978…" style="flex:1"><button class="btn on" id="aLookup">Nachschlagen</button></div></label>
    <p id="aMsg" class="mut"></p>
    <p><button class="btn" id="aManual">Ohne ISBN von Hand erfassen</button></p>`;
  $('aClose').onclick = ()=>{ ISBN.stopScan(); addDlg.close(); };
  $('aManual').onclick = ()=>{ ISBN.stopScan(); addDlg.close(); editBook(null); };
  $('aScan').onclick = async ()=>{
    $('aMsg').textContent = 'Barcode auf der Rückseite vor die Kamera halten …';
    $('addBody').querySelector('.scanbox').classList.add('on');
    try { await ISBN.startScan($('vid'), code => { $('addBody').querySelector('.scanbox').classList.remove('on'); $('aIsbn').value = code; handleIsbn(code); }); }
    catch (e) { $('aMsg').textContent = 'Kamera nicht verfügbar: ' + e.message + ' – ISBN bitte eintippen.'; }
  };
  $('aLookup').onclick = ()=>handleIsbn($('aIsbn').value);
  $('aIsbn').onkeydown = e=>{ if (e.key==='Enter'){ e.preventDefault(); handleIsbn($('aIsbn').value); } };
  addDlg.showModal();
}
async function handleIsbn(raw){
  const isbn = ISBN.to13(raw);
  if (!isbn) { $('aMsg').textContent = 'Das ist keine gültige ISBN.'; return; }
  const dup = B.find(b=>b.i===isbn);
  if (dup) {
    $('aMsg').innerHTML = `Schon in der Bibliothek: <b>${esc(dup.t)}</b> – ${esc(dup.a)}. <button class="btn" id="aOpen">Öffnen</button> <button class="btn" id="aAnyway">Trotzdem neu anlegen</button>`;
    $('aOpen').onclick = ()=>{ addDlg.close(); openBook(dup); };
    $('aAnyway').onclick = ()=>lookupAndEdit(isbn);
    return;
  }
  lookupAndEdit(isbn);
}
async function lookupAndEdit(isbn){
  $('aMsg').textContent = navigator.onLine ? 'Suche in Google Books und Open Library …' : 'Offline – Buchdaten können nicht nachgeschlagen werden.';
  const d = navigator.onLine ? await ISBN.lookup(isbn) : null;
  const pre = d || { i: isbn };
  if (d) {
    const gm = REGELN.genre_kategorien || {};
    for (const [cat, gs] of Object.entries(gm)) if (d.g && gs.some(g=>norm(d.g).startsWith(norm(g)))) { pre.c = cat; break; }
    const same = B.find(b=>norm(b.t)===norm(d.t) && norm(b.a).split(' ').some(w=>w.length>3 && norm(d.a).includes(w)));
    if (same) toast(`Hinweis: „${same.t}“ gibt es schon (andere Ausgabe?)`);
  } else if (navigator.onLine) toast('Nichts gefunden – bitte von Hand ergänzen.');
  addDlg.close(); editBook(null, pre);
}
$('addBtn').onclick = openAdd;

// ---------- Historie ----------
let hLimit = 100;
async function buildHist(){
  const log = await Data.getMeta('historie', []);
  const rows = await Data.getMeta('aenderungen', []);
  $('hLog').innerHTML = log.slice().reverse().map(l=>`<li><span class="lb">${esc(l.art)}</span>${esc(l.text)} <span class="mut" style="font-size:12px">· ${fmtDate(l.datum)}</span></li>`).join('');
  const types = [...new Set(rows.map(r=>r[0]))];
  const ht = $('ht'), cur = ht.value;
  ht.innerHTML = '<option value="">Alle Arten</option>' + types.map(t=>`<option>${esc(t)}</option>`).join(''); ht.value = cur;
  const draw = ()=>{
    const terms = norm($('hq').value).split(/\s+/).filter(Boolean);
    const r = rows.filter(x=>(!ht.value||x[0]===ht.value)&&terms.every(t=>norm(x.join(' ')).includes(t))).reverse();
    $('hCount').textContent = `${r.length.toLocaleString('de-DE')} Einträge`;
    $('hBody').innerHTML = r.slice(0,hLimit).map(x=>`<tr><td>${esc(x[0])}</td><td><b>${esc(x[1])}</b><br><span class="a">${esc(x[2])}</span></td><td>${esc(x[3])}</td><td class="hide-s">${fmtDate(x[4])}</td></tr>`).join('');
    $('hMore').style.display = r.length>hLimit?'block':'none';
  };
  $('hq').oninput=()=>{hLimit=100;draw();}; ht.onchange=()=>{hLimit=100;draw();};
  $('hMore').onclick=()=>{hLimit+=200;draw();};
  draw();
}

// ---------- Daten / Sicherung ----------
async function backupJSON(){
  const obj = await Data.exportObject();
  const name = `bibliothek-${Data.today()}.json`;
  const r = await Data.saveFile(name, JSON.stringify(obj), 'application/json');
  if (r !== 'abgebrochen') {
    await Data.setMeta('letzteSicherung', Data.now()); await Data.setMeta('ungesichert', 0);
    toast(r==='geteilt' ? 'Sicherung übergeben – in iCloud Drive ablegen' : 'Sicherung heruntergeladen'); drawHeader(); buildData();
  }
}
async function buildData(){
  const last = await Data.getMeta('letzteSicherung', null), dirty = await Data.getMeta('ungesichert', 0);
  $('backupState').innerHTML = (last ? `Letzte Sicherung: <b>${fmtDate(last)}</b>. ` : '<b>Noch keine Sicherung erstellt.</b> ') +
    (dirty ? `${dirty} ${dirty===1?'Änderung':'Änderungen'} seitdem.` : 'Alles gesichert.');
  let est = '';
  try { const e = await navigator.storage.estimate(); est = ` · belegt ca. ${(e.usage/1048576).toFixed(1)} MB`; } catch(e){}
  let pers = false; try { pers = navigator.storage && navigator.storage.persisted && await navigator.storage.persisted(); } catch(e){}
  $('storageInfo').innerHTML = `${B.length.toLocaleString('de-DE')} Bücher${est}. ` + (pers ? 'Dauerhafter Speicher ist aktiv.' :
    'Tipp: Auf iPad/iPhone die App über <b>Teilen → „Zum Home-Bildschirm“</b> installieren – dann bleiben die Daten zuverlässig erhalten. Regelmäßige Sicherungen in iCloud Drive schützen zusätzlich.');
  $('version').textContent = 'Version ' + APP_VERSION;
  const kl = await Data.getMeta('kindleAbgleich', null);
  $('kindleLast').textContent = kl ? `Letzter Kindle-Abgleich: ${fmtDate(kl)}` : 'Bisheriger Kindle-Stand: Übernahme vom 18.11.2026.';
}
$('expJson').onclick = backupJSON;
$('updBtn').onclick = async ()=>{
  toast('Suche nach Update …');
  try { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update(); } catch(e){}
  setTimeout(()=>location.reload(), 1200);
};
$('expCsv').onclick = async ()=>{ const r = await Data.saveFile(`bibliothek-${Data.today()}.csv`, await Data.exportCSV(), 'text/csv'); if (r!=='abgebrochen') toast('Tabelle exportiert'); };
async function importFile(file, mode, out){
  try {
    const obj = JSON.parse(await file.text());
    const res = await Data.importObject(obj, mode);
    if (obj.regeln) await Data.setMeta('regeln', obj.regeln);
    if (res.ergaenzung) { await Data.log('Ergänzung', `${obj.beschreibung||'Ergänzung'}: ${res.aktualisiert} Bücher ergänzt.`); out.textContent = `Fertig: ${res.aktualisiert} Bücher ergänzt.`; await load(); refreshViews(); return true; }
    await Data.log('Sicherung', `${mode==='replace'?'Bibliothek ersetzt durch':'Zusammengeführt mit'} Sicherung vom ${fmtDate(obj.exportiert)} (${obj.geraet||'?'}): ${res.neu} neu, ${res.aktualisiert} aktualisiert.`);
    await Data.setMeta('initialisiert', true);
    out.textContent = `Fertig: ${res.neu} Bücher neu, ${res.aktualisiert} aktualisiert.`;
    await load(); refreshViews(); return true;
  } catch(e){ out.textContent = 'Fehler: ' + e.message; return false; }
}
$('impMerge').onchange = e => { if (e.target.files[0]) importFile(e.target.files[0], 'merge', $('impResult')); e.target.value=''; };
$('impReplace').onchange = e => { if (e.target.files[0] && confirmReplace()) importFile(e.target.files[0], 'replace', $('impResult')); e.target.value=''; };
function confirmReplace(){ return window.confirm ? confirm('Alle Bücher auf diesem Gerät durch die Datei ersetzen?') : true; }
$('impFirst').onchange = async e => { if (e.target.files[0] && await importFile(e.target.files[0], 'replace', $('firstResult'))) { location.hash='katalog'; route(); } e.target.value=''; };
$('startEmpty').onclick = async e => { e.preventDefault(); await Data.setMeta('initialisiert', true); await Data.log('Start', 'Leere Bibliothek angelegt.'); location.hash='katalog'; route(); };

// ---------- Kindle-Abgleich ----------
let kindlePlan = null;
$('kindleZip').onchange = async e => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
  const out = $('kindleOut'); out.innerHTML = '<p>Lese Kindle-Export …</p>';
  try {
    if (!window.JSZip) throw new Error('ZIP-Bibliothek nicht geladen – App bitte neu öffnen.');
    const kd = await Kindle.readExport(files, t => { out.innerHTML = `<p>${esc(t)}</p>`; });
    kindlePlan = Kindle.plan(kd, ALL);
    kindlePlan.stats = { buecher: kd.filter(x=>x.status==='Active').length, beendet: kd.filter(x=>x.beendet).length };
    showKindlePlan();
  } catch (err) { out.innerHTML = `<p>Fehler: ${esc(err.message)}</p>`; }
};
function showKindlePlan(){
  const p = kindlePlan, out = $('kindleOut');
  const st = p.updates.filter(u=>u.set.st), nt = p.updates.filter(u=>u.set.kn), mark = p.updates.filter(u=>u.set.kd);
  const quiet = p.updates.length - new Set([...st,...nt,...mark]).size;
  const li = (arr, f) => arr.length ? `<details><summary>${arr.length} anzeigen</summary><ul class="klist">${arr.slice(0,300).map(f).join('')}</ul></details>` : '';
  out.innerHTML = `<p>Export gelesen: ${p.stats.buecher} Kindle-Bücher, ${p.stats.beendet} als beendet erfasst.</p>
    <ul class="ksum">
      <li><b>${p.neu.length}</b> neue Kindle-Bücher (gekauft, noch nicht in der Bibliothek) ${li(p.neu, b=>`<li>${esc(b.t)} – <span class="mut">${esc(b.a)}</span></li>`)}</li>
      <li><b>${st.length}</b> Bücher auf „Gelesen“ setzen (auf Kindle beendet) ${li(st, u=>`<li>${esc(u.b.t)} – <span class="mut">${esc(u.why.find(w=>w.startsWith('Status'))||'')}</span></li>`)}</li>
      <li><b>${mark.length}</b> vorhandene Bücher als „auch auf Kindle“ kennzeichnen ${li(mark, u=>`<li>${esc(u.b.t)}</li>`)}</li>
      <li><b>${nt.length}</b> Bücher mit neuen Kindle-Notizen ${li(nt, u=>`<li>${esc(u.b.t)}</li>`)}</li>
      ${quiet>0?`<li><b>${quiet}</b> Bücher mit aktualisierten Kindle-Angaben (Markierungen, Datum)</li>`:''}
    </ul>
    ${p.neu.length||p.updates.length ? `<div class="btnrow"><button class="btn on" id="kApply">Änderungen übernehmen</button><button class="btn" id="kCancel">Verwerfen</button></div>
    <p class="hint2">Neue Kindle-Bücher erscheinen unter „Ohne Kategorie“ und lassen sich dort einordnen.</p>` : '<p><b>Alles ist bereits auf dem neuesten Stand.</b></p>'}`;
  const a = $('kApply'); if (a) a.onclick = applyKindlePlan;
  const c = $('kCancel'); if (c) c.onclick = ()=>{ kindlePlan=null; out.innerHTML='<p class="hint2">Verworfen – nichts geändert.</p>'; };
}
async function applyKindlePlan(){
  const p = kindlePlan; if (!p) return;
  const now = Data.now(), today = Data.today(), put = [], rows = [];
  for (const u of p.updates) {
    const b = {...u.b, ...u.set, u: now}; delete b.hay; put.push(b);
    if (u.why.length) rows.push(['Kindle', b.t, b.a, u.why.join('; '), today]);
  }
  for (const b of p.neu) { put.push({...b, u: now}); rows.push(['Kindle', b.t, b.a, 'neu aufgenommen (Kindle-Kauf)', today]); }
  await Data.putBooks(put);
  const ae = await Data.getMeta('aenderungen', []); await Data.setMeta('aenderungen', ae.concat(rows));
  await Data.setMeta('ungesichert', (await Data.getMeta('ungesichert', 0)) + rows.length);
  const st = p.updates.filter(u=>u.set.st).length;
  await Data.log('Kindle', `Kindle-Export abgeglichen: ${p.neu.length} neue Kindle-Bücher, ${st} als gelesen übernommen, ${p.updates.length} Bücher aktualisiert.`);
  await Data.setMeta('kindleAbgleich', today);
  kindlePlan = null; await load(); refreshViews();
  $('kindleOut').innerHTML = `<p><b>Übernommen.</b> ${p.neu.length} neu, ${p.updates.length} aktualisiert. Denk an eine Sicherung.</p>`;
  toast('Kindle-Abgleich übernommen');
}

// ---------- Navigation ----------
function refreshViews(){
  drawHeader(); drawFilters(); render();
  const h = location.hash;
  if (h==='#landkarte') { buildMap(computeGraph(B, REGELN.karte_ausgeblendete_tags)); mapDirty=false; }
  if (h==='#historie') buildHist();
  if (h==='#daten') buildData();
}
async function route(){
  const init = (await Data.getMeta('initialisiert', false)) || B.length>0;
  const h = init ? (location.hash||'#katalog') : '#welcome';
  document.body.className = {'#landkarte':'map','#historie':'hist','#daten':'data','#welcome':'welcome'}[h] || '';
  [['tKat','#katalog'],['tMap','#landkarte'],['tHist','#historie'],['tData','#daten']].forEach(([id,x])=>$(id).classList.toggle('on', h===x || (x==='#katalog' && !['#landkarte','#historie','#daten','#welcome'].includes(h))));
  if (h==='#landkarte' && mapDirty) { buildMap(computeGraph(B, REGELN.karte_ausgeblendete_tags)); mapDirty=false; }
  if (h==='#historie') buildHist();
  if (h==='#daten') buildData();
}
addEventListener('hashchange', route);

(async function main(){
  await Data.persist();
  await load();
  setView(state.view); drawFilters(); render(); await drawHeader(); route();
  if ('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
