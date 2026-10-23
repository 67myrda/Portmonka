import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';

const T = '2026-10-23';

test('Pro-Factor 75/25, +4 měsíce, součet sedí', () => {
  const r = C.buildInstallments({ source: 'Pro-Factor', triggerDate: '2026-10-31', totalMinor: 2500000 });
  assert.equal(r.installments[0].amountMinor, 1875000);
  assert.equal(r.installments[1].amountMinor, 625000);
  assert.equal(r.installments[1].claimDate, '2027-02-28'); // konec měsíce se ořízne
  assert.equal(r.totalAmountMinor, 2500000);
  const odd = C.buildInstallments({ source: 'Pro-Factor', triggerDate: '2026-10-01', totalMinor: 100001 });
  assert.equal(C.sumMinor(odd.installments), 100001);
});

test('GOORN pevné částky 3 190 + 2 530, 2. část blokovaná podmínkou', () => {
  const r = C.buildInstallments({ source: 'GOORN', triggerDate: '2026-10-02' });
  assert.deepEqual(r.installments.map(i => i.amountMinor), [319000, 253000]);
  assert.equal(r.totalAmountMinor, 572000);
  assert.equal(C.status(r.installments[0], T), 'READY');
  assert.equal(C.status(r.installments[1], T), 'WAITING');
  assert.equal(r.installments[1].claimDate, null);
  // podmínka splněna
  const p2 = { ...r.installments[1], conditionSatisfiedDate: T, claimDate: T };
  assert.equal(C.status(p2, T), 'READY');
  // výjimka
  const ex = C.buildInstallments({ source: 'GOORN', triggerDate: T, goorn: { p1Minor: 400000, p2Minor: 0 } });
  assert.equal(ex.totalAmountMinor, 400000);
});

test('Domoveo 17 % / 25 % z ceny bez DPH, čeká na servis, propadnutí', () => {
  const a = C.buildInstallments({ source: 'Domoveo.cz', triggerDate: T, domoveo: { kind: 'order', priceNetMinor: 352100, rate: 17 } });
  assert.equal(a.installments[0].amountMinor, 59857); // 3 521 × 17 % = 598,57 Kč
  assert.equal(C.fmtKc(a.installments[0].amountMinor), '599 Kč');
  const b = C.buildInstallments({ source: 'Domoveo.cz', triggerDate: T, domoveo: { kind: 'order', priceNetMinor: 980000, rate: 17 } });
  assert.equal(b.installments[0].amountMinor, 166600);
  const own = C.buildInstallments({ source: 'Domoveo.cz', triggerDate: T, domoveo: { kind: 'order', priceNetMinor: 1000000, rate: 25 } });
  assert.equal(own.installments[0].amountMinor, 250000);
  assert.throws(() => C.buildInstallments({ source: 'Domoveo.cz', triggerDate: T, domoveo: { kind: 'order', priceNetMinor: 1, rate: 20 } }));
  assert.equal(C.status(a.installments[0], T), 'WAITING');
  const lost = { ...a.installments[0], lostAt: T };
  assert.equal(C.status(lost, T), 'LOST');
  const bonus = C.buildInstallments({ source: 'Domoveo.cz', triggerDate: T, domoveo: { kind: 'bonus', bonusMinor: 800000 } });
  assert.equal(bonus.installments[0].kind, 'bonus');
  assert.equal(C.status(bonus.installments[0], T), 'READY');
});

test('stavový automat a priorita stavů', () => {
  const i = { amountMinor: 100, claimDate: '2026-11-01' };
  assert.equal(C.status(i, T), 'WAITING');
  assert.equal(C.status({ ...i, claimDate: T }, T), 'READY');
  assert.equal(C.status({ ...i, claimDate: T, invoicedAt: T }, T), 'INVOICED');
  assert.equal(C.status({ ...i, claimDate: T, invoicedAt: T, paidAt: T }, T), 'PAID');
  assert.equal(C.status({ ...i, paidAt: T, lostAt: T }, T), 'LOST');
});

test('totals: propadlé se nepočítá do čeká ani zbývá, fakturace nemění příjem', () => {
  const items = [
    { amountMinor: 1000, claimDate: '2026-01-01', invoicedAt: '2026-01-02', paidAt: '2026-01-10' },
    { amountMinor: 2000, claimDate: '2026-10-01' },
    { amountMinor: 3000, claimDate: '2026-10-01', invoicedAt: '2026-10-02' },
    { amountMinor: 4000, claimDate: null, blockingCondition: 'x' },
    { amountMinor: 5000, claimDate: null, blockingCondition: 'x', lostAt: '2026-10-05' }
  ];
  const t = C.totals(items, T);
  assert.deepEqual([t.PAID, t.READY, t.INVOICED, t.WAITING, t.LOST, t.total, t.remaining], [1000, 2000, 3000, 4000, 5000, 15000, 9000]);
  assert.equal(C.sumMinor(C.paidBetween(items, '2026-10-01', '2026-10-31')), 0);
  assert.equal(C.sumMinor(C.paidBetween(items, '2026-01-01', '2026-01-31')), 1000);
});

test('období: 6 měsíců / 6 týdnů končících dneškem', () => {
  const m = C.periods('month', T);
  assert.equal(m.length, 6); assert.equal(m[5].start, '2026-10-01'); assert.equal(m[5].end, '2026-10-31'); assert.equal(m[0].start, '2026-05-01');
  const w = C.periods('week', T);
  assert.equal(w[5].start, '2026-10-19'); assert.equal(w[5].end, '2026-10-25');
});

test('příjem s bonusem', () => {
  const items = [
    { source: 'Domoveo.cz', kind: 'bonus', amountMinor: 800000, paidAt: '2026-10-12' },
    { source: 'GOORN', kind: 'commission', amountMinor: 319000, paidAt: '2026-10-20' },
    { source: 'GOORN', kind: 'commission', amountMinor: 319000, paidAt: '2026-09-20' }
  ];
  const inc = C.income(items, 'month', T);
  assert.equal(inc.cur.total, 1119000);
  assert.equal(inc.cur.bonus, 800000);
  assert.equal(inc.cur.bySrc['GOORN'], 319000);
});

test('odhad: jen nedoplacené s datem, blokované ne', () => {
  const items = [
    { amountMinor: 100, claimDate: '2026-10-01', invoicedAt: '2026-10-10' }, // po termínu → zítra
    { amountMinor: 200, claimDate: '2026-10-01' },                           // ready → +6 dní
    { amountMinor: 400, claimDate: null, blockingCondition: 'x' }
  ];
  assert.equal(C.forecast(items, T, 1), 100);
  assert.equal(C.forecast(items, T, 7), 300);
  assert.equal(C.forecast(items, T, 30), 300);
  assert.equal(C.forecast(items, T, 90), 300);
});

test('validace úprav', () => {
  assert.deepEqual(C.validateInstallment({ amountMinor: 100, claimDate: T }), []);
  assert.ok(C.validateInstallment({ amountMinor: -1 }).length);
  assert.ok(C.validateInstallment({ amountMinor: 1, invoicedAt: '2026-10-10', paidAt: '2026-10-01' }).length);
  assert.ok(C.validateInstallment({ amountMinor: 1, paidAt: T, lostAt: T }).length);
});

test('datumy a formáty', () => {
  assert.equal(C.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(C.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(C.diffDays('2026-10-01', T), 22);
  assert.equal(C.fmtKc(1234567), '12 346 Kč');
  assert.equal(C.toMinor('3 190'), 319000);
  assert.equal(C.toMinor('12,5'), 1250);
});
