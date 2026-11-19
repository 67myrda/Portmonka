import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/domoveo.js', import.meta.url), 'utf8').replace(/\.\/core\.js\?v=[\d.]+/, '../js/core.js');
fs.writeFileSync(new URL('./_domoveo.mjs', import.meta.url), src);
const D = await import('./_domoveo.mjs');
const T = '2026-11-20'; // pátek
const dm = (id, trig, amt, sv, extra = {}) => ({ id, source: 'Domoveo.cz', title: id, triggerDate: trig, installments: [{ id: 'p1', amountMinor: amt, conditionSatisfiedDate: sv || null, ...extra }] });
const cases = [
  dm('dm_1', '2026-11-03', 500000, '2026-11-09'),             // podepsáno 3. 11., servis 9. 11.
  dm('dm_2', '2026-11-04', 300000, null, { expectedServiceDate: '2026-11-24' }), // čeká, plán 24. 11.
  dm('dm_3', '2026-11-05', 200000, null, { lostAt: '2026-11-08' }),  // storno
  dm('dm_4', '2026-11-16', 400000, '2026-11-18'),
  { id: 'dm_bonus_2026-10', source: 'Domoveo.cz', kind: 'bonus', triggerDate: '2026-11-11', installments: [{ id: 'p1', kind: 'bonus', amountMinor: 999900 }] },
  { id: 'goorn_1', source: 'GOORN', triggerDate: '2026-11-04', installments: [{ id: 'p1', amountMinor: 319000 }] }
];
// 10 provedených schůzek za posledních 60 dní, 3 podepsané v okně (dm_1, dm_2, dm_4) → úspěšnost 30 %
const sch = { dny: {
  '2026-11-03': { h: 3, z: 0, p: 0 }, '2026-11-04': { h: 3, z: 1, p: 0 }, '2026-11-16': { h: 4, z: 0, p: 0 },
  '2026-11-20': { h: 0, z: 0, p: 2 }, '2026-11-21': { h: 0, z: 0, p: 1 }
} };
test('týden: podepsáno, odservisováno, součet; bonus a cizí zdroje ne; storno zvlášť', () => {
  const o = D.overview(cases, sch, 'week', '2026-11-04', T); // 2.–8. 11.
  assert.deepEqual(o.range, { from: '2026-11-02', to: '2026-11-08' });
  assert.equal(o.podepsano.minor, 800000); assert.equal(o.podepsano.count, 2);
  assert.equal(o.odservisovano.minor, 0);
  assert.equal(o.propadle.length, 1);
  assert.equal(o.schuzky.h, 6); assert.equal(o.schuzky.z, 1);
  assert.equal(o.uzavrene, 2); assert.equal(o.uspesnostPct, 33);
  assert.equal(o.forecast, null, 'minulé období se nepředpovídá');
});
test('měsíc: podepsáno 12 000, odservisováno 9 000, součet 21 000', () => {
  const o = D.overview(cases, sch, 'month', T, T);
  assert.equal(o.podepsano.minor, 1200000); assert.equal(o.odservisovano.minor, 900000);
  assert.equal(o.soucet, 2100000);
  assert.equal(o.schuzky.h, 10); assert.equal(o.uzavrene, 3); assert.equal(o.uspesnostPct, 30);
});
test('den: jen události toho dne', () => {
  const o = D.overview(cases, sch, 'day', '2026-11-09', T);
  assert.equal(o.podepsano.minor, 0); assert.equal(o.odservisovano.minor, 500000); assert.equal(o.soucet, 500000);
});
test('predikce měsíce: známé + naplánované × úspěšnost × průměr; horní mez přidá tempo', () => {
  const o = D.overview(cases, sch, 'month', T, T), f = o.forecast;
  assert.ok(f.ok); assert.equal(f.rate, 0.3); assert.equal(f.avg, 400000);
  assert.equal(f.planned, 3);
  assert.equal(f.low, 1200000 + Math.round(3 * 0.3 * 400000 / 100) * 100); // 12 000 + 3 × 0,3 × 4 000 = 15 600
  assert.equal(f.low, 1560000);
  assert.equal(f.tailDays, 9); // po 21. 11. zbývá 22.–30. 11.
  assert.ok(f.high > f.low);
  assert.equal(f.servisPlan, 300000);
});
test('predikce: málo schůzek = bez čísla, s důvodem', () => {
  const f = D.overview(cases, { dny: { '2026-11-03': { h: 2, z: 0, p: 0 } } }, 'month', T, T).forecast;
  assert.equal(f.ok, false); assert.match(f.why, /málo dat/);
});
test('týden se nepředpovídá po konci a den vůbec; sloupce = 7 dní', () => {
  assert.equal(D.overview(cases, sch, 'day', T, T).forecast, null);
  const cols = D.columns(cases, sch, 'week', T, T);
  assert.equal(cols.length, 7); assert.equal(cols[0].day, '2026-11-16');
  assert.equal(cols[0].signed, 400000); assert.equal(cols[0].h, 4);
  assert.equal(cols.filter(c => c.future).length, 2);
});
