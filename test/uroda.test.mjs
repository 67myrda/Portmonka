import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/uroda.js', import.meta.url), 'utf8').replace(/\.\/core\.js\?v=[\d.]+/, '../js/core.js');
fs.writeFileSync(new URL('./_uroda.mjs', import.meta.url), src);
const U = await import('./_uroda.mjs');
const T = '2026-11-07';
const cases = [
  { id: 'pf_hronov_2026-10-01', source: 'Pro-Factor', title: 'Hronov', triggerDate: '2026-10-30', installments: [{ id: 'p1', amountMinor: 300000, claimDate: '2026-10-30', invoicedAt: '2026-11-01' }, { id: 'p2', amountMinor: 100000, claimDate: '2027-02-28' }] },
  { id: 'dm_1', source: 'Domoveo.cz', title: 'Nývlt', triggerDate: '2026-11-02', priceNetMinor: 1000000, installments: [{ id: 'a', amountMinor: 170000, blockingCondition: 'x' }] },
  { id: 'dm_2', source: 'Domoveo.cz', title: 'Storno', triggerDate: '2026-11-03', installments: [{ id: 'a', amountMinor: 50000, lostAt: '2026-11-05' }] },
  { id: 'goorn_2026-090', source: 'GOORN', title: 'Starý', triggerDate: '2026-10-20', installments: [{ id: 'p1', amountMinor: 319000, claimDate: '2026-10-20' }, { id: 'p2', amountMinor: 253000 }] },
  { id: 'k1', source: 'Krypto', title: 'výběr', triggerDate: '2026-11-04', installments: [{ id: 'a', amountMinor: 999900, paidAt: '2026-11-04' }] }
];
const uroda = { seeds: [
  { id: 's1', s: 'pf', d: '2026-11-03', c: 400000, t: 'Pekař', k: 'pf_hronov_2026-10-01' },
  { id: 's2', s: 'pf', d: '2026-11-05', c: 200000, t: 'Storno', k: 'pf_nove_2026-11-01', l: '2026-11-06' },
  { id: 's3', s: 'go', d: '2026-11-06', c: 572000, t: 'Hakl', k: 'goorn_2026-073' },
  { id: 'f', s: 'pf', d: '2026-11-09', c: 100, t: 'budoucí' }
] };
test('semínka: stavy, náhrada z případů, krypto a budoucnost pryč', () => {
  const xs = U.seeds(cases, uroda, T);
  const by = id => xs.find(x => x.id === id);
  assert.equal(by('s1').st, 'done');
  assert.equal(by('s2').st, 'lost');
  assert.equal(by('s3').st, 'cond');
  assert.equal(by('c_dm_1').st, 'cond'); assert.ok(!by('c_dm_1').approx);
  assert.equal(by('c_dm_2').st, 'lost');
  assert.ok(by('c_goorn_2026-090').approx);
  assert.ok(!by('c_pf_hronov_2026-10-01'), 'pokrytý případ se nezdvojí');
  assert.ok(!xs.some(x => x.source === 'Krypto') && !by('f'));
});
test('týden 2.–8. 11.: souhrn a srovnání', () => {
  const xs = U.seeds(cases, uroda, T), r = U.range('week', T);
  assert.deepEqual(r, { from: '2026-11-02', to: '2026-11-08' });
  const sm = U.summarize(U.inRange(xs, r));
  assert.equal(sm.live, 400000 + 572000 + 170000);
  assert.equal(sm.lost, 250000);
  assert.equal(sm.done, 400000);
  assert.equal(U.columns('week', r, U.inRange(xs, r), T).length, 7);
  assert.deepEqual(U.prevRange('month', U.range('month', T), T), { from: '2026-10-01', to: '2026-10-07' });
  const sc = U.success(xs).find(x => x.source === 'Domoveo.cz');
  assert.equal(sc.pct, 0);
  assert.equal(U.columns('harvest', null, xs, T, 6).length, 6);
});
