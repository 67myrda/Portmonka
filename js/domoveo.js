// Portmonka – Domoveo přehled marží (zadání Myrdy 19. 11. 2026):
// podepsáno (podle data podpisu) · odservisováno (podle data provedeného servisu) · jejich součet,
// počet schůzek, uzavřené objednávky, % úspěšnosti a predikce (≈ odhad, nikdy ne nárok).
// Deterministické, žádný DOM ani Firestore. Částky v haléřích (amountMinor), jako všude v appce.
import { addDays, diffDays, startOfWeek, startOfMonth, endOfMonth } from './core.js?v=8.24';

export const DM_SOURCE = 'Domoveo.cz';
export const MIN_MEETINGS_FOR_RATE = 8;   // pod tímto počtem provedených schůzek se predikce nepočítá (málo dat)
export const REF_DAYS = 60;               // okno pro úspěšnost a průměrnou marži
export const PACE_DAYS = 28;              // okno pro tempo schůzek

const nonBonus = c => (c.installments || []).filter(i => i.kind !== 'bonus');
const isDm = c => c.source === DM_SOURCE && c.kind !== 'bonus' && !String(c.id).startsWith('hist_');
const marzeOf = c => nonBonus(c).reduce((a, i) => a + (Number(i.amountMinor) || 0), 0);
const isLost = c => { const xs = nonBonus(c); return xs.length > 0 && xs.every(i => i.lostAt); };
const lostRow = c => ({ id: c.id, title: c.title || '', date: c.triggerDate || null, amountMinor: marzeOf(c) });

// Řádky z případů: podpis a servis jsou dvě nezávislé události téže zakázky.
export function events(cases) {
  const signed = [], serviced = [], waiting = [], lost = [];
  for (const c of cases) {
    if (!isDm(c)) continue;
    const amt = marzeOf(c); if (!(amt > 0)) continue;
    if (isLost(c)) { lost.push(lostRow(c)); continue; }
    const base = { id: c.id, title: c.title || '', amountMinor: amt };
    if (c.triggerDate) signed.push({ ...base, date: c.triggerDate });
    const sv = nonBonus(c).map(i => i.conditionSatisfiedDate).filter(Boolean).sort()[0];
    if (sv) serviced.push({ ...base, date: sv });
    else {
      const ex = nonBonus(c).map(i => i.expectedServiceDate).filter(Boolean).sort()[0];
      waiting.push({ ...base, date: ex || null });
    }
  }
  return { signed, serviced, waiting, lost };
}

// Týden jako v Úrodě (po–ne). Sobota–pátek (audit Fable) = změnit jen tady.
export function range(view, anchor) {
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'week') { const f = startOfWeek(anchor); return { from: f, to: addDays(f, 6) }; }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

const inR = (xs, r) => xs.filter(x => x.date && x.date >= r.from && x.date <= r.to);
const sum = xs => xs.reduce((a, x) => a + x.amountMinor, 0);
const meet = (sch, r) => {
  const out = { h: 0, z: 0, p: 0 };
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) { const x = sch && sch.dny && sch.dny[d]; if (x) { out.h += x.h || 0; out.z += x.z || 0; out.p += x.p || 0; } }
  return out;
};

// Referenční tempo: úspěšnost (podepsané ÷ provedené schůzky) a průměrná marže za posledních REF_DAYS dní do dneška.
export function reference(ev, sch, today) {
  const r = { from: addDays(today, -(REF_DAYS - 1)), to: today };
  const m = meet(sch, r), s = inR(ev.signed, r);
  const rate = m.h >= MIN_MEETINGS_FOR_RATE ? Math.min(1, s.length / m.h) : null;
  const avg = s.length ? Math.round(sum(s) / s.length) : null;
  const pr = { from: addDays(today, -(PACE_DAYS - 1)), to: today };
  const pace = meet(sch, pr).h / PACE_DAYS; // schůzek na kalendářní den
  return { meetings: m.h, signed: s.length, rate, avg, pace };
}

// Predikce konce období (jen pro období, které ještě běží). ≈ odhad, ne garance.
// low  = známé + naplánované schůzky × úspěšnost × průměrná marže
// high = low + tempo schůzek na dny po posledním naplánovaném dni × úspěšnost × průměrná marže
export function forecast(view, r, known, ev, sch, today) {
  if (view === 'day' || r.to < today || r.from > today) return null;
  const ref = reference(ev, sch, today);
  if (ref.rate == null || ref.avg == null) return { ok: false, why: 'málo dat – potřebuju aspoň ' + MIN_MEETINGS_FOR_RATE + ' provedených schůzek za ' + REF_DAYS + ' dní', ref };
  const fut = { from: addDays(today, 0), to: r.to };
  let planned = 0, last = today;
  for (let d = fut.from; d <= fut.to; d = addDays(d, 1)) { const x = sch && sch.dny && sch.dny[d]; if (x && x.p) { planned += x.p; last = d; } }
  const exp = n => Math.round(n * ref.rate * ref.avg / 100) * 100;
  const tail = Math.max(0, diffDays(last, r.to)); // dny po posledním naplánovaném (nebo po dnešku)
  const low = known + exp(planned);
  const high = low + exp(tail * ref.pace);
  const servis = sum(ev.waiting.filter(x => x.date && x.date >= today && x.date <= r.to));
  return { ok: true, low, high, planned, tailDays: tail, rate: ref.rate, avg: ref.avg, servisPlan: servis, ref };
}

// Celý přehled pro jedno období.
// nab = users.domoveoNabidkyDny {'RRRR-MM-DD': {n, b, o}}: nabídky bez podpisu podle dne schůzky (backend z Domovea).
// Úspěšnost jako v Domoveu: podepsané objednávky ÷ (objednávky + nabídky bez podpisu).
export function overview(cases, sch, view, anchor, today, nab = null) {
  const ev = events(cases), r = range(view, anchor);
  const sg = inR(ev.signed, r), sv = inR(ev.serviced, r), lost = inR(ev.lost.map(l => ({ ...l })), r);
  const m = meet(sch, r);
  const podepsano = sum(sg), odservisovano = sum(sv);
  const forecastView = forecast(view, r, podepsano, ev, sch, today);
  const nk = nab ? Object.keys(nab).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort() : [];
  const covered = nk.length && r.to >= nk[0];
  const nabidek = covered ? nk.filter(k => k >= r.from && k <= r.to).reduce((a, k) => a + (Number(nab[k].n) || 0), 0) : 0;
  const uspesnostPct = covered && sg.length + nabidek > 0 ? Math.round(sg.length / (sg.length + nabidek) * 100) : null;
  return {
    range: r, podepsano: { minor: podepsano, count: sg.length, items: sg }, odservisovano: { minor: odservisovano, count: sv.length, items: sv },
    soucet: podepsano + odservisovano, schuzky: m, uzavrene: sg.length,
    uspesnostPct, nabidek, zNavstevPct: m.h >= 1 ? Math.min(100, Math.round(sg.length / m.h * 100)) : null, propadle: lost,
    forecast: forecastView
  };
}

// Sloupce grafu: den po dni v týdnu / měsíci (podepsáno, odservisováno, schůzky).
export function columns(cases, sch, view, anchor, today) {
  const ev = events(cases), r = range(view === 'day' ? 'week' : view, anchor), cols = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
    const x = sch && sch.dny && sch.dny[d] || { h: 0, z: 0, p: 0 };
    cols.push({ day: d, future: d > today, signed: sum(ev.signed.filter(e => e.date === d)), serviced: sum(ev.serviced.filter(e => e.date === d)), h: x.h || 0, z: x.z || 0, p: x.p || 0 });
  }
  return cols;
}

// ---------------- Přehled měsíce z backendu (users.domoveoMesic, zadání Myrdy 26. 11. 2026) ----------------
// Firestore ukládá schůzky ploše {updatedAt, 'RRRR-MM-DD': {h,z,p}}; výpočty čtou {updatedAt, dny}.
export function normSchuzky(x) {
  if (!x || x.dny) return x || null;
  const dny = {};
  for (const [k, v] of Object.entries(x)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v) dny[k] = v;
  return { updatedAt: x.updatedAt || null, dny };
}
export const TARGET_PCT = 60;
// Pásma úspěšnosti nabídek: pod 50 neúspěch, 50–59 pod cílem, 60–69 cíl drží, od 70 výborně.
export function verdict(pct) {
  if (pct == null) return null;
  return pct < 50 ? { k: 'bad', t: 'Pod hranou' } : pct < 60 ? { k: 'warn', t: 'Pod cílem' } : pct < 70 ? { k: 'good', t: 'Cíl drží' } : { k: 'top', t: 'Výborně' };
}
// Kolik objednávek v řadě chybí do cíle, nebo kolik nabídek bez podpisu ještě unese.
export function toTarget(won, forms, target = TARGET_PCT / 100) {
  if (!(forms > 0)) return { need: 0, spare: 0 };
  if (won / forms < target) return { need: Math.max(1, Math.ceil((target * forms - won) / (1 - target))), spare: 0 };
  return { need: 0, spare: Math.max(0, Math.floor(won / target - forms + 1e-9)) };
}
