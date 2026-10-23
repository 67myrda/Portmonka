// Portmonka – deterministické finanční jádro (bez DOM, bez Firestore).
// Matematika = aplikace. Všechny částky v haléřích (amountMinor), data jako "RRRR-MM-DD".

export const SOURCES = {
  'Pro-Factor': { key: 'pf', name: 'Pro-Factor', color: '#f5b84a', trigger: 'uzavření města', icon: 'profactor' },
  'GOORN':      { key: 'go', name: 'GOORN',      color: '#4ade9b', trigger: 'instalace přístroje', icon: 'goorn' },
  'Domoveo.cz': { key: 'dm', name: 'Domoveo',    color: '#6ea8ff', trigger: 'podpis objednávky', icon: 'domoveo' },
  'Grafika':    { key: 'gr', name: 'Grafika',    color: '#c49bff', trigger: 'zakázka', icon: 'grafika' },
  'Krypto':     { key: 'kr', name: 'Krypto',     color: '#f7931a', trigger: 'výběr do Kč', icon: 'krypto' },
  'Hravé dřevo':{ key: 'hd', name: 'Hravé dřevo', color: '#d9a066', trigger: 'marže M&M', emoji: '🪵', history: true }
};
export const SOURCE_ORDER = ['Pro-Factor', 'GOORN', 'Domoveo.cz', 'Grafika', 'Krypto', 'Hravé dřevo'];
// Zdroje, které jdou zadat ručně (Hravé dřevo je jen historie – Myrda 23. 10. 2026).
export const ADD_SOURCES = SOURCE_ORDER.filter(s => !SOURCES[s].history);

// GOORN – pevné částky (rozhodl Myrda 5. 10. a 12. 10. 2026).
export const GOORN_PART1_MINOR = 319000;
export const GOORN_PART2_MINOR = 253000;
// Domoveo – sazby z ceny bez DPH.
export const DOMOVEO_RATES = { firm: 17, own: 25 };
// Pro-Factor – 75 % hned, 25 % po 4 měsících.
export const PF_FIRST_PCT = 75;
export const PF_DELAY_MONTHS = 4;

export const COND_GOORN = 'Splnění podmínky (2. část)';
export const COND_DOMOVEO = 'Provedení servisu';

export const ST = { WAITING: 'WAITING', READY: 'READY', INVOICED: 'INVOICED', PAID: 'PAID', LOST: 'LOST' };
export const ST_LABEL = { WAITING: 'Čeká', READY: 'Lze fakturovat', INVOICED: 'Vyfakturováno', PAID: 'Proplaceno', LOST: 'Propadlo' };
export const ST_COLOR = { WAITING: '#8f89b8', READY: '#5eead4', INVOICED: '#f5b84a', PAID: '#a59fc9', LOST: '#ff7a6b' };

/* ---------- data ---------- */
const DAY = 864e5;
export function isIso(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function toUtc(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }
function fromUtc(ms) { return new Date(ms).toISOString().slice(0, 10); }
export function addDays(iso, n) { return fromUtc(toUtc(iso) + n * DAY); }
export function diffDays(a, b) { return Math.round((toUtc(b) - toUtc(a)) / DAY); } // b − a
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + Number(n), 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return fromUtc(target.getTime());
}
export function localToday(now = new Date()) {
  const x = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
}
export function startOfWeek(iso) { const wd = (new Date(toUtc(iso)).getUTCDay() + 6) % 7; return addDays(iso, -wd); }
export function startOfMonth(iso) { return iso.slice(0, 8) + '01'; }
export function endOfMonth(iso) { return addDays(addMonths(startOfMonth(iso), 1), -1); }

const MON = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const MONF = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
export function monShort(iso) { return MON[Number(iso.slice(5, 7)) - 1]; }
export function fmtDate(iso) { if (!isIso(iso)) return '—'; const [y, m, d] = iso.split('-').map(Number); return d + '. ' + m + '. ' + y; }
export function fmtDateShort(iso) { if (!isIso(iso)) return '—'; const [, m, d] = iso.split('-').map(Number); return d + '. ' + m + '.'; }
export function fmtDateLong(iso) { if (!isIso(iso)) return '—'; const [y, m, d] = iso.split('-').map(Number); return d + '. ' + MONF[m - 1] + ' ' + y; }

/* ---------- peníze ---------- */
export function toMinor(kc) {
  const n = Number(String(kc ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
export function fmtKc(minor) {
  const kc = Math.round((Number(minor) || 0) / 100);
  return kc.toLocaleString('cs-CZ').replace(/ /g, ' ') + ' Kč';
}
export function sumMinor(list) { return list.reduce((a, x) => a + (Number(x.amountMinor) || 0), 0); }

/* ---------- stav splátky (odvozený, nikdy ukládaný) ---------- */
export function isBlocked(i) { return !!i.blockingCondition && !i.conditionSatisfiedDate; }
export function status(i, today) {
  if (i.lostAt) return ST.LOST;
  if (i.paidAt) return ST.PAID;
  if (i.invoicedAt) return ST.INVOICED;
  if (isBlocked(i)) return ST.WAITING;
  if (isIso(i.claimDate) && i.claimDate <= today) return ST.READY;
  return ST.WAITING;
}

/* ---------- vznik splátek podle pravidel zdroje ---------- */
// input: { source, triggerDate, totalMinor?, goorn?: {p1Minor, p2Minor}, domoveo?: {kind:'order'|'bonus', priceNetMinor, rate, bonusMinor} }
export function buildInstallments(input) {
  const { source, triggerDate } = input;
  if (!SOURCES[source]) throw new Error('Neznámý zdroj');
  if (!isIso(triggerDate)) throw new Error('Chybí datum spouštěcí události');
  const base = { blockingCondition: null, conditionSatisfiedDate: null, invoicedAt: null, paidAt: null, lostAt: null, lostReason: null, kind: 'commission' };
  let parts = [];
  if (source === 'Pro-Factor') {
    const total = input.totalMinor;
    if (!(total > 0)) throw new Error('Zadej celkovou provizi');
    const first = Math.round(total * PF_FIRST_PCT / 10000) * 100; // celé koruny (Myrda 23. 10. 2026)
    parts = [
      { ...base, label: '75 % – 1. část', amountMinor: first, claimDate: triggerDate, conditionSatisfiedDate: triggerDate },
      { ...base, label: '25 % – 2. část', amountMinor: total - first, claimDate: addMonths(triggerDate, PF_DELAY_MONTHS), conditionSatisfiedDate: null }
    ];
  } else if (source === 'GOORN') {
    const p1 = input.goorn?.p1Minor ?? GOORN_PART1_MINOR;
    const p2 = input.goorn?.p2Minor ?? GOORN_PART2_MINOR;
    if (!(p1 >= 0 && p2 >= 0) || p1 + p2 <= 0) throw new Error('Neplatné částky GOORN');
    parts = [
      { ...base, label: '1. část', amountMinor: p1, claimDate: triggerDate, conditionSatisfiedDate: triggerDate },
      { ...base, label: '2. část', amountMinor: p2, claimDate: null, blockingCondition: COND_GOORN }
    ];
  } else if (source === 'Domoveo.cz') {
    const dm = input.domoveo || {};
    if (dm.kind === 'bonus') {
      if (!(dm.bonusMinor > 0)) throw new Error('Zadej výši bonusu');
      parts = [{ ...base, kind: 'bonus', label: 'Bonus', amountMinor: dm.bonusMinor, claimDate: triggerDate, conditionSatisfiedDate: triggerDate }];
    } else {
      const rate = Number(dm.rate);
      if (![DOMOVEO_RATES.firm, DOMOVEO_RATES.own].includes(rate)) throw new Error('Sazba musí být 17 nebo 25 %');
      if (!(dm.priceNetMinor > 0)) throw new Error('Zadej cenu zakázky bez DPH');
      parts = [{ ...base, label: 'Provize ' + rate + ' %', amountMinor: Math.round(dm.priceNetMinor * rate / 100), claimDate: null, blockingCondition: COND_DOMOVEO }];
    }
  } else if (source === 'Krypto' || source === 'Hravé dřevo') {
    // výběr z krypta / marže M&M = peníze už jsou na účtu: rovnou proplaceno (Myrda 23. 10. 2026)
    const total = input.totalMinor;
    if (!(total > 0)) throw new Error('Zadej částku v Kč');
    parts = [{ ...base, label: source === 'Krypto' ? 'Výběr do Kč' : 'Marže M&M', amountMinor: total, claimDate: triggerDate, conditionSatisfiedDate: triggerDate, invoicedAt: triggerDate, paidAt: triggerDate }];
  } else {
    const total = input.totalMinor;
    if (!(total > 0)) throw new Error('Zadej částku');
    parts = [{ ...base, label: 'Zakázka', amountMinor: total, claimDate: triggerDate, conditionSatisfiedDate: triggerDate }];
  }
  return { totalAmountMinor: sumMinor(parts), installments: parts };
}

export function integrity(c) { return sumMinor(c.installments || []) === Number(c.totalAmountMinor || 0); }

/* ---------- pomocné výběry ---------- */
export function flatten(cases) {
  return cases.flatMap(c => (c.installments || []).map(i => ({ ...i, caseId: c.id, title: c.title, source: c.source, caseKind: c.kind || 'case' })));
}
export function withStatus(items, today) { return items.map(i => ({ ...i, st: status(i, today) })); }

/* ---------- agregace ---------- */
export function totals(items, today) {
  const by = { WAITING: 0, READY: 0, INVOICED: 0, PAID: 0, LOST: 0 };
  for (const i of items) by[status(i, today)] += Number(i.amountMinor) || 0;
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  return { ...by, total, remaining: total - by.PAID - by.LOST };
}
export function paidBetween(items, start, end) {
  return items.filter(i => i.paidAt && !i.lostAt && i.paidAt >= start && i.paidAt <= end);
}
// 6 období (měsíce nebo týdny) končících dnešním
export function periods(mode, today, n = 6) {
  const out = [];
  if (mode === 'week') {
    const w0 = startOfWeek(today);
    for (let k = n - 1; k >= 0; k--) {
      const s = addDays(w0, -7 * k), e = addDays(s, 6);
      out.push({ start: s, end: e, label: fmtDateShort(s), cur: k === 0 });
    }
  } else {
    const m0 = startOfMonth(today);
    for (let k = n - 1; k >= 0; k--) {
      const s = addMonths(m0, -k);
      out.push({ start: s, end: endOfMonth(s), label: monShort(s), cur: k === 0 });
    }
  }
  return out;
}
export function income(items, mode, today) {
  const ps = periods(mode, today).map(p => {
    const xs = paidBetween(items, p.start, p.end);
    const bySrc = {}; SOURCE_ORDER.forEach(s => bySrc[s] = sumMinor(xs.filter(x => x.source === s)));
    return { ...p, items: xs, total: sumMinor(xs), bonus: sumMinor(xs.filter(x => x.kind === 'bonus')), bySrc };
  });
  const cur = ps[ps.length - 1];
  const avg = Math.round(ps.reduce((a, p) => a + p.total, 0) / ps.length);
  return { periods: ps, cur, avg };
}
export function bySource(items, today) {
  return SOURCE_ORDER.map(s => {
    const xs = items.filter(i => i.source === s);
    const t = totals(xs, today);
    return { source: s, ...t, count: xs.length };
  });
}

/* ---------- odhad (ODHAD · NE GARANCE) ---------- */
// Pravidlo (Myrda 23. 10. 2026): faktury se platí do 3 dnů (nejdřív zítra),
// „lze fakturovat“ se vyfakturuje do 3 dnů a přijde o 3 dny později.
export const FORECAST_RULE = { invoiceAfterReady: 3, payAfterInvoice: 3 };
export function expectedPayDate(i, today) {
  const st = status(i, today);
  if (st === ST.INVOICED) { const d = addDays(i.invoicedAt, FORECAST_RULE.payAfterInvoice); return d > today ? d : addDays(today, 1); }
  if (st === ST.READY) return addDays(today, FORECAST_RULE.invoiceAfterReady + FORECAST_RULE.payAfterInvoice);
  if (st === ST.WAITING && isIso(i.claimDate) && !isBlocked(i)) return addDays(i.claimDate, FORECAST_RULE.invoiceAfterReady + FORECAST_RULE.payAfterInvoice);
  return null;
}
export function forecast(items, today, days) {
  const end = addDays(today, days);
  return sumMinor(items.filter(i => { const d = expectedPayDate(i, today); return d && d <= end; }));
}

/* ---------- výhled podle měsíců (budoucí nároky) ---------- */
export function outlook(items, today, months = 6) {
  const m0 = startOfMonth(today), out = [];
  for (let k = 0; k < months; k++) {
    const s = addMonths(m0, k), e = endOfMonth(s);
    const xs = items.filter(i => status(i, today) === ST.WAITING && !isBlocked(i) && isIso(i.claimDate) && i.claimDate >= s && i.claimDate <= e);
    out.push({ start: s, label: monShort(s) + ' ' + s.slice(0, 4), total: sumMinor(xs), count: xs.length });
  }
  return out;
}

/* ---------- Skřítek: jeden deterministický postřeh (vzácně, s důkazy) ---------- */
export function skritek(items, today, offers = null) {
  const S = withStatus(items, today);
  const inv = S.filter(i => i.st === ST.INVOICED).map(i => ({ ...i, age: diffDays(i.invoicedAt, today) })).sort((a, b) => b.age - a.age);
  if (inv[0] && inv[0].age >= 7) {
    const x = inv[0];
    return { pose: 'nesedi', cat: 'Něco mi nesedí', title: x.title + ' je vyfakturované už ' + x.age + ' dní a pořád nic.', short: 'Platby obvykle chodí do 3 dnů po faktuře. Možná stojí za připomínku.',
      evidence: ['vyfakturováno ' + fmtDate(x.invoicedAt) + (x.invoiceNo ? ' (faktura ' + x.invoiceNo + ')' : '') + ' · ' + fmtKc(x.amountMinor) + ' (fakt)', 'dnes je to ' + x.age + ' dní (fakt)'], kind: 'fact' };
  }
  const ready = S.filter(i => i.st === ST.READY).map(i => ({ ...i, age: diffDays(i.claimDate, today) })).sort((a, b) => b.age - a.age);
  if (ready[0] && ready[0].age >= 14) {
    return { pose: 'tajemstvi', cat: 'Malé tajemství', title: 'Leží tu ' + fmtKc(sumMinor(ready)) + ', na které už máš nárok.', short: 'Nejstarší čeká na fakturu ' + ready[0].age + ' dní.',
      evidence: ready.slice(0, 4).map(i => i.title + ' · ' + i.label + ' · nárok od ' + fmtDate(i.claimDate) + ' (fakt)'), kind: 'fact' };
  }
  const lost = S.filter(i => i.st === ST.LOST && isIso(i.lostAt) && diffDays(i.lostAt, today) <= 14);
  if (lost.length) {
    return { pose: 'smutny', cat: 'Smutná zpráva', title: 'Propadlo ' + fmtKc(sumMinor(lost)) + '.', short: 'Stává se. Čísla jsou poctivá i v tom, co nevyšlo.',
      evidence: lost.slice(0, 5).map(i => i.title + ': ' + fmtKc(i.amountMinor) + ' · ' + fmtDate(i.lostAt) + (i.lostReason ? ' · ' + i.lostReason : '') + ' (fakt)'), kind: 'fact' };
  }
  const of = offers && Array.isArray(offers.polozky) ? offers.polozky : [];
  if (of.length) {
    const n = of.length, u = offers.uspesnostPct;
    return { pose: 'napad', cat: 'Co kdyby…', title: 'Kdyby ' + (n === 1 ? 'klient přijal nabídku' : 'všech ' + n + ' klientů přijalo nabídku') + ', přibylo by ' + fmtKc(offers.celkemMinor) + ' provize.',
      short: (u != null && offers.realneMinor != null ? 'Při tvé úspěšnosti ' + u + ' % je reálné asi ' + fmtKc(offers.realneMinor) + '. ' : '') + 'Zatím je to chiméra, ne nárok.',
      evidence: [...of.slice(0, 6).map(p => p.klient + (p.obec ? ', ' + p.obec : '') + ': nabídka ' + fmtKc(p.zakladKc * 100) + ' bez DPH → ' + (offers.sazbaPct || 17) + ' % = ' + fmtKc(p.provizeMinor) + ' (hypotéza)'),
        'základ = částka s DPH ÷ ' + (1 + (offers.dphPct || 12) / 100).toFixed(2).replace('.', ',') + ' (odhad DPH ' + (offers.dphPct || 12) + ' %)'], kind: 'hyp' };
  }
  const pf = S.filter(i => i.source === 'Pro-Factor' && i.st === ST.WAITING && isIso(i.claimDate));
  if (pf.length >= 2) {
    return { pose: 'napad', cat: 'Co kdyby…', title: 'Kdyby 25 % od Pro-Factoru chodilo hned, měl bys o ' + fmtKc(sumMinor(pf)) + ' víc.', short: 'Vydělané už to je. Jen to čeká, až uplynou 4 měsíce.',
      evidence: pf.slice(0, 5).map(i => i.title + ': ' + fmtKc(i.amountMinor) + ' od ' + fmtDate(i.claimDate) + ' (fakt)'), kind: 'hyp' };
  }
  const dm = S.filter(i => i.source === 'Domoveo.cz' && i.st === ST.WAITING && isBlocked(i));
  if (dm.length) {
    return { pose: 'otazka', cat: 'Otázka', title: 'Domoveo: ' + dm.length + ' ' + (dm.length === 1 ? 'zakázka čeká' : dm.length < 5 ? 'zakázky čekají' : 'zakázek čeká') + ' na servis.', short: 'Dokud servis neproběhne, je provize jen příslib. Když klient technika nepustí, propadá.',
      evidence: dm.slice(0, 5).map(i => i.title + ': ' + fmtKc(i.amountMinor) + ' (fakt)'), kind: 'hyp' };
  }
  const paid = S.filter(i => i.st === ST.PAID && isIso(i.paidAt) && diffDays(i.paidAt, today) <= 7);
  if (paid.length) {
    return { pose: 'hura', cat: 'Hurá', title: 'Za posledních 7 dní ti přišlo ' + fmtKc(sumMinor(paid)) + '.', short: 'Peníze dorazily. Tohle je ta nejlepší část.',
      evidence: paid.slice(0, 5).map(i => i.title + ': ' + fmtKc(i.amountMinor) + ' · ' + fmtDate(i.paidAt) + ' (fakt)'), kind: 'fact' };
  }
  return null;
}

/* ---------- validace úprav (před zápisem) ---------- */
export function validateInstallment(i) {
  const errs = [];
  if (!Number.isInteger(i.amountMinor) || i.amountMinor < 0) errs.push('Částka musí být kladné číslo.');
  for (const k of ['claimDate', 'invoicedAt', 'paidAt', 'lostAt', 'conditionSatisfiedDate']) if (i[k] != null && !isIso(i[k])) errs.push('Neplatné datum: ' + k);
  if (i.paidAt && i.lostAt) errs.push('Splátka nemůže být zároveň proplacená i propadlá.');
  if (i.invoicedAt && i.paidAt && i.paidAt < i.invoicedAt) errs.push('Platba je dřív než faktura.');
  return errs;
}
