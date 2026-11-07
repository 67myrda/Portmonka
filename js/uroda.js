// Portmonka – Úroda (Myrda 7. 11. 2026): provize podle dne uzavření obchodu, ne podle platby.
// Semínka = den, Zaseto = týden, Úroda = měsíc, Sklizeň = zpětně (6 měsíců / rok / vše).
// Stavy: 🌱 klíčí (čeká na podmínku) · 🌾 sklizeno (fakturováno) · 🍂 uschlo (storno/propadlo).
// Deterministické, žádný DOM ani Firestore. Úroda nikdy nemění nároky.
import { addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, SOURCES, SOURCE_ORDER } from './core.js?v=8.9';

export const SEED_SRC = { pf: 'Pro-Factor', go: 'GOORN' };
export const UR_SOURCES = SOURCE_ORDER.filter(s => s !== 'Krypto'); // krypto není práce
export const WAIT_TXT = { 'Pro-Factor': 'čeká na uzavření města', 'GOORN': 'čeká na instalaci', 'Domoveo.cz': 'čeká na servis', 'Grafika': 'čeká na fakturu', 'Hravé dřevo': 'čeká na fakturu' };
export const FROM = '2025-01-01';

const harvested = i => !!(i && (i.invoicedAt || i.paidAt));
const firstInst = c => (c.installments || []).slice().sort((a, b) => String(a.claimDate || '9').localeCompare(String(b.claimDate || '9')) || String(a.id).localeCompare(String(b.id)))[0];
const caseState = c => {
  const xs = (c.installments || []).filter(i => i.kind !== 'bonus');
  if (xs.some(harvested)) return 'done';
  if (xs.length && xs.every(i => i.lostAt)) return 'lost';
  return 'cond';
};

// Všechna semínka: zdroje z backendu (Tahák, GOORN) + Domoveo z případů + náhrada z případů, které semínko nemají.
export function seeds(cases, uroda, today) {
  const byId = new Map(cases.map(c => [c.id, c]));
  const out = [], covered = new Set();
  for (const s of (uroda && uroda.seeds) || []) {
    if (!s || !s.d || s.d > today) continue;
    const source = SEED_SRC[s.s]; if (!source) continue;
    const c = byId.get(s.k);
    if (c) covered.add(c.id);
    let st = 'cond';
    if (s.l) st = 'lost';
    else if (c) { const f = firstInst(c); st = harvested(f) ? 'done' : f && f.lostAt ? 'lost' : 'cond'; }
    out.push({ id: s.id, source, date: s.d, amountMinor: Number(s.c) || 0, title: s.t || '', note: s.n || '', approx: !!s.a, st, caseId: c ? c.id : null, n: 1 });
  }
  for (const c of cases) {
    if (covered.has(c.id) || c.kind === 'bonus' || c.source === 'Krypto' || !SOURCES[c.source]) continue;
    const d = c.triggerDate; if (!d || d < FROM || d > today) continue;
    const amt = (c.installments || []).filter(i => i.kind !== 'bonus').reduce((a, i) => a + (Number(i.amountMinor) || 0), 0);
    if (!amt) continue;
    const dm = c.source === 'Domoveo.cz';
    const net = Number(c.priceNetMinor) || 0;
    out.push({ id: 'c_' + c.id, source: c.source, date: d, amountMinor: amt, title: c.title || '', approx: !dm && !String(c.source).match(/Grafika/) || String(c.id).startsWith('hist_'),
      note: dm ? (net ? 'objednávka ≈ ' + Math.round(net * 1.12 / 100).toLocaleString('cs-CZ') + ' Kč s DPH' : 'objednávka') : c.source === 'GOORN' ? 'celá provize · 2. část za ~10 měsíců' : (c.triggerType || ''),
      st: caseState(c), caseId: c.id, n: 1 });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.amountMinor - a.amountMinor);
}

export function range(view, anchor) {
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'week') { const f = startOfWeek(anchor); return { from: f, to: addDays(f, 6) }; }
  if (view === 'month') return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return null;
}
// Stejné období o krok zpět; u běžícího období jen stejný počet dní (férové srovnání).
export function prevRange(view, r, today) {
  if (view === 'day' || view === 'week') { const k = view === 'day' ? 7 : 7; return { from: addDays(r.from, -k), to: addDays(r.to <= today ? r.to : today, -k) }; }
  const f = addMonths(r.from, -1), span = Math.round((Date.parse((r.to <= today ? r.to : today) + 'T00:00:00Z') - Date.parse(r.from + 'T00:00:00Z')) / 864e5);
  const to = addDays(f, span); const end = endOfMonth(f);
  return { from: f, to: to > end ? end : to };
}
export const inRange = (xs, r) => xs.filter(x => x.date >= r.from && x.date <= r.to);

export function summarize(xs) {
  const s = { live: 0, done: 0, cond: 0, lost: 0, count: 0, bySrc: {} };
  for (const x of xs) {
    s[x.st] += x.amountMinor;
    if (x.st !== 'lost') { s.live += x.amountMinor; s.count += x.n || 1; }
    const b = s.bySrc[x.source] || (s.bySrc[x.source] = { live: 0, done: 0, cond: 0, lost: 0, count: 0 });
    b[x.st] += x.amountMinor; if (x.st !== 'lost') { b.live += x.amountMinor; b.count += x.n || 1; }
  }
  s.all = s.done + s.cond + s.lost;
  return s;
}

// Sloupce grafu: den → po zdrojích, týden → 7 dní, měsíc → dny, sklizeň → měsíce (6 / 12) nebo roky.
export function columns(view, r, xs, today, harvestSpan = 6) {
  const cols = [];
  if (view === 'day') for (const s of UR_SOURCES) cols.push({ key: s, label: (SOURCES[s] || {}).name || s, xs: xs.filter(x => x.source === s) });
  else if (view === 'week' || view === 'month') for (let d = r.from; d <= r.to; d = addDays(d, 1)) cols.push({ key: d, label: d, day: d, future: d > today, xs: xs.filter(x => x.date === d) });
  else if (harvestSpan === 'all') {
    const y0 = Number(FROM.slice(0, 4)), y1 = Number(today.slice(0, 4));
    for (let y = y0; y <= y1; y++) cols.push({ key: String(y), label: String(y), from: y + '-01-01', to: y + '-12-31', xs: xs.filter(x => x.date.slice(0, 4) === String(y)) });
  } else {
    for (let k = harvestSpan - 1; k >= 0; k--) { const f = addMonths(startOfMonth(today), -k), t = endOfMonth(f); cols.push({ key: f.slice(0, 7), label: f, from: f, to: t, month: true, cur: k === 0, xs: xs.filter(x => x.date >= f && x.date <= t) }); }
  }
  return cols.map(c => ({ ...c, sum: summarize(c.xs) }));
}

// Úspěšnost podle zdroje za uzavřené obchody (sklizeno / (sklizeno + uschlo)); klíčící se nepočítají.
export function success(xs) {
  const out = [];
  for (const s of UR_SOURCES) {
    const a = xs.filter(x => x.source === s); if (!a.length) continue;
    const done = a.filter(x => x.st === 'done').reduce((q, x) => q + x.amountMinor, 0), lost = a.filter(x => x.st === 'lost').reduce((q, x) => q + x.amountMinor, 0);
    out.push({ source: s, done, lost, cond: a.filter(x => x.st === 'cond').reduce((q, x) => q + x.amountMinor, 0), pct: done + lost ? Math.round(done / (done + lost) * 100) : null, n: a.length });
  }
  return out;
}
