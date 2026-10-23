// Portmonka 08 – UI nad deterministickým jádrem (core.js) a datovou vrstvou (store.js).
import * as C from './core.js?v=8.0';
import { createFirestoreStore, createMemoryStore } from './store.js?v=8.0';

const DEMO = new URLSearchParams(location.search).has('demo');
const S = { tab: 'ted', user: null, cases: [], loaded: false, filter: 'all', q: '', open: null, incMode: 'month', sel: new Set(), showWhy: false, busy: false, err: null };
let store = null;

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const today = () => C.localToday();
const K = C.fmtKc;
const SRC = s => C.SOURCES[s] || { name: s, color: '#a59fc9', key: 'x' };
const plural = (n, a, b, c) => n === 1 ? a : n >= 2 && n <= 4 ? b : c;

const ICON = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  out: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  reload: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>'
};
const MARK = '<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="11" width="34" height="24" rx="8" fill="none" stroke="#5eead4" stroke-width="3"></rect><path d="M11 11 C11 4 29 4 29 11" fill="none" stroke="#b493ff" stroke-width="3" stroke-linecap="round"></path><circle cx="20" cy="23" r="4" fill="#5eead4"></circle><circle cx="31" cy="6" r="2" fill="#f5b84a"></circle></svg>';
const ELF = '<svg viewBox="0 0 86 96" role="img" aria-label="Skřítek Portmonky"><line x1="43" y1="14" x2="43" y2="4" stroke="#b493ff" stroke-width="3" stroke-linecap="round"></line><circle cx="43" cy="4" r="4" fill="#f5b84a"></circle><path d="M14 52 C14 26 72 26 72 52 L72 70 C72 84 14 84 14 70 Z" fill="#1d1938" stroke="#5eead4" stroke-width="3"></path><ellipse class="eye" cx="32" cy="50" rx="6" ry="7" fill="#f1eefe"></ellipse><ellipse class="eye" cx="54" cy="50" rx="6" ry="7" fill="#f1eefe"></ellipse><circle cx="33" cy="51" r="3" fill="#0c0a1d"></circle><circle cx="55" cy="51" r="3" fill="#0c0a1d"></circle><path d="M36 66 Q43 71 50 66" fill="none" stroke="#5eead4" stroke-width="2.5" stroke-linecap="round"></path><path d="M14 60 L4 54" stroke="#5eead4" stroke-width="3" stroke-linecap="round"></path><path d="M72 60 L82 52" stroke="#5eead4" stroke-width="3" stroke-linecap="round"></path><rect x="30" y="80" width="26" height="10" rx="4" fill="#f5b84a"></rect></svg>';

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }

/* ---------------- data ---------------- */
function items() { return C.withStatus(C.flatten(S.cases), today()); }
function caseById(id) { return S.cases.find(c => c.id === id); }
function instById(cid, iid) { return caseById(cid)?.installments.find(i => i.id === iid); }
async function reload() {
  try { const r = await store.load(); S.cases = r.cases; S.loaded = true; S.err = null; }
  catch (e) { console.error(e); S.err = 'Data se nepodařilo načíst: ' + (e.code || e.message); }
  render();
  const bad = S.cases.filter(c => !C.integrity(c));
  if (bad.length) toast('Pozor: ' + bad.length + ' ' + plural(bad.length, 'případ má', 'případy mají', 'případů má') + ' nesedící součet splátek.');
}
async function run(fn, okMsg) {
  if (S.busy) return; S.busy = true;
  try { await fn(); await reload(); if (okMsg) toast(okMsg); return true; }
  catch (e) { console.error(e); toast('Nepovedlo se: ' + (e.code === 'permission-denied' ? 'Firestore zápis odmítl (pravidla).' : (e.message || e))); return false; }
  finally { S.busy = false; }
}

/* ---------------- kostra ---------------- */
function header() {
  const tf = [['ted', 'Teď'], ['prijem', 'Příjem'], ['pripady', 'Případy'], ['souhrn', 'Souhrn']];
  const tx = [['cas', 'Čas'], ['obj', 'Objevitel'], ['lab', 'Laboratoř']];
  return `<header class="top"><div class="top-in">
    <div class="brand">${MARK}<div><b>Portmonka</b><small>zvědavý účetní skřítek</small></div></div>
    <nav class="nav" aria-label="Pohledy"><span class="grp">Finance</span>${tf.map(t => `<button type="button" class="tab${S.tab === t[0] ? ' on' : ''}" data-a="tab" data-t="${t[0]}">${t[1]}</button>`).join('')}
      <span class="grp">Objevování</span>${tx.map(t => `<button type="button" class="tab x${S.tab === t[0] ? ' on' : ''}" data-a="tab" data-t="${t[0]}">${t[1]}</button>`).join('')}</nav>
    <div class="user">${DEMO ? '<span class="demo">UKÁZKOVÁ DATA</span>' : ''}
      <button type="button" class="btn solid add" data-a="add">${ICON.plus}<span>Přidat</span></button>
      <button type="button" class="ibtn" data-a="reload" aria-label="Načíst znovu">${ICON.reload}</button>
      <button type="button" class="ibtn" data-a="logout" aria-label="${DEMO ? 'Ukončit ukázku' : 'Odhlásit'}">${ICON.out}</button></div>
  </div></header>`;
}
function render() {
  const app = $('#app');
  if (!S.user) {
    app.innerHTML = `<div class="wrap"><section class="login card">${MARK.replace('class="mark"', 'class="mark" style="width:64px;height:64px"')}
      <h1>Portmonka</h1><p>Zvědavý účetní skřítek. Přihlas se přes Google, data se ukládají do tvého zabezpečeného prostoru ve Firestore.</p>
      <div class="btns" style="justify-content:center;margin-top:18px"><button type="button" class="btn solid" data-a="login">Přihlásit přes Google</button>
      <a class="btn ghost" href="?demo=1" style="text-decoration:none;display:inline-flex;align-items:center">Prohlédnout s ukázkovými daty</a></div></section></div>`;
    return;
  }
  const I = items();
  let body = '';
  if (!S.loaded) body = `<div class="empty">Načítám…</div>`;
  else if (S.tab === 'ted') body = viewTed(I);
  else if (S.tab === 'prijem') body = viewPrijem(I);
  else if (S.tab === 'pripady') body = viewPripady(I);
  else if (S.tab === 'souhrn') body = viewSouhrn(I);
  else body = viewSoon(S.tab);
  app.innerHTML = `<div class="wrap">${header()}${S.err ? `<div class="warnbox" style="margin-bottom:14px">${esc(S.err)}</div>` : ''}${body}
    <div class="foot">Portmonka 08 · ${DEMO ? 'ukázková data, nic se neukládá' : esc(S.user.email)} · Matematika = aplikace, interpretace = Skřítek.</div></div>`;
}

/* ---------------- TEĎ ---------------- */
function viewTed(I) {
  const T = today();
  const ready = I.filter(i => i.st === 'READY').sort((a, b) => a.claimDate.localeCompare(b.claimDate));
  const readySum = C.sumMinor(ready);
  const selItems = ready.filter(i => S.sel.has(i.caseId + '|' + i.id));
  const inv = I.filter(i => i.st === 'INVOICED');
  const wait = I.filter(i => i.st === 'WAITING');
  const tot = C.totals(I, T);
  const inc = C.income(I, 'month', T);
  const elf = C.skritek(I, T);
  // na cestě – seskupit podle faktury
  const groups = {}; for (const i of inv) { const k = i.invoiceId || ('solo:' + i.caseId + i.id); (groups[k] = groups[k] || []).push(i); }
  const gl = Object.entries(groups).map(([k, xs]) => ({ k, xs, no: xs[0].invoiceNo, at: xs[0].invoicedAt, sum: C.sumMinor(xs) })).sort((a, b) => a.at.localeCompare(b.at));
  const metrics = [
    { k: 'Na cestě', v: K(tot.INVOICED), sub: inv.length + ' ' + plural(inv.length, 'splátka vyfakturována', 'splátky vyfakturovány', 'splátek vyfakturováno') + ', nezaplaceno', c: '#f5b84a' },
    { k: 'Přišlo · ' + C.monShort(T), v: K(inc.cur.total), sub: 'skutečné platby tento měsíc', c: '#f1eefe' },
    { k: 'Celkem čeká', v: K(tot.WAITING + tot.READY), sub: 'lze fakturovat + budoucí nároky', c: '#5eead4' },
    { k: 'Tempo', v: K(inc.avg), sub: 'průměr za měsíc (6 měsíců)', c: '#b493ff' }
  ];
  return `<div class="grid">
  <div class="hero">
    <section class="mission"><div class="stars" aria-hidden="true"><i style="left:8%;top:18%"></i><i style="left:72%;top:12%;animation-delay:1s"></i><i style="left:88%;top:62%;animation-delay:2s"></i><i style="left:40%;top:80%;animation-delay:.5s"></i><i style="left:58%;top:30%;animation-delay:1.6s"></i></div>
      <div class="k" style="color:#8fd8cc">Dnešní mise</div>
      <div class="big">${K(readySum)}</div>
      <p>můžeš vyfakturovat hned teď · ${ready.length} ${plural(ready.length, 'položka čeká', 'položky čekají', 'položek čeká')} na tvůj krok</p>
      ${ready.map(i => `<div class="act"><input class="chk" type="checkbox" data-a="sel" data-c="${i.caseId}" data-i="${i.id}" aria-label="Vybrat ${esc(i.title)}" ${S.sel.has(i.caseId + '|' + i.id) ? 'checked' : ''}>
        <span class="dot" style="background:${SRC(i.source).color}"></span>
        <div class="l" data-a="open" data-c="${i.caseId}"><b>${esc(SRC(i.source).name)} · ${esc(i.title)}</b><span>${esc(i.label)} · nárok od ${C.fmtDateShort(i.claimDate)}</span></div>
        <span class="amt">${K(i.amountMinor)}</span></div>`).join('')}
      ${ready.length ? `<div class="bulk"><button type="button" class="btn solid" data-a="inv-sel" ${selItems.length ? '' : 'disabled'}>Vyfakturovat vybrané${selItems.length ? ' · ' + selItems.length + ' · ' + K(C.sumMinor(selItems)) : ''}</button>
        <button type="button" class="btn ghost" data-a="sel-all">${selItems.length === ready.length ? 'Zrušit výběr' : 'Vybrat vše'}</button></div>`
        : `<p style="margin-top:12px">Všechno vyfakturováno. Skřítek je spokojený.</p>`}
    </section>
    <section class="card"><div class="k">Portmonka si všimla</div>
      <div class="elf" style="margin-top:12px">${ELF}<div class="bubble">
        ${elf ? `<span class="tagc">${esc(elf.cat)}</span><div class="hl">Hele… ${esc(elf.title)}</div><div class="meta">${esc(elf.short)}</div>
          <div class="btns"><button type="button" class="btn ghost" data-a="why">${S.showWhy ? 'Schovat důkazy' : 'Proč si to myslím?'}</button></div>
          ${S.showWhy ? `<ul class="ev">${elf.evidence.map(e => `<li>${esc(e)}</li>`).join('')}</ul><div class="meta" style="margin-top:6px">Fakt = spočítáno z dat · Hypotéza = stopa, ne jistota</div>` : ''}`
        : `<span class="tagc">Klid</span><div class="hl">Zatím nic zvláštního.</div><div class="meta">Dívám se na čísla. Až mi něco nebude sedět, ozvu se.</div>`}
      </div></div></section>
  </div>
  <div class="grid g4">${metrics.map(m => `<div class="card metric"><div class="k">${m.k}</div><div class="v" style="color:${m.c}">${m.v}</div><span>${m.sub}</span></div>`).join('')}</div>
  ${gl.length ? `<section class="card"><div class="k">Na cestě · vyfakturováno, čeká na platbu</div>
    ${gl.map(g => `<div class="row"><div class="l"><b>${g.no ? 'Faktura ' + esc(g.no) : esc(SRC(g.xs[0].source).name + ' · ' + g.xs[0].title)}</b><span>${g.xs.length > 1 || g.no ? g.xs.map(x => esc(x.title)).join(', ') + ' · ' : esc(g.xs[0].label) + ' · '}vyfakturováno ${C.fmtDateShort(g.at)} (${C.diffDays(g.at, T)} dní)</span></div>
      <span class="mono">${K(g.sum)}</span><button type="button" class="btn" data-a="pay-group" data-k="${esc(g.k)}">Přišlo na účet</button></div>`).join('')}</section>` : ''}
  ${timeline(I, T)}
  <section class="card"><div class="k">Výhled nároků · další měsíce</div>
    <div class="outl">${C.outlook(I, T).map(o => `<div><span class="meta">${o.label}</span><b>${K(o.total)}</b><span class="meta">${o.count} ${plural(o.count, 'splátka', 'splátky', 'splátek')}</span></div>`).join('')}</div>
    ${wait.some(C.isBlocked) ? `<div class="meta" style="margin-top:10px">K tomu čeká na podmínku ${K(C.sumMinor(wait.filter(C.isBlocked)))} (2. části GOORN, servis Domovea). Datum zatím neznáme, proto nejsou ve výhledu.</div>` : ''}
  </section></div>`;
}
function timeline(I, T) {
  const t0 = C.addDays(T, -60), t1 = C.addDays(T, 300), span = C.diffDays(t0, t1);
  const pos = d => Math.max(0, Math.min(100, C.diffDays(t0, d) / span * 100));
  const ticks = []; for (let k = 0; k < 13; k++) { const s = C.addMonths(C.startOfMonth(t0), k); if (s >= t0 && s <= t1) ticks.push(`<div class="tick" style="left:calc(92px + (100% - 92px) * ${pos(s) / 100})"><span>${C.monShort(s)}</span></div>`); }
  const lanes = C.SOURCE_ORDER.map((s, li) => {
    const pts = I.filter(i => i.source === s && i.st !== 'LOST').map(i => {
      const d = i.st === 'PAID' ? i.paidAt : i.st === 'INVOICED' ? i.invoicedAt : i.st === 'READY' ? T : i.claimDate;
      if (!C.isIso(d) || d < t0 || d > t1) return '';
      const sz = Math.round(10 + Math.sqrt(i.amountMinor / 100) / 8);
      return `<button type="button" class="pt ${i.st}" style="left:${pos(d)}%;width:${sz}px;height:${sz}px;color:${SRC(s).color}" data-a="open" data-c="${i.caseId}" aria-label="${esc(i.title + ' ' + i.label + ' ' + K(i.amountMinor) + ', ' + C.ST_LABEL[i.st])}"></button>`;
    }).join('');
    return `<div class="lane" style="top:${8 + li * 52}px"><span class="nm" style="color:${SRC(s).color}">${SRC(s).name}</span><span class="spark" style="background:${SRC(s).color};box-shadow:0 0 10px ${SRC(s).color};animation-delay:${li * 1.3}s"></span>${pts}</div>`;
  }).join('');
  return `<section class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap"><div><div class="k">Žaivá časová osa</div><div style="font-weight:700;margin-top:2px">Kam peníze putují · 2 měsíce zpět, 10 dopředu</div></div>
      <div class="legend"><span><i style="background:#a59fc9"></i>proplaceno</span><span><i style="background:#5eead4;border-color:#5eead4"></i>lze fakturovat</span><span><i style="box-shadow:inset 0 0 0 3px #a59fc9"></i>vyfakturováno</span><span><i style="border-style:dashed"></i>čeká</span></div></div>
    <div class="tlwrap"><div class="tl">${ticks}${lanes}<div class="today" style="left:calc(92px + (100% - 92px) * ${pos(T) / 100})"><b>DNES</b></div></div></div>
    <div class="meta">Ťukni na bod: otevře se případ. Splátky bez data (čekají na podmínku) najdeš v Případech.</div>
    <div style="margin-top:14px"><span class="flag">ODHAD · NE GARANCE</span> <span class="meta">Kolik by mělo přijít na účet (pravidlo: fakturace do 3 dnů od nároku, platba ~20 dní po faktuře)</span></div>
    <div class="pred">${[7, 30, 90].map(n => `<div><span>do ${n} dní</span><b>${K(C.forecast(I, T, n))}</b></div>`).join('')}</div>
  </section>`;
}

/* ---------------- PŘÍJEM ---------------- */
function viewPrijem(I) {
  const T = today(), inc = C.income(I, S.incMode, T), cur = inc.cur;
  const pmax = Math.max(1, ...inc.periods.map(p => p.total));
  const bars = inc.periods.map((p, bi) => `<div class="bar${p.cur ? ' cur' : ''}"><div class="vl">${p.total ? Math.round(p.total / 100000) + ' tis.' : '–'}</div><div class="stack">${C.SOURCE_ORDER.map(s => p.bySrc[s] ? `<div class="seg" style="height:${p.bySrc[s] / pmax * 100}%;background:${SRC(s).color};animation-delay:${bi * .08}s"></div>` : '').join('')}</div><div class="lb">${p.label}</div></div>`).join('');
  const recent = I.filter(i => i.paidAt && !i.lostAt).sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 8);
  const per = S.incMode === 'week' ? 'tento týden' : 'za ' + C.monShort(T) + ' ' + T.slice(0, 4);
  return `<div class="grid g2">
  <section class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div><div class="k">Skutečně přišlo · ${per}</div><div class="disp" style="font-weight:800;font-size:clamp(32px,5vw,50px);color:#5eead4;margin-top:6px">${K(cur.total)}</div><div class="meta">podle skutečného data platby · z toho bonus ${K(cur.bonus)}</div></div>
      <div class="seg2"><button type="button" class="${S.incMode === 'month' ? 'on' : ''}" data-a="inc" data-m="month">Měsíc</button><button type="button" class="${S.incMode === 'week' ? 'on' : ''}" data-a="inc" data-m="week">Týden</button></div>
    </div>
    <div class="bars">${bars}</div>
    <div class="meta" style="margin-top:8px">Tempo: průměr ${K(inc.avg)} za ${S.incMode === 'week' ? 'týden' : 'měsíc'} (posledních 6 období)</div>
  </section>
  <section class="card"><div class="k">Odkud to přišlo · ${per}</div>
    <div class="share">${C.SOURCE_ORDER.map(s => `<i style="width:${cur.total ? cur.bySrc[s] / cur.total * 100 : 0}%;background:${SRC(s).color}"></i>`).join('')}</div>
    ${C.SOURCE_ORDER.map(s => `<div class="row"><div class="l"><b style="color:${SRC(s).color}">${SRC(s).name}</b><span>${cur.total ? Math.round(cur.bySrc[s] / cur.total * 100) : 0} %</span></div><span class="mono">${K(cur.bySrc[s])}</span></div>`).join('')}
    <div class="k" style="margin-top:18px">Poslední platby</div>
    ${recent.length ? recent.map(i => `<div class="row" data-a="open" data-c="${i.caseId}" style="cursor:pointer"><div class="l"><b>${esc(SRC(i.source).name + ' · ' + i.title)}</b><span>${esc(i.label)}${i.kind === 'bonus' ? ' · bonus' : ''} · ${C.fmtDateShort(i.paidAt)}</span></div><span class="mono" style="color:${SRC(i.source).color}">+ ${K(i.amountMinor)}</span></div>`).join('') : '<div class="empty">Zatím žádná proplacená splátka.</div>'}
  </section></div>`;
}

/* ---------------- PŘÍPADY ---------------- */
function caseLead(sts) {
  if (sts.includes('READY')) return 'Lze fakturovat';
  if (sts.includes('INVOICED')) return 'Na cestě';
  if (sts.length && sts.every(s => s === 'PAID')) return 'Hotovo';
  if (sts.length && sts.every(s => s === 'LOST' || s === 'PAID')) return 'Propadlo';
  return 'Čeká';
}
function viewPripady(I) {
  const T = today(), q = S.q.trim().toLowerCase();
  const list = S.cases.filter(c => (S.filter === 'all' || c.source === S.filter) && (!q || `${c.title} ${c.source} ${c.note || ''} ${c.externalId || ''}`.toLowerCase().includes(q)));
  if (S.open && !caseById(S.open)) S.open = null;
  if (!S.open && list[0] && matchMedia('(min-width:901px)').matches) S.open = list[0].id;
  const filters = [['all', 'Vše'], ...C.SOURCE_ORDER.map(s => [s, SRC(s).name])];
  const cards = list.map(c => {
    const xs = (c.installments || []).map(i => ({ ...i, st: C.status(i, T) })), sts = xs.map(i => i.st);
    return `<button type="button" class="case${S.open === c.id ? ' on' : ''}${C.integrity(c) ? '' : ' bad'}" data-a="pick" data-c="${c.id}">
      <span class="src" style="color:${SRC(c.source).color}">${SRC(c.source).name}${c.kind === 'bonus' ? ' · bonus' : ''}</span><span class="t">${esc(c.title)}</span>
      <span class="mini">${sts.map(s => `<i style="background:${C.ST_COLOR[s]}"></i>`).join('')}</span>
      <span style="display:flex;justify-content:space-between;gap:8px"><span class="meta">${caseLead(sts)}</span><span class="mono">${K(C.sumMinor(xs))}</span></span></button>`;
  }).join('');
  return `<div class="grid">
    <div class="tools">${filters.map(f => `<button type="button" class="tab${S.filter === f[0] ? ' on' : ''}" data-a="filter" data-f="${esc(f[0])}">${f[1]}</button>`).join('')}
      <input class="search" type="search" placeholder="Hledat město, zákazníka, poznámku…" value="${esc(S.q)}" data-a="q" aria-label="Hledat"></div>
    <div class="split2"><div class="cases">${cards || '<div class="empty">Žádný případ neodpovídá filtru.</div>'}</div>
      <section class="card sticky" id="detail">${S.open ? detail(caseById(S.open), T) : '<div class="meta">Vyber případ.</div>'}</section></div></div>`;
}
function detail(c, T) {
  const xs = (c.installments || []).map(i => ({ ...i, st: C.status(i, T) }));
  const ok = C.integrity(c);
  return `<span class="src" style="color:${SRC(c.source).color}">${SRC(c.source).name}${c.kind === 'bonus' ? ' · bonus' : ''}</span>
    <h2 class="disp" style="margin:4px 0 2px;font-size:21px;font-weight:600">${esc(c.title)}</h2>
    <div class="meta">${SRC(c.source).trigger ? esc(SRC(c.source).trigger) + ' ' : ''}${C.fmtDate(c.triggerDate)} · celkem <span class="mono">${K(C.sumMinor(xs))}</span>${c.externalId ? ' · ID ' + esc(c.externalId) : ''}</div>
    ${c.note ? `<div class="help">${esc(c.note)}</div>` : ''}
    ${ok ? '' : `<div class="warnbox">Součet splátek (${K(C.sumMinor(xs))}) nesedí s evidovanou částkou případu (${K(c.totalAmountMinor)}). Portmonka to tiše neopravuje: otevři Upravit a ulož.</div>`}
    ${xs.map(i => {
      const order = ['WAITING', 'READY', 'INVOICED', 'PAID'], idx = order.indexOf(i.st);
      const steps = ['Čeká', 'Lze fakturovat', 'Vyfakturováno', 'Proplaceno'].map((lb, si) => `<div class="${i.st === 'LOST' ? '' : si < idx ? 'done' : si === idx ? 'cur' : ''}">${lb}</div>`).join('');
      const dates = [C.isBlocked(i) ? 'čeká na: ' + i.blockingCondition : i.claimDate ? 'nárok ' + C.fmtDate(i.claimDate) : null,
        i.invoicedAt ? 'faktura ' + (i.invoiceNo ? esc(i.invoiceNo) + ' · ' : '') + C.fmtDate(i.invoicedAt) : null,
        i.paidAt ? 'platba ' + C.fmtDate(i.paidAt) : null,
        i.lostAt ? 'propadlo ' + C.fmtDate(i.lostAt) + (i.lostReason ? ' · ' + esc(i.lostReason) : '') : null].filter(Boolean).join(' · ');
      const a = `data-c="${c.id}" data-i="${i.id}"`;
      const condLabel = c.source === 'Domoveo.cz' ? 'Servis proveden' : 'Podmínka splněna';
      return `<div class="inst"><div class="h"><span><span class="k">${esc(i.label)}${i.kind === 'bonus' ? ' · bonus' : ''}</span><br><b>${K(i.amountMinor)}</b></span><span class="chip" style="background:${C.ST_COLOR[i.st]}22;color:${C.ST_COLOR[i.st]}">${C.ST_LABEL[i.st]}</span></div>
        <div class="steps${i.st === 'LOST' ? ' lost' : ''}">${steps}</div><div class="meta">${dates || '—'}</div>
        <div class="btns">
          ${i.st === 'WAITING' && C.isBlocked(i) ? `<button type="button" class="btn" data-a="cond" ${a}>${condLabel}</button>` : ''}
          ${i.st === 'READY' ? `<button type="button" class="btn" data-a="inv-one" ${a}>Vyfakturovat</button>` : ''}
          ${i.st === 'INVOICED' ? `<button type="button" class="btn solid" data-a="pay-one" ${a}>Přišlo na účet</button>` : ''}
          ${i.st === 'READY' ? `<button type="button" class="btn ghost" data-a="pay-one" ${a}>Přišlo bez faktury</button>` : ''}
          ${i.st === 'WAITING' ? `<button type="button" class="btn warn" data-a="lose" ${a}>Propadlo</button>` : ''}
          ${i.st === 'LOST' ? `<button type="button" class="btn ghost" data-a="restore" ${a}>Obnovit</button>` : ''}
          ${i.st === 'INVOICED' || i.st === 'PAID' ? `<button type="button" class="btn ghost" data-a="undo" ${a}>Vrátit krok</button>` : ''}
        </div></div>`;
    }).join('')}
    <div class="btns" style="margin-top:14px"><button type="button" class="btn ghost" data-a="edit" data-c="${c.id}">Upravit případ</button></div>`;
}

/* ---------------- SOUHRN ---------------- */
function viewSouhrn(I) {
  const T = today(), t = C.totals(I, T), all = Math.max(1, t.total);
  const parts = [['PAID', 'Proplaceno', 'skutečně na účtu'], ['INVOICED', 'Na cestě', 'vyfakturováno, čeká na platbu'], ['READY', 'K akci', 'lze fakturovat hned'], ['WAITING', 'Čeká', 'budoucí nároky a podmínky'], ['LOST', 'Propadlo', 'nepočítá se do „zbývá“']];
  let acc = 0; const stops = parts.map(p => { const a = acc; acc += t[p[0]] / all * 360; return `${C.ST_COLOR[p[0]]} ${a}deg ${acc}deg`; }).join(',');
  const src = C.bySource(I, T);
  const planets = src.map((s, pi) => { const sz = Math.round(14 + Math.sqrt(s.total / 100) / 9), inset = [0, 7, 3, 10][pi]; return `<div class="orbit" style="inset:${inset}%;border-color:transparent;animation:${pi % 2 ? 'spinr' : 'spin'} ${38 + pi * 14}s linear infinite;animation-delay:-${pi * 7}s"><div class="planet" style="width:${sz}px;height:${sz}px;background:${SRC(s.source).color};color:${SRC(s.source).color}"><span>${SRC(s.source).name}</span></div></div>`; }).join('');
  return `<div class="grid g2" style="align-items:center">
  <section class="card"><div class="k">Stav vesmíru</div>
    <div class="uni" style="margin-top:10px"><div class="orbit" style="inset:4%"></div><div class="orbit" style="inset:12%"></div>${planets}
      <div class="donut" style="background:conic-gradient(${stops});-webkit-mask:radial-gradient(circle,transparent 46%,#000 47%);mask:radial-gradient(circle,transparent 46%,#000 47%)"></div>
      <div class="hole"><span>celkem evidováno</span><b>${K(t.total)}</b><span>${S.cases.length} ${plural(S.cases.length, 'případ', 'případy', 'případů')} · ${I.length} ${plural(I.length, 'splátka', 'splátky', 'splátek')}</span></div></div>
  </section>
  <section class="card"><div class="k">Z čeho se vesmír skládá</div>
    ${parts.map(p => `<div class="row"><div class="l"><b><span class="chip" style="color:${C.ST_COLOR[p[0]]};padding:0">●</span> ${p[1]}</b><span>${p[2]}</span></div><span class="mono">${K(t[p[0]])}</span></div>`).join('')}
    <div class="row"><div class="l"><b>Zbývá</b><span>celkem − proplaceno − propadlo</span></div><span class="mono" style="color:#5eead4">${K(t.remaining)}</span></div>
    <div class="k" style="margin-top:18px">Podle zdroje</div>
    <div class="share">${src.map(s => `<i style="width:${s.total / all * 100}%;background:${SRC(s.source).color}"></i>`).join('')}</div>
    ${src.map(s => `<div class="row"><div class="l"><b style="color:${SRC(s.source).color}">${SRC(s.source).name}</b><span>proplaceno ${K(s.PAID)} · zbývá ${K(s.remaining)}${s.LOST ? ' · propadlo ' + K(s.LOST) : ''}</span></div><span class="mono">${K(s.total)}</span></div>`).join('')}
  </section></div>`;
}
function viewSoon(tab) {
  const info = { cas: ['Časový stroj', 'Cestování penězi v čase nad tvými skutečnými daty (−2 týdny až +12 měsíců, scénáře ±30 dní).', 'fáze 4'],
    obj: ['Objevitel', 'Vzorce, anomálie a průsečíky z tvých dat. Každý objev ukáže, z čeho vznikl.', 'fáze 5'],
    lab: ['Laboratoř „Co kdyby…“', 'Realita vs. scénář: posuň platby, přidej instalace a sleduj, jak se mění časový prostor peněz.', 'fáze 6'] }[tab];
  return `<section class="card"><div class="elf">${ELF}<div class="bubble"><span class="tagc">Připravuju · ${info[2]}</span><div class="hl">${info[0]}</div><div class="meta">${info[1]} Návrh vzhledu už máš schválený, teď nejdřív musí pevně stát finanční základ.</div></div></div></section>`;
}

/* ---------------- modály ---------------- */
function modal(title, eyebrow, inner, onSubmit, submitLabel = 'Uložit') {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<form class="modal" novalidate><div class="mhead"><div><div class="k">${esc(eyebrow)}</div><h2>${esc(title)}</h2></div><button type="button" class="ibtn" data-close aria-label="Zavřít">${ICON.x}</button></div>
    <div class="mbody">${inner}</div><div class="err" data-err></div>
    <div class="btns" style="margin-top:14px;justify-content:flex-end"><button type="button" class="btn ghost" data-close>Zrušit</button><button type="submit" class="btn solid">${esc(submitLabel)}</button></div></form>`;
  document.body.appendChild(bg);
  const form = bg.querySelector('form'), close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const errEl = form.querySelector('[data-err]'); errEl.textContent = '';
    try { const r = await onSubmit(form); if (r !== false) close(); }
    catch (er) { errEl.textContent = er.message || String(er); }
  });
  setTimeout(() => form.querySelector('input:not([type=checkbox]),select')?.focus(), 30);
  return form;
}
const val = (f, n) => f.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
const chk = (f, n) => !!f.querySelector(`[name="${n}"]`)?.checked;
const radio = (f, n) => f.querySelector(`[name="${n}"]:checked`)?.value ?? '';

function openAdd() {
  const T = today();
  const f = modal('Přidat případ', 'Nový záznam', `
    <label class="f">Zdroj<select name="source">${C.SOURCE_ORDER.map(s => `<option value="${s}">${SRC(s).name}</option>`).join('')}</select></label>
    <div data-dyn></div>
    <label class="f">Poznámka (nepovinné)<textarea name="note" placeholder="cokoliv, co chceš u případu vidět"></textarea></label>
    <div class="help" data-prev></div>`, async form => {
      const { c, r } = readAdd(form);
      await run(() => store.createCase(c, r.installments), 'Případ uložen.');
    }, 'Vytvořit případ');
  const dyn = f.querySelector('[data-dyn]');
  const draw = () => {
    const s = val(f, 'source');
    let h = '';
    if (s === 'Pro-Factor') h = `<label class="f">Město<input name="title" required placeholder="např. Dvůr Králové"></label>
      <div class="f2"><label class="f">Datum uzavření města<input name="trig" type="date" value="${T}"></label><label class="f">Celková provize (Kč)<input name="total" inputmode="decimal" placeholder="např. 25 000"></label></div>`;
    else if (s === 'GOORN') h = `<label class="f">Zákazník, obec<input name="title" required placeholder="např. Novák, Police nad Metují"></label>
      <label class="f">Datum instalace<input name="trig" type="date" value="${T}"></label>
      <label class="f" style="display:flex;align-items:center"><input type="checkbox" name="ex" data-redraw>Výjimka – jiné částky než 3 190 + 2 530 Kč</label>
      ${chk(f, 'ex') ? `<div class="f2"><label class="f">1. část (Kč)<input name="p1" inputmode="decimal" value="3190"></label><label class="f">2. část (Kč)<input name="p2" inputmode="decimal" value="2530"></label></div>` : ''}`;
    else if (s === 'Domoveo.cz') {
      const bonus = radio(f, 'dmk') === 'bonus';
      h = `<div class="seg2" style="margin:10px 0"><label class="btn ghost"><input type="radio" name="dmk" value="order" ${bonus ? '' : 'checked'} data-redraw style="accent-color:#5eead4;margin-right:6px">Zakázka</label><label class="btn ghost"><input type="radio" name="dmk" value="bonus" ${bonus ? 'checked' : ''} data-redraw style="accent-color:#5eead4;margin-right:6px">Měsíční bonus</label></div>` +
        (bonus ? `<div class="f2"><label class="f">Za měsíc<input name="bm" type="month" value="${C.addMonths(T, -1).slice(0, 7)}"></label><label class="f">Bonus (Kč)<input name="bonus" inputmode="decimal" placeholder="8 000–30 000"></label></div>
          <label class="f">Datum potvrzení Domoveem<input name="trig" type="date" value="${T}"></label>`
        : `<label class="f">Klient, obec<input name="title" required placeholder="např. Mačková, Trutnov"></label>
          <div class="f2"><label class="f">Datum podpisu objednávky<input name="trig" type="date" value="${T}"></label><label class="f">Sazba<select name="rate"><option value="17">17 % · firemní zakázka</option><option value="25">25 % · vlastní klient</option></select></label></div>
          <div class="f2"><label class="f">Cena zakázky bez DPH (Kč)<input name="net" inputmode="decimal" placeholder="např. 3 521"></label><label class="f">ID zakázky Domovea (nepovinné)<input name="ext" placeholder="např. 1234"></label></div>`);
    } else h = `<label class="f">Zakázka<input name="title" required placeholder="např. A5 leták"></label>
      <div class="f2"><label class="f">Datum zakázky<input name="trig" type="date" value="${T}"></label><label class="f">Částka (Kč)<input name="total" inputmode="decimal" placeholder="např. 8 500"></label></div>`;
    const keep = {}; dyn.querySelectorAll('input,select').forEach(x => { if (x.type !== 'radio' && x.type !== 'checkbox' && x.value) keep[x.name] = x.value; });
    dyn.innerHTML = h;
    dyn.querySelectorAll('input,select').forEach(x => { if (keep[x.name] != null && x.type !== 'radio' && x.type !== 'checkbox') x.value = keep[x.name]; });
    prev();
  };
  const prev = () => {
    const p = f.querySelector('[data-prev]');
    try { const { r } = readAdd(f, true); p.innerHTML = r.installments.map(i => `${esc(i.label)}: <span class="calc">${K(i.amountMinor)}</span> · ${i.blockingCondition ? 'čeká na: ' + esc(i.blockingCondition) : 'nárok ' + C.fmtDate(i.claimDate)}`).join('<br>') + `<br>Celkem <span class="calc">${K(r.totalAmountMinor)}</span>`; }
    catch (e) { p.textContent = rulesHelp(val(f, 'source')); }
  };
  f.addEventListener('change', e => { if (e.target.name === 'source' || e.target.matches('[data-redraw]')) draw(); else prev(); });
  f.addEventListener('input', prev);
  draw();
}
function rulesHelp(s) {
  return { 'Pro-Factor': 'Pro-Factor: 75 % při uzavření města, 25 % po 4 měsících.', 'GOORN': 'GOORN: 3 190 Kč po instalaci, 2 530 Kč po splnění podmínky (datum se doplní, až nastane).',
    'Domoveo.cz': 'Domoveo: 17 % (firemní) / 25 % (vlastní klient) z ceny bez DPH. Nárok vzniká až po servisu.', 'Grafika': 'Grafika: jednorázová zakázka.' }[s] || '';
}
function readAdd(f, quiet) {
  const source = val(f, 'source'), trig = val(f, 'trig'), note = val(f, 'note');
  const input = { source, triggerDate: trig };
  let title = val(f, 'title'), kind = 'case', extra = {};
  if (source === 'Pro-Factor' || source === 'Grafika') input.totalMinor = C.toMinor(val(f, 'total'));
  if (source === 'GOORN' && chk(f, 'ex')) input.goorn = { p1Minor: C.toMinor(val(f, 'p1')), p2Minor: C.toMinor(val(f, 'p2')) };
  if (source === 'Domoveo.cz') {
    if (radio(f, 'dmk') === 'bonus') {
      const bm = val(f, 'bm'); input.domoveo = { kind: 'bonus', bonusMinor: C.toMinor(val(f, 'bonus')) }; kind = 'bonus'; title = 'Domoveo bonus ' + bm;
    } else {
      input.domoveo = { kind: 'order', priceNetMinor: C.toMinor(val(f, 'net')), rate: Number(val(f, 'rate')) };
      extra = { rate: input.domoveo.rate, priceNetMinor: input.domoveo.priceNetMinor }; const ext = val(f, 'ext'); if (ext) extra.externalId = ext;
    }
  }
  const r = C.buildInstallments(input);
  if (!title && !quiet) throw new Error('Vyplň označení případu.');
  const c = { source, title, triggerDate: trig, triggerType: SRC(source).trigger, kind, totalAmountMinor: r.totalAmountMinor, ...extra };
  if (note) c.note = note;
  return { c, r };
}

function openInvoice(list) {
  if (!list.length) return;
  const T = today(), sum = C.sumMinor(list);
  const srcs = [...new Set(list.map(i => i.source))];
  modal('Vyfakturovat', list.length > 1 ? 'Sloučená faktura · ' + list.length + ' položek' : 'Faktura', `
    ${list.map(i => `<div class="row"><div class="l"><b>${esc(SRC(i.source).name + ' · ' + i.title)}</b><span>${esc(i.label)}</span></div><span class="mono">${K(i.amountMinor)}</span></div>`).join('')}
    <div class="row"><div class="l"><b>Celkem</b></div><span class="calc">${K(sum)}</span></div>
    ${srcs.length > 1 ? '<div class="warnbox">Pozor: položky jsou z více zdrojů (' + srcs.map(s => SRC(s).name).join(', ') + '). Obvykle fakturuješ každý zdroj zvlášť.</div>' : ''}
    <div class="f2"><label class="f">Číslo faktury<input name="no" placeholder="např. 9/26"></label><label class="f">Datum vystavení<input name="at" type="date" value="${T}"></label></div>
    <div class="meta">Splátky zůstávají samostatné, faktura je jen spojuje. Platbu pak potvrdíš jedním klepnutím za celou fakturu.</div>`,
  async f => {
    const at = val(f, 'at'); if (!C.isIso(at)) throw new Error('Zadej datum vystavení.');
    const ok = await run(() => store.createInvoice({ number: val(f, 'no') || null, issuedAt: at }, list.map(i => ({ caseId: i.caseId, id: i.id }))), list.length > 1 ? 'Faktura uložena (' + list.length + ' položek).' : 'Vyfakturováno.');
    if (ok) S.sel.clear();
  }, 'Vyfakturovat');
}
function openPay(list, title) {
  const T = today();
  modal('Přišlo na účet', title, `
    ${list.map(i => `<div class="row"><div class="l"><b>${esc(SRC(i.source).name + ' · ' + i.title)}</b><span>${esc(i.label)}${i.st === 'READY' ? ' · bez faktury' : ''}</span></div><span class="mono">${K(i.amountMinor)}</span></div>`).join('')}
    <div class="row"><div class="l"><b>Celkem</b></div><span class="calc">${K(C.sumMinor(list))}</span></div>
    <label class="f">Skutečné datum platby<input name="at" type="date" value="${T}" max="${T}"></label>`,
  async f => {
    const at = val(f, 'at'); if (!C.isIso(at)) throw new Error('Zadej datum platby.');
    const early = list.find(i => i.invoicedAt && at < i.invoicedAt); if (early) throw new Error('Platba nemůže být dřív než faktura (' + C.fmtDate(early.invoicedAt) + ').');
    await run(() => store.payItems(list.map(i => ({ caseId: i.caseId, id: i.id })), at), 'Platba zapsána. Příjem se přepočítal.');
  }, 'Potvrdit platbu');
}
function openDate(title, label, onDate, extraHtml = '') {
  const T = today();
  modal(title, 'Změna stavu', `<label class="f">${esc(label)}<input name="at" type="date" value="${T}"></label>${extraHtml}`, async f => {
    const at = val(f, 'at'); if (!C.isIso(at)) throw new Error('Zadej datum.');
    await onDate(at, f);
  }, 'Potvrdit');
}

function openEdit(cid) {
  const c = caseById(cid); if (!c) return;
  const rows = (c.installments || []).map(i => ({ ...i }));
  const instHtml = (i, n) => `<div class="ed" data-row="${n}" data-id="${esc(i.id || '')}">
    <div class="f2"><label class="f">Označení<input name="label" value="${esc(i.label)}"></label><label class="f">Částka (Kč)<input name="amt" inputmode="decimal" value="${(i.amountMinor || 0) / 100}"></label></div>
    <label class="f" style="display:flex;align-items:center"><input type="checkbox" name="blk" ${C.isBlocked(i) ? 'checked' : ''}>Čeká na podmínku (datum nároku zatím neznám)</label>
    <div class="f2"><label class="f">Datum nároku<input name="claim" type="date" value="${esc(i.claimDate || '')}"></label><label class="f">Podmínka<input name="cond" value="${esc(i.blockingCondition || '')}" placeholder="např. ${esc(C.COND_GOORN)}"></label></div>
    <div class="f2"><label class="f">Vyfakturováno<input name="inv" type="date" value="${esc(i.invoicedAt || '')}"></label><label class="f">Číslo faktury<input name="invno" value="${esc(i.invoiceNo || '')}"></label></div>
    <div class="f2"><label class="f">Proplaceno<input name="paid" type="date" value="${esc(i.paidAt || '')}"></label><label class="f">Propadlo<input name="lost" type="date" value="${esc(i.lostAt || '')}"></label></div>
    <label class="f">Důvod propadnutí<input name="lostr" value="${esc(i.lostReason || '')}"></label>
    <button type="button" class="btn warn" data-delrow="${n}">Odebrat splátku</button></div>`;
  const f = modal('Upravit případ', SRC(c.source).name, `
    <label class="f">Označení<input name="title" value="${esc(c.title)}"></label>
    <div class="f2"><label class="f">Spouštěcí datum<input name="trig" type="date" value="${esc(c.triggerDate || '')}"></label><label class="f">ID ve zdroji (nepovinné)<input name="ext" value="${esc(c.externalId || '')}"></label></div>
    <label class="f">Poznámka<textarea name="note">${esc(c.note || '')}</textarea></label>
    <div class="k" style="margin-top:14px">Splátky</div><div data-rows>${rows.map(instHtml).join('')}</div>
    <div class="btns"><button type="button" class="btn ghost" data-addrow>Přidat splátku</button></div>
    <div class="help" data-sum></div>
    <div class="btns" style="margin-top:16px;border-top:1px solid var(--ln);padding-top:14px"><button type="button" class="btn warn" data-delcase>Smazat celý případ</button></div>`,
  async form => {
    const title = val(form, 'title'); if (!title) throw new Error('Označení nesmí být prázdné.');
    const trig = val(form, 'trig'); if (trig && !C.isIso(trig)) throw new Error('Neplatné spouštěcí datum.');
    const els = [...form.querySelectorAll('[data-row]')];
    if (!els.length) throw new Error('Případ musí mít aspoň jednu splátku.');
    const next = els.map(el => {
      const g = n => el.querySelector(`[name="${n}"]`); const v = n => g(n).value.trim() || null;
      const blk = g('blk').checked, orig = c.installments.find(x => x.id === el.dataset.id) || {};
      const d = { label: v('label') || 'Splátka', kind: orig.kind || 'commission', amountMinor: C.toMinor(g('amt').value),
        claimDate: blk ? null : v('claim'), blockingCondition: blk ? (v('cond') || 'Podmínka') : (v('cond') || null),
        conditionSatisfiedDate: blk ? null : (v('claim') || null), invoicedAt: v('inv'), invoiceNo: v('invno'), invoiceId: v('inv') ? (orig.invoiceId || null) : null,
        paidAt: v('paid'), lostAt: v('lost'), lostReason: v('lost') ? v('lostr') : null };
      if (!blk && !d.claimDate && !d.lostAt) throw new Error('U splátky „' + d.label + '“ chybí datum nároku (nebo zaškrtni „čeká na podmínku“).');
      const errs = C.validateInstallment(d); if (errs.length) throw new Error(d.label + ': ' + errs.join(' '));
      return { id: el.dataset.id || null, data: d };
    });
    const total = next.reduce((a, x) => a + x.data.amountMinor, 0);
    const removed = c.installments.filter(i => !next.some(n => n.id === i.id));
    const changes = [...next.map(n => n.id ? { op: 'update', id: n.id, data: n.data } : { op: 'set', data: n.data, event: 'INSTALLMENT_CREATED' }),
      ...removed.map(i => ({ op: 'delete', id: i.id, event: 'INSTALLMENT_DELETED' }))];
    const patch = { title, triggerDate: trig || c.triggerDate, note: val(form, 'note') || null, externalId: val(form, 'ext') || null, totalAmountMinor: total };
    await run(() => store.updateCase(c.id, patch, changes), 'Případ upraven.');
  }, 'Uložit změny');
  const box = f.querySelector('[data-rows]');
  const sum = () => { const t = [...f.querySelectorAll('[data-row] [name=amt]')].reduce((a, x) => a + (C.toMinor(x.value) || 0), 0); f.querySelector('[data-sum]').innerHTML = 'Celkem případu po úpravě: <span class="calc">' + K(t) + '</span> (počítá se jako součet splátek)'; };
  f.addEventListener('input', sum); sum();
  f.addEventListener('click', async e => {
    const del = e.target.closest('[data-delrow]'); if (del) { del.closest('[data-row]').remove(); sum(); }
    if (e.target.closest('[data-addrow]')) { box.insertAdjacentHTML('beforeend', instHtml({ label: 'Splátka', amountMinor: 0, claimDate: today() }, Date.now())); sum(); }
    const dc = e.target.closest('[data-delcase]');
    if (dc) {
      if (!dc.dataset.armed) { dc.dataset.armed = '1'; dc.textContent = 'Opravdu smazat? Klepni znovu (nevratné)'; return; }
      f.closest('.modal-bg').remove(); S.open = null;
      await run(() => store.deleteCase(c), 'Případ smazán.');
    }
  });
}

/* ---------------- akce ---------------- */
function handle(e) {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, cid = el.dataset.c, iid = el.dataset.i;
  const I = () => items();
  const one = () => I().find(x => x.caseId === cid && x.id === iid);
  switch (a) {
    case 'tab': S.tab = el.dataset.t; render(); scrollTo(0, 0); break;
    case 'login': store.signIn().catch(er => { console.error(er); toast('Přihlášení přes Google se nepodařilo.'); }); break;
    case 'logout': store.signOut(); break;
    case 'reload': reload().then(() => toast('Načteno.')); break;
    case 'add': openAdd(); break;
    case 'why': S.showWhy = !S.showWhy; render(); break;
    case 'open': S.tab = 'pripady'; S.open = cid; S.filter = 'all'; render(); scrollTo(0, 0); break;
    case 'pick': S.open = cid; render(); if (!matchMedia('(min-width:901px)').matches) $('#detail')?.scrollIntoView({ behavior: 'smooth' }); break;
    case 'filter': S.filter = el.dataset.f; render(); break;
    case 'inc': S.incMode = el.dataset.m; render(); break;
    case 'sel-all': { const r = I().filter(i => i.st === 'READY'); const all = r.every(i => S.sel.has(i.caseId + '|' + i.id)); S.sel.clear(); if (!all) r.forEach(i => S.sel.add(i.caseId + '|' + i.id)); render(); break; }
    case 'inv-sel': openInvoice(I().filter(i => i.st === 'READY' && S.sel.has(i.caseId + '|' + i.id))); break;
    case 'inv-one': openInvoice([one()]); break;
    case 'pay-one': openPay([one()], 'Jedna splátka'); break;
    case 'pay-group': { const k = el.dataset.k; const xs = I().filter(i => i.st === 'INVOICED' && (k.startsWith('solo:') ? 'solo:' + i.caseId + i.id === k : i.invoiceId === k)); openPay(xs, xs[0]?.invoiceNo ? 'Faktura ' + xs[0].invoiceNo : 'Na cestě'); break; }
    case 'cond': { const c = caseById(cid); openDate(c.source === 'Domoveo.cz' ? 'Servis proveden' : 'Podmínka splněna', 'Kdy nastala (od tohoto dne lze fakturovat)', at => run(() => store.updateCase(cid, null, [{ op: 'update', id: iid, data: { conditionSatisfiedDate: at, claimDate: at }, event: 'CLAIM_BECAME_READY' }]), 'Nárok vznikl, splátku lze fakturovat.')); break; }
    case 'lose': openDate('Propadlo', 'Kdy propadlo', (at, f) => run(() => store.updateCase(cid, null, [{ op: 'update', id: iid, data: { lostAt: at, lostReason: val(f, 'why') || null }, event: 'CLAIM_LOST' }]), 'Zapsáno jako propadlé.'),
      `<label class="f">Důvod<input name="why" placeholder="např. Klient nepustil technika"></label>`); break;
    case 'restore': run(() => store.updateCase(cid, null, [{ op: 'update', id: iid, data: { lostAt: null, lostReason: null }, event: 'CLAIM_RESTORED' }]), 'Splátka obnovena.'); break;
    case 'undo': { const i = one(); const data = i.st === 'PAID' ? { paidAt: null } : { invoicedAt: null, invoiceId: null, invoiceNo: null };
      run(() => store.updateCase(cid, null, [{ op: 'update', id: iid, data, event: i.st === 'PAID' ? 'PAYMENT_REVERTED' : 'INVOICE_REVERTED' }]), 'Vráceno o krok zpět.'); break; }
    case 'edit': openEdit(cid); break;
  }
}
document.addEventListener('click', e => { if (e.target.closest('[data-a="sel"]')) return; handle(e); });
document.addEventListener('change', e => {
  const el = e.target.closest('[data-a="sel"]'); if (!el) return;
  const k = el.dataset.c + '|' + el.dataset.i; el.checked ? S.sel.add(k) : S.sel.delete(k); render();
});
document.addEventListener('input', e => {
  if (e.target.matches('[data-a="q"]')) { S.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $('[data-a="q"]'); q.focus(); try { q.setSelectionRange(pos, pos); } catch (_) {} }
});
// přepnutí přes půlnoc: stavy se odvozují z data, stačí překreslit
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.user) render(); });

/* ---------------- start ---------------- */
(async () => {
  try { store = DEMO ? createMemoryStore() : await createFirestoreStore(); }
  catch (e) { console.error(e); $('#app').innerHTML = '<div class="wrap"><div class="warnbox">Nepodařilo se načíst Firebase: ' + esc(e.message) + '</div></div>'; return; }
  store.onAuth(async u => { S.user = u; S.loaded = false; render(); if (u) await reload(); });
  render();
})();
window.__portmonka = { S, items, C };
