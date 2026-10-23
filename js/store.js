// Datová vrstva Portmonky: Firestore (ostrý provoz) a paměťový režim (ukázková data, nic se neukládá).
// Model: users/{uid}/cases/{caseId}/installments/{id} + users/{uid}/events/{id}
import { buildInstallments, localToday, addDays, addMonths, GOORN_PART1_MINOR, GOORN_PART2_MINOR, COND_GOORN, COND_DOMOVEO } from './core.js?v=8.5';

const FB = 'https://www.gstatic.com/firebasejs/12.19.0/';
const firebaseConfig = { apiKey: 'AIzaSyAw4mguBLX5RKw0qponSyGEacwiExt4OkI', authDomain: 'portmonka-951967.firebaseapp.com', projectId: 'portmonka-951967', storageBucket: 'portmonka-951967.firebasestorage.app', messagingSenderId: '723477690356', appId: '1:723477690356:web:261e152b2da52251b2ba1' };

const INST_FIELDS = ['label', 'kind', 'amountMinor', 'claimDate', 'blockingCondition', 'conditionSatisfiedDate', 'invoicedAt', 'invoiceId', 'invoiceNo', 'paidAt', 'lostAt', 'lostReason'];
function pickInst(i) { const o = {}; for (const k of INST_FIELDS) o[k] = i[k] ?? null; o.kind = o.kind || 'commission'; return o; }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }

/* ================= Firestore ================= */
export async function createFirestoreStore() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')
  ]);
  const app = initializeApp(firebaseConfig), auth = A.getAuth(app), db = F.getFirestore(app);
  let user = null;
  const casesCol = () => F.collection(db, 'users', user.uid, 'cases');
  const caseDoc = id => F.doc(db, 'users', user.uid, 'cases', id);
  const instCol = cid => F.collection(caseDoc(cid), 'installments');
  const evCol = () => F.collection(db, 'users', user.uid, 'events');
  const ev = (b, type, caseId = null, installmentId = null, extra = null) =>
    b.set(F.doc(evCol()), { type, caseId, installmentId, actorUid: user.uid, occurredAt: F.serverTimestamp(), ...(extra ? { detail: extra } : {}) });

  return {
    mode: 'firestore',
    onAuth(cb) { A.onAuthStateChanged(auth, u => { user = u; cb(u ? { email: u.email, uid: u.uid } : null); }); },
    signIn() { return A.signInWithPopup(auth, new A.GoogleAuthProvider()); },
    signOut() { return A.signOut(auth); },
    async load() {
      const snap = await F.getDocs(F.query(casesCol(), F.orderBy('createdAt', 'desc')));
      const cases = await Promise.all(snap.docs.map(async d => {
        const is = await F.getDocs(instCol(d.id));
        return { id: d.id, ...d.data(), installments: is.docs.map(z => ({ id: z.id, ...z.data() })) };
      }));
      let offers = null;
      try { const u = await F.getDoc(F.doc(db, 'users', user.uid)); offers = u.exists() ? (u.data().domoveoNabidky || null) : null; } catch (e) { console.warn('chiméra nabídek', e); }
      return { cases, offers };
    },
    async createCase(c, insts) {
      const cRef = F.doc(casesCol()), b = F.writeBatch(db);
      b.set(cRef, { ...c, financeSpaceId: 'MM', currency: 'CZK', createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
      ev(b, 'CASE_CREATED', cRef.id);
      for (const i of insts) { const r = F.doc(instCol(cRef.id)); b.set(r, { ...pickInst(i), updatedAt: F.serverTimestamp() }); ev(b, 'INSTALLMENT_CREATED', cRef.id, r.id); }
      await b.commit(); return cRef.id;
    },
    // patch případu + seznam změněných / nových / smazaných splátek
    async updateCase(caseId, patch, changes, reason = 'CASE_UPDATED') {
      const b = F.writeBatch(db);
      if (patch) b.update(caseDoc(caseId), { ...patch, updatedAt: F.serverTimestamp() });
      for (const ch of changes || []) {
        if (ch.op === 'set') { const r = ch.id ? F.doc(instCol(caseId), ch.id) : F.doc(instCol(caseId)); b.set(r, { ...pickInst(ch.data), updatedAt: F.serverTimestamp() }); }
        else if (ch.op === 'update') b.update(F.doc(instCol(caseId), ch.id), { ...ch.data, updatedAt: F.serverTimestamp() });
        else if (ch.op === 'delete') b.delete(F.doc(instCol(caseId), ch.id));
        ev(b, ch.event || 'INSTALLMENT_UPDATED', caseId, ch.id || null);
      }
      if (patch) ev(b, reason, caseId);
      await b.commit();
    },
    // Faktura = skupina splátek se společným invoiceId (žádná nová kolekce).
    async createInvoice(inv, items) {
      const id = uid(), b = F.writeBatch(db);
      for (const it of items) { b.update(F.doc(instCol(it.caseId), it.id), { invoicedAt: inv.issuedAt, invoiceId: id, invoiceNo: inv.number || null, updatedAt: F.serverTimestamp() }); ev(b, 'INSTALLMENT_INVOICED', it.caseId, it.id, { invoiceId: id, invoiceNo: inv.number || null }); }
      await b.commit(); return id;
    },
    async payItems(items, paidAt) {
      const b = F.writeBatch(db);
      for (const it of items) { b.update(F.doc(instCol(it.caseId), it.id), { paidAt, updatedAt: F.serverTimestamp() }); ev(b, 'INSTALLMENT_PAID', it.caseId, it.id); }
      await b.commit();
    },
    async deleteCase(c) {
      const b = F.writeBatch(db);
      for (const i of c.installments || []) b.delete(F.doc(instCol(c.id), i.id));
      b.delete(caseDoc(c.id)); ev(b, 'CASE_DELETED', c.id, null, { title: c.title, totalAmountMinor: c.totalAmountMinor ?? null });
      await b.commit();
    }
  };
}

/* ================= Ukázková data (paměť) ================= */
export function createMemoryStore() {
  const T = localToday();
  const d = n => addDays(T, n);
  const cases = [];
  const add = (source, title, trig, input, tweak) => {
    const r = buildInstallments({ source, triggerDate: trig, ...input });
    const c = { id: uid(), source, title, triggerDate: trig, kind: input.domoveo?.kind === 'bonus' ? 'bonus' : 'case', totalAmountMinor: r.totalAmountMinor, createdAt: trig,
      installments: r.installments.map(i => ({ ...i, id: uid() })) };
    if (tweak) tweak(c.installments);
    cases.push(c);
  };
  add('Pro-Factor', 'Náchod', addMonths(T, -5), { totalMinor: 2000000 }, i => { i[0].invoicedAt = addDays(i[0].claimDate, 2); i[0].paidAt = addDays(i[0].claimDate, 21); i[1].invoicedAt = addDays(i[1].claimDate, 2); i[1].paidAt = addDays(i[1].claimDate, 20); });
  add('Pro-Factor', 'Jaroměř', addMonths(T, -4), { totalMinor: 1200000 }, i => { i[0].invoicedAt = addDays(i[0].claimDate, 1); i[0].paidAt = addDays(i[0].claimDate, 16); });
  add('Pro-Factor', 'Litomyšl', addMonths(T, -3), { totalMinor: 2500000 }, i => { i[0].invoicedAt = addDays(i[0].claimDate, 2); i[0].paidAt = addDays(i[0].claimDate, 18); });
  add('Pro-Factor', 'Polička', d(-48), { totalMinor: 2200000 }, i => { i[0].invoicedAt = d(-45); i[0].paidAt = d(-23); });
  add('Pro-Factor', 'Svitavy', d(-9), { totalMinor: 2800000 });
  add('GOORN', 'Dvořák, Hronov', d(-156), {}, i => { i[0].invoicedAt = d(-154); i[0].paidAt = d(-127); });
  add('GOORN', 'Novák, Police', d(-121), {}, i => { i[0].invoicedAt = d(-119); i[0].paidAt = d(-94); });
  add('GOORN', 'Pokorná, Úpice', d(-65), {}, i => { i[0].invoicedAt = d(-63); i[0].paidAt = d(-35); i[1].conditionSatisfiedDate = d(-3); i[1].claimDate = d(-3); });
  add('GOORN', 'Svoboda, Broumov', d(-21), {}, i => { i[0].invoicedAt = d(-19); i[0].invoiceNo = '7/26'; });
  add('GOORN', 'Malý, Nové Město', d(-8), {});
  add('Domoveo.cz', 'Mačková, Trutnov', d(-4), { domoveo: { kind: 'order', priceNetMinor: 352100, rate: 17 } });
  add('Domoveo.cz', 'Čelišová, Jičín', d(-4), { domoveo: { kind: 'order', priceNetMinor: 980000, rate: 17 } });
  add('Domoveo.cz', 'Ukázka: technik nevpuštěn', d(-15), { domoveo: { kind: 'order', priceNetMinor: 658800, rate: 17 } }, i => { i[0].lostAt = d(-6); i[0].lostReason = 'Klient nepustil technika'; });
  add('Grafika', 'Plakát Jazz Náchod', d(-38), { totalMinor: 850000 }, i => { i[0].invoicedAt = d(-37); });
  add('Grafika', 'Logo kavárna', d(-80), { totalMinor: 420000 }, i => { i[0].invoicedAt = d(-79); i[0].paidAt = d(-65); });
  add('Grafika', 'Vizitky', d(-20), { totalMinor: 240000 }, i => { i[0].invoicedAt = d(-20); i[0].paidAt = d(-14); });
  const offers = { updatedAt: T, dphPct: 12, sazbaPct: 17, uspesnostPct: 20, celkemMinor: 1394700, realneMinor: 278900, polozky: [
    { klient: 'Ukázka Novotná', obec: 'Trutnov', castkaSDphKc: 51839, zakladKc: 46285, provizeMinor: 786800, schuzka: d(-4) },
    { klient: 'Ukázka Dvořák', obec: 'Náchod', castkaSDphKc: 25292, zakladKc: 22582, provizeMinor: 383900, schuzka: d(-3) },
    { klient: 'Ukázka Malá', obec: 'Hradec Králové', castkaSDphKc: 26925, zakladKc: 24040, provizeMinor: 224000, schuzka: d(-1) }] };
  const find = (cid, id) => cases.find(c => c.id === cid)?.installments.find(i => i.id === id);
  const clone = x => JSON.parse(JSON.stringify(x));
  return {
    mode: 'memory',
    onAuth(cb) { setTimeout(() => cb({ email: 'ukázková data', uid: 'demo' }), 0); },
    signIn() {}, signOut() { location.search = ''; },
    async load() { return { cases: clone(cases), offers: clone(offers) }; },
    async createCase(c, insts) { const id = uid(); cases.unshift({ ...c, id, createdAt: T, installments: insts.map(i => ({ ...pickInst(i), id: uid() })) }); return id; },
    async updateCase(caseId, patch, changes) {
      const c = cases.find(x => x.id === caseId); if (!c) throw new Error('Případ nenalezen');
      if (patch) Object.assign(c, patch);
      for (const ch of changes || []) {
        if (ch.op === 'set') { const id = ch.id || uid(); const ix = c.installments.findIndex(i => i.id === id); const v = { ...pickInst(ch.data), id }; if (ix >= 0) c.installments[ix] = v; else c.installments.push(v); }
        else if (ch.op === 'update') Object.assign(find(caseId, ch.id), ch.data);
        else if (ch.op === 'delete') c.installments = c.installments.filter(i => i.id !== ch.id);
      }
    },
    async createInvoice(inv, items) { const id = uid(); for (const it of items) Object.assign(find(it.caseId, it.id), { invoicedAt: inv.issuedAt, invoiceId: id, invoiceNo: inv.number || null }); return id; },
    async payItems(items, paidAt) { for (const it of items) find(it.caseId, it.id).paidAt = paidAt; },
    async deleteCase(c) { const ix = cases.findIndex(x => x.id === c.id); if (ix >= 0) cases.splice(ix, 1); }
  };
}

export { GOORN_PART1_MINOR, GOORN_PART2_MINOR, COND_GOORN, COND_DOMOVEO };
