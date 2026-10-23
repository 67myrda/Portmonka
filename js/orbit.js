// Portmonka – Orbit: umořování nákladů, polštář, prasátko a sny (fáze 4a, 24. 10. 2026).
// Deterministické: z případů (příjmy) a konfigurace nákladů. Žádný DOM, žádný Firestore.
import { addDays, addMonths, startOfMonth, endOfMonth, isIso, sumMinor, status, expectedPayDate, isBlocked, ST } from './core.js?v=8.5';

const kc = n => Math.round(n * 100);

// Výchozí konfigurace podle Myrdy (24. 10. 2026). Společná domácnost M&M.
export const ORBIT_DEFAULT = {
  start: '2026-11',              // „začneme od nuly“ – polštář a prasátko se plní od listopadu 2026
  cushionMonths: 1,              // polštář = 1 měsíc nákladů
  costs: [
    { id: 'zalohy', name: 'Zálohy ZP + SP (oba)', emoji: '🏥', amountMinor: kc(18000), day: 8, assumed: 'den splatnosti je předpoklad' },
    { id: 'najem', name: 'Nájem + energie', emoji: '🏠', amountMinor: kc(8500), day: 10 },
    { id: 'splatka', name: 'Splátka', emoji: '💳', amountMinor: kc(4800), day: 19 },
    { id: 'auto', name: 'Auto (Jarda)', emoji: '🚗', amountMinor: kc(12500), day: 20, every: 2, payMonth: '2026-12', payAmountMinor: kc(25000) },
    { id: 'palivo', name: 'Palivo – obě auta', emoji: '⛽', amountMinor: kc(15000), running: true },
    { id: 'ostatni', name: 'Ostatní běžné', emoji: '🛒', amountMinor: kc(2200), running: true, assumed: 'dorovnáno do 61 000 Kč – ověřit' }
  ],
  // Velké sny z prasátka (střádané napříč měsíci)
  dreams: [
    { id: 'bergamo', name: 'Letenky do Bergama pro Myrdu a Monču', emoji: '✈️', priceMinor: kc(20000) },
    { id: 'near', name: 'Nákup NEAR – nejdřív se poraď s kryptOpusem v Projektu Krypto', emoji: '🪙', priceMinor: kc(25000) }
  ]
};

// Měsíční odměny = signál „už si to můžeš dovolit“ (nic se neodečítá). Každý měsíc jiné, v pořadí podle měsíce.
export const REWARD_TIERS = [
  { over: kc(1000), pool: [
    ['🥐', 'Skočte do Kudowy na pączki a kávu – jen tak, ve všední den.'],
    ['📚', 'Antikvariát naslepo: každý vybere tomu druhému knihu podle obálky, kterou nesmíte otočit.'],
    ['🌅', 'Termoska, deka a východ slunce na Dobrošově. Budík na 5:30 je součást odměny.'],
    ['🍕', 'Pizza večer s pravou mozzarellou di bufala a nápisy na krabici jen italsky.'],
    ['🌶️', 'Uvařte jídlo ze země, kde jste nikdy nebyli. Zemi vybere hod kostkou na mapě.'],
    ['🎲', 'Nová desková hra pro dva. Kdo prohraje, vaří zítra.'],
    ['🫒', 'Domácí degustace tří olivových olejů naslepo – průzkum trhu pro Moni Olivo se počítá.'],
    ['🎬', 'Kino ve všední den v 10 dopoledne, kdy je sál jen váš.'],
    ['🧺', 'Piknik na hradbách v Náchodě s jídlem jen z farmářského trhu.'],
    ['🗺️', 'Hoďte si mincí na každé křižovatce a nechte se dovést autem na místo, kde jste ještě nebyli.'],
    ['☕', 'Kavárna v Hradci, kde jste nikdy neseděli, a dvě hodiny bez telefonů.'],
    ['🎨', 'Kurz keramiky nebo malování na jeden večer – výrobek se smí zkazit.']
  ] },
  { over: kc(5000), pool: [
    ['♨️', 'Wellness odpoledne v Kudowě-Zdrój – sauna, bazén, a žádná řeč o práci.'],
    ['🚂', 'Vlak bez plánu: první spoj z Náchoda a vystoupit tam, kde se to líbí víc než doma.'],
    ['📸', 'Instantní fotoaparát a jeden film na celý den spolu – 10 snímků, vybírat pečlivě.'],
    ['🛶', 'Půjčte si kánoi na Metuji nebo Orlici (v zimě bruslení na Rozkoši).'],
    ['🍷', 'Řízená degustace s večeří – víno nebo olej, hlavně ochutnávat pomalu.'],
    ['🧗', 'Lezecká stěna nebo lanové centrum – adrenalin jako prémie za umořené náklady.']
  ] },
  { over: kc(10000), pool: [
    ['🍝', 'Večeře v restauraci, kolem které vždycky jen projíždíte – degustační menu, ne jídelní lístek.'],
    ['🏔️', 'Noc na horské boudě v Krkonoších, výstup pěšky, sestup s polévkou v břiše.'],
    ['🎭', 'Večer v Praze: představení + noc v hotelu, ráno snídaně, kterou nevaříte vy.'],
    ['🇮🇹', 'Lekce italštiny s rodilou mluvčí pro oba a pak italská večeře – objednáváte jen italsky.']
  ] },
  { over: kc(15000), pool: [
    ['🧳', 'Prodloužený víkend ve Vratislavi – trpaslíci, trh a jídlo, které neznáte.'],
    ['🎈', 'Let balonem nad Kladskem – na náklady se z té výšky dívá úplně jinak.'],
    ['🚴', 'Víkend na kolech po Broumovsku s batohy a noclehem v penzionu, kam dojedete až večer.']
  ] }
];

const monthIndex = ym => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
export const ymOf = iso => iso.slice(0, 7);
export function rewardsFor(ym) {
  const k = monthIndex(ym);
  return REWARD_TIERS.map((t, ti) => { const [emoji, text] = t.pool[(k + ti * 5) % t.pool.length]; return { overMinor: t.over, emoji, text }; });
}

function dueDate(ym, day) {
  const last = Number(endOfMonth(ym + '-01').slice(8, 10));
  return ym + '-' + String(Math.min(day, last)).padStart(2, '0');
}

// Náklady konkrétního měsíce. Auto: každý měsíc 12 500 (v mezi-měsíci „odložit“), platba 25 000 jednou za 2 měsíce.
export function costsFor(ym, cfg = ORBIT_DEFAULT) {
  const first = ym + '-01', last = endOfMonth(first);
  return cfg.costs.map(c => {
    if (c.running) return { ...c, due: last, label: c.name };
    let label = c.name, note = null;
    if (c.every === 2 && c.payMonth) {
      const pay = ym >= c.payMonth && (monthIndex(ym) - monthIndex(c.payMonth)) % 2 === 0; // první platba 20. 12. 2026
      note = pay ? 'platba ' + (c.payAmountMinor / 100).toLocaleString('cs-CZ') + ' Kč (z toho 12 500 odloženo minule)' : 'odložit na příští platbu';
    }
    return { ...c, due: dueDate(ym, c.day), label, note };
  }).sort((a, b) => a.due.localeCompare(b.due) || (a.running ? 1 : -1));
}
export const totalCosts = (ym, cfg = ORBIT_DEFAULT) => sumMinor(costsFor(ym, cfg));

// Příjmy měsíce ve vrstvách jistoty. Chiméra nabídek sem nepatří nikdy.
export function incomeLayers(items, ym, today) {
  const first = ym + '-01', last = endOfMonth(first);
  const L = { paid: 0, onway: 0, ready: 0, forecast: 0 };
  for (const i of items) {
    if (i.lostAt) continue;
    const st = status(i, today);
    if (st === ST.PAID) { if (i.paidAt >= first && i.paidAt <= last) L.paid += i.amountMinor; continue; }
    if (last < today) continue; // uzavřený měsíc: jen skutečné platby
    const d = expectedPayDate(i, today);
    if (!d || d < first || d > last) continue;
    if (st === ST.INVOICED) L.onway += i.amountMinor;
    else if (st === ST.READY) L.ready += i.amountMinor;
    else if (st === ST.WAITING && !isBlocked(i)) L.forecast += i.amountMinor;
  }
  L.sure = L.paid; L.likely = L.paid + L.onway + L.ready; L.all = L.likely + L.forecast;
  return L;
}

// Umořování: náklady podle splatnosti, postupně ze „jisté“, „pravděpodobné“ a „vše“ vrstvy.
export function coverage(costs, L) {
  let a = L.sure, b = L.likely, c = L.all;
  return costs.map(x => {
    const take = (pot) => { const t = Math.min(pot, x.amountMinor); return t; };
    const s = take(a), l = take(b), f = take(c);
    a -= s; b -= l; c -= f;
    return { ...x, sure: s, likely: l, all: f, state: s >= x.amountMinor ? 'done' : l >= x.amountMinor ? 'invoiced' : f >= x.amountMinor ? 'forecast' : 'open' };
  });
}

// Polštář a prasátko: uzavřené měsíce od cfg.start. Přebytek nejdřív dorovná polštář, zbytek do prasátka.
// Schodek bere polštář, pak prasátko; co nepokryjí, je „díra“ (peníze odjinud – nesledujeme).
export function ledger(items, today, cfg = ORBIT_DEFAULT) {
  const curYm = ymOf(today);
  let cushion = 0, piggy = 0, hole = 0;
  const months = [];
  for (let ym = cfg.start; ym < curYm; ym = ymOf(addMonths(ym + '-01', 1))) {
    const costs = totalCosts(ym, cfg), target = costs * cfg.cushionMonths;
    const inc = incomeLayers(items, ym, today).paid, s = inc - costs;
    if (s >= 0) { const toC = Math.min(s, Math.max(0, target - cushion)); cushion += toC; piggy += s - toC; }
    else { let d = -s; const fromC = Math.min(d, cushion); cushion -= fromC; d -= fromC; const fromP = Math.min(d, piggy); piggy -= fromP; d -= fromP; hole += d; }
    months.push({ ym, income: inc, costs, surplus: s, cushion, piggy });
  }
  return { cushion, piggy, hole, months, cushionTarget: totalCosts(curYm, cfg) * cfg.cushionMonths };
}

// Celý pohled pro aktuální měsíc.
export function orbit(items, today, cfg = ORBIT_DEFAULT) {
  const ym = ymOf(today);
  const costs = costsFor(ym, cfg), total = sumMinor(costs);
  const L = incomeLayers(items, ym, today);
  const cov = coverage(costs, L);
  const led = ledger(items, today, cfg);
  const surplusLikely = L.likely - total, surplusAll = L.all - total;
  // co zbude po nákladech: nejdřív polštář, pak odměny/prasátko
  const freeAll = Math.max(0, surplusAll), needCushion = Math.max(0, led.cushionTarget - led.cushion);
  const overCushion = Math.max(0, freeAll - needCushion);
  // odměny = signál nad náklady (Myrda 24. 10.: nic se neodečítá); polštář chrání jen prasátko a velké sny
  const rewards = rewardsFor(ym).map(r => ({ ...r, unlocked: freeAll >= r.overMinor }));
  const piggyEnd = led.piggy + overCushion;
  const dreams = cfg.dreams.map(d => ({ ...d, have: Math.min(piggyEnd, d.priceMinor), ready: piggyEnd >= d.priceMinor }));
  const nextOpen = cov.find(c => c.state === 'open' || c.state === 'forecast') || null;
  const pct = total ? Math.min(100, Math.round(L.all / total * 100)) : 100;
  const pctSure = total ? Math.min(100, Math.round(L.sure / total * 100)) : 100;
  const pctLikely = total ? Math.min(100, Math.round(L.likely / total * 100)) : 100;
  return { ym, costs: cov, total, layers: L, pct, pctSure, pctLikely, surplusLikely, surplusAll, ledger: led, needCushion, overCushion, rewards, piggyEnd, dreams, nextOpen, startsAt: cfg.start, started: ym >= cfg.start };
}
