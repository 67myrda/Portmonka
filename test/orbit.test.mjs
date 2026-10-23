import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// orbit.js importuje core.js s ?v= – pro test nahradíme cestu
const src = fs.readFileSync(new URL('../js/orbit.js', import.meta.url), 'utf8').replace(/\.\/core\.js\?v=[\d.]+/, '../js/core.js');
fs.writeFileSync(new URL('./_orbit.mjs', import.meta.url), src);
const O = await import('./_orbit.mjs');

test('Náklady: 61 000 Kč, auto 12 500 každý měsíc, platba 25 000 v prosinci a únoru', () => {
  assert.equal(O.totalCosts('2026-11'), 6100000);
  const nov = O.costsFor('2026-11').find(c => c.id === 'auto'), dec = O.costsFor('2026-12').find(c => c.id === 'auto');
  assert.match(nov.note, /odložit/); assert.match(dec.note, /25\s000/);
  assert.match(O.costsFor('2027-02').find(c => c.id === 'auto').note, /25\s000/);
  assert.deepEqual(O.costsFor('2026-11').map(c => c.id), ['zalohy', 'najem', 'splatka', 'auto', 'palivo', 'ostatni']);
  assert.equal(O.costsFor('2027-02').find(c => c.id === 'najem').due, '2027-02-10');
});

test('Umořování podle splatnosti a vrstev jistoty', () => {
  const T = '2026-11-12';
  const items = [
    { source: 'Pro-Factor', amountMinor: 2000000, claimDate: '2026-11-01', invoicedAt: '2026-11-02', paidAt: '2026-11-05' },  // 20 000 na účtu
    { source: 'GOORN', amountMinor: 1000000, claimDate: '2026-11-08', invoicedAt: '2026-11-10' },                             // 10 000 na cestě
    { source: 'Domoveo.cz', amountMinor: 3000000, claimDate: '2026-11-20' }                                                  // 30 000 odhad
  ];
  const o = O.orbit(items, T);
  assert.equal(o.layers.sure, 2000000); assert.equal(o.layers.likely, 3000000); assert.equal(o.layers.all, 6000000);
  const z = o.costs.find(c => c.id === 'zalohy'), n = o.costs.find(c => c.id === 'najem');
  assert.equal(z.state, 'done');              // 18 000 z 20 000 na účtu
  assert.equal(n.state, 'invoiced');          // 2 000 na účtu + zbytek z faktury
  assert.equal(o.costs.find(c => c.id === 'ostatni').state, 'open'); // 60 000 < 61 000
  assert.equal(o.pct, 98);
  assert.equal(o.nextOpen.id, 'splatka');     // první náklad, který kryje jen odhad
});

test('Polštář a prasátko: přebytek nejdřív polštář, schodek nejdřív z polštáře', () => {
  const paid = (d, k) => ({ source: 'GOORN', amountMinor: k * 100, claimDate: d, invoicedAt: d, paidAt: d });
  const items = [paid('2026-11-15', 100000), paid('2026-12-15', 90000), paid('2027-01-15', 40000)];
  const L = O.ledger(items, '2027-02-05');
  // listopad +39 000 → polštář 39 000; prosinec +29 000 → polštář 61 000, prasátko 7 000; leden −21 000 → polštář 40 000
  assert.deepEqual(L.months.map(m => [m.cushion / 100, m.piggy / 100]), [[39000, 0], [61000, 7000], [40000, 7000]]);
  assert.equal(L.hole, 0);
});

test('Odměny se mění každý měsíc, velké sny z prasátka', () => {
  const a = O.rewardsFor('2026-11'), b = O.rewardsFor('2026-12');
  assert.equal(a.length, 4); assert.notEqual(a[0].text, b[0].text);
  const big = [{ source: 'Pro-Factor', amountMinor: 20000000, claimDate: '2026-11-03', invoicedAt: '2026-11-03', paidAt: '2026-11-06' }];
  const o = O.orbit(big, '2026-11-20');   // 200 000 − 61 000 náklady − 61 000 polštář = 78 000 nad polštářem
  assert.equal(o.overCushion, 7800000);
  assert.ok(o.rewards.every(r => r.unlocked));
  assert.ok(o.dreams.every(d => d.ready));
});
