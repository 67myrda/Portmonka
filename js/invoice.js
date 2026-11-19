// Portmonka – faktury (19. 11. 2026). Jednotný vzhled podle faktur Pro-Factor z Taháku, pruh v barvě odběratele.
// Čisté funkce + otevření tiskového okna. Žádný Firestore (ten řeší store.js).
export const CUSTOMERS = { dm: 'Domoveo', go: 'GOORN', pf: 'Pro-Factor', os: 'Ostatní' };
export const CUST_CODE = { dm: 1, go: 2, pf: 3, os: 4 };
export const SERIES_PREFIX = { dm: 'DM', go: 'GO', pf: 'PF', os: 'OS' };
export const WHO = { O: 'Monika', Y: 'Myrda' };
export const BAND = { dm: ['#1f3a5f', '#ffffff', '#b9c8de', '#1f3a5f'], go: ['#cdebd2', '#16341f', '#4f7a5a', '#2f8a4c'], pf: ['#f59a3c', '#2b1500', '#6d3a06', '#c2620e'], os: ['#ffd54a', '#2b2300', '#6f5a00', '#9a7b00'] };
export const BANK_NAMES = { '2010': 'Fio banka', '0800': 'Česká spořitelna', '0100': 'Komerční banka', '0300': 'ČSOB', '0600': 'MONETA Money Bank', '2700': 'UniCredit Bank', '3030': 'Air Bank', '5500': 'Raiffeisenbank', '6210': 'mBank' };
export const BANK_SWIFT = { '2010': 'FIOBCZPP', '0800': 'GIBACZPX', '0100': 'KOMBCZPP', '0300': 'CEKOCZPP', '0600': 'AGBACZPP', '2700': 'BACXCZPP', '3030': 'AIRACZPP', '5500': 'RZBCCZPP', '6210': 'BREXCZPP' };
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
export const monthName = ym => MONTHS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);

export function parseCzAccount(s) { const m = String(s || '').replace(/\s/g, '').match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/); return m ? { prefix: m[1] || '', number: m[2], bank: m[3] } : null; }
export function czIban(acc) {
  const a = parseCzAccount(acc); if (!a) return '';
  const bban = a.bank + a.prefix.padStart(6, '0') + a.number.padStart(10, '0');
  let r = 0; for (const ch of bban + '123500') r = (r * 10 + (+ch)) % 97;
  return 'CZ' + String(98 - r).padStart(2, '0') + bban;
}
export function supplierComplete(s) { return !!(s && s.name && s.street && s.city && s.ico && parseCzAccount(s.account)); }
const spdClean = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, ' ').replace(/[*]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 60);
export function buildSpd({ iban, amount, vs, due, msg }) {
  let s = 'SPD*1.0*ACC:' + iban + '*AM:' + Number(amount).toFixed(2) + '*CC:CZK';
  if (due) s += '*DT:' + due.replace(/-/g, ''); if (vs) s += '*X-VS:' + vs; if (msg) s += '*MSG:' + spdClean(msg);
  return s + '*';
}
function qrSvg(text) {
  const q = globalThis.qrcode; if (typeof q !== 'function') return '';
  const qr = q(0, 'M'); qr.addData(text); qr.make(); const n = qr.getModuleCount(); let p = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) p += 'M' + c + ',' + r + 'h1v1h-1z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ' + (n + 8) + ' ' + (n + 8) + '" shape-rendering="crispEdges"><rect x="-4" y="-4" width="' + (n + 8) + '" height="' + (n + 8) + '" fill="#fff"/><path d="' + p + '" fill="#000"/></svg>';
}

// Číselná řada: DMO02/26; od nového roku znovu od 01. VS = RR + kód odběratele + pořadí (26102).
export const seriesKey = (cust, who) => SERIES_PREFIX[cust] + who;
export function nextNumber(cfg, cust, who, issuedIso) {
  const yy = Number(issuedIso.slice(2, 4)), key = seriesKey(cust, who), s = (cfg.series || {})[key] || { yy, next: 1 };
  const n = Number(s.yy) === yy ? Math.max(1, Number(s.next) || 1) : 1;
  return { key, n, yy, number: key + String(n).padStart(2, '0') + '/' + String(yy).padStart(2, '0'), vs: String(yy).padStart(2, '0') + CUST_CODE[cust] + String(n).padStart(2, '0') };
}
export const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

const E = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const K2 = n => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ');
const K0 = n => Math.round(Number(n)).toLocaleString('cs-CZ').replace(/\s/g, ' ');
const D = iso => { const [y, m, d] = iso.split('-'); return parseInt(d) + '. ' + parseInt(m) + '. ' + y; };
const bandStyle = c => { const b = BAND[c] || BAND.os; return `--band:${b[0]};--bandtx:${b[1]};--bandlbl:${b[2]};--accent:${b[3]}`; };

// inv = {number, vs, issued, due, cust, lines:[{text, amountMinor}], amountMinor, qrMsg, supplier, customer, attachment?}
export function invoiceHtml(inv) {
  const s = inv.supplier, c = inv.customer, iban = czIban(s.account), bc = (parseCzAccount(s.account) || {}).bank, amount = inv.amountMinor / 100;
  const spd = buildSpd({ iban, amount, vs: inv.vs, due: inv.due, msg: inv.qrMsg });
  return '<section class="inv" style="' + bandStyle(inv.cust) + '">'
  + '<header class="top"><div><div class="kind">Faktura</div><div class="sub">Nejsem plátce DPH</div></div><div class="numbox"><div class="lbl">Číslo dokladu</div><span class="num">' + E(inv.number) + '</span></div></header>'
  + '<div class="parties"><div><div class="lbl">Dodavatel</div><div class="pname">' + E(s.name) + '</div><div>' + E(s.street) + '</div><div>' + E(s.city) + '</div><div class="ids"><span>IČO&nbsp;' + E(s.ico) + '</span></div></div>'
  + '<div><div class="lbl">Odběratel</div><div class="pname">' + E(c.name) + '</div><div>' + E(c.street) + '</div><div>' + E(c.city) + '</div><div class="ids">' + (c.ico ? '<span>IČO&nbsp;' + E(c.ico) + '</span>' : '') + (c.dic ? '<span>DIČ&nbsp;' + E(c.dic) + '</span>' : '') + '</div></div></div>'
  + '<div class="meta"><div><div class="lbl">Datum vystavení</div><div class="mv">' + D(inv.issued) + '</div></div><div><div class="lbl">Datum splatnosti</div><div class="mv">' + D(inv.due) + '</div></div><div><div class="lbl">Forma úhrady</div><div class="mv">Převodem</div></div><div><div class="lbl">Variabilní symbol</div><div class="mv">' + E(inv.vs) + '</div></div></div>'
  + '<table class="items"><thead><tr><th>Předmět fakturace</th><th class="r">Částka</th></tr></thead><tbody>' + inv.lines.map(l => '<tr><td>' + E(l.text) + '</td><td class="r">' + K2(l.amountMinor / 100) + '&nbsp;Kč</td></tr>').join('') + '</tbody></table>'
  + '<div class="pay"><div class="qr">' + qrSvg(spd) + '<div class="qrl">QR Platba</div></div>'
  + '<div class="bank"><div class="lbl">Platební údaje</div><div class="brow"><span>Banka</span><b>' + E(s.bank || BANK_NAMES[bc] || '') + '</b></div><div class="brow"><span>Číslo účtu</span><b>' + E(s.account) + '</b></div><div class="brow"><span>IBAN</span><b>' + iban.replace(/(.{4})/g, '$1 ').trim() + '</b></div>' + ((s.swift || BANK_SWIFT[bc]) ? '<div class="brow"><span>SWIFT</span><b>' + E(s.swift || BANK_SWIFT[bc]) + '</b></div>' : '') + '</div>'
  + '<div class="total"><div class="lbl">Celkem k úhradě</div><div class="tv">' + K2(amount) + '&nbsp;Kč</div></div></div>'
  + '<footer class="foot"><div><div class="brow"><span>Vystavil</span><b>' + E(s.name) + '</b></div>' + (s.phone ? '<div class="brow"><span>Telefon</span><b>' + E(s.phone) + '</b></div>' : '') + (s.email ? '<div class="brow"><span>E-mail</span><b>' + E(s.email) + '</b></div>' : '') + '<div class="legal">Fyzická osoba zapsaná v živnostenském rejstříku.</div></div>'
  + '<div class="sign"><div class="sline"></div><div class="lbl">Razítko, podpis</div></div></footer></section>';
}
// Příloha GOORN: rows = [{part:1|2, jmeno, adresa, zakladMinor, provizeMinor}]
export function attachmentHtml(inv) {
  const rows = inv.attachment || []; let i = 0;
  const part = p => { const xs = rows.filter(r => r.part === p); if (!xs.length) return ''; return '<div class="sec">' + (p === 1 ? 'První' : 'Druhá') + ' část ceny díla</div>' + xs.map(o => { i++; return '<div class="ord"><div class="no">' + i + '.</div><div><div class="who">' + E(o.jmeno) + '</div><div class="ad">' + E(o.adresa) + '</div><div class="ad">Akce: rodinný dům ' + E(o.adresa) + '</div></div><div class="calc"><div class="b">' + p + '. část ceny díla</div><div>' + K0(o.zakladMinor / 100) + ',- Kč bez DPH</div><div class="b">z toho k fakturaci 11 %</div><div class="k">' + K0(o.provizeMinor / 100) + ',- Kč</div></div></div>'; }).join(''); };
  const tot = rows.reduce((a, r) => a + r.provizeMinor, 0);
  return '<section class="inv att" style="' + bandStyle(inv.cust) + '">'
  + '<header class="top"><div><div class="kind">Příloha k faktuře</div><div class="sub">Rozpis zakázek · ' + E(inv.customer.name) + (inv.customer.ico ? ', IČO ' + E(inv.customer.ico) : '') + '</div></div><div class="numbox"><div class="lbl">Příloha č.</div><span class="num">' + E(inv.number) + '</span></div></header>'
  + '<div class="meta sumband"><div><div class="lbl">Ke faktuře</div><div class="mv">' + E(inv.number) + '</div></div><div><div class="lbl">Datum vystavení</div><div class="mv">' + D(inv.issued) + '</div></div><div><div class="lbl">Počet zakázek</div><div class="mv">' + rows.length + '</div></div><div><div class="lbl">Sazba</div><div class="mv">11 % bez DPH</div></div></div>'
  + part(1) + part(2)
  + '<div class="total"><div class="lbl">Celkem k fakturaci</div><div class="tv">' + K0(tot / 100) + ',-&nbsp;Kč</div></div></section>';
}
export const INVOICE_CSS = "@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif;color:#1d2228;background:#e9e7e2;-webkit-print-color-adjust:exact;print-color-adjust:exact}"
  + ".bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px;background:#1d2228;color:#fff;font-size:13px}.bar button{background:#E8772E;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-weight:700;font-size:14px;cursor:pointer}"
  + "@media print{body{background:#fff}.bar{display:none}.inv{margin:0!important;box-shadow:none!important}}"
  + `.inv{width:210mm;height:297mm;margin:0;color:#1d2228;font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif;background:#fff;padding:18mm 17mm 16mm;display:flex;flex-direction:column;page-break-after:always;box-shadow:0 2px 12px rgba(0,0,0,.12)}.inv:last-child{page-break-after:auto}.lbl{font-size:7.6pt;letter-spacing:.09em;text-transform:uppercase;color:#7a828c;font-weight:600;margin-bottom:1.6mm}.top{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:5mm;border-bottom:2.2pt solid #1d2228}.kind{font-size:30pt;font-weight:800;letter-spacing:-.02em;line-height:1}.sub{font-size:8.5pt;color:#7a828c;margin-top:2mm}.numbox{text-align:right}.num{font-size:17pt;font-weight:700;font-variant-numeric:tabular-nums}.num.blank{display:inline-block;width:46mm;height:9mm;border-bottom:1pt dashed #9aa1a9}.parties{display:grid;grid-template-columns:1fr 1fr;gap:10mm;padding:8mm 0 7mm;font-size:10pt;line-height:1.55}.pname{font-size:12.5pt;font-weight:700;margin-bottom:1mm}.ids{margin-top:2mm;color:#4a525b;font-size:9.2pt;display:flex;gap:5mm}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;padding:4.5mm 5mm;background:var(--band);color:var(--bandtx);border-radius:2.5mm}.meta .lbl{color:var(--bandlbl)}.mv{font-size:11pt;font-weight:600;font-variant-numeric:tabular-nums}.blankline{display:inline-block;width:26mm;border-bottom:1pt dashed #9aa1a9;height:4.5mm}.items{width:100%;border-collapse:collapse;margin-top:9mm;font-size:10.5pt}.items th{text-align:left;font-size:7.6pt;letter-spacing:.09em;text-transform:uppercase;color:#7a828c;font-weight:600;padding:0 0 2.5mm;border-bottom:.8pt solid #c9cdd2}.items td{padding:5mm 0;border-bottom:.8pt solid #c9cdd2}.items .r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.pay{margin-top:auto;display:grid;grid-template-columns:32mm minmax(0,1fr) 56mm;gap:5mm;align-items:end;padding-bottom:8mm;border-bottom:.8pt solid #c9cdd2}.qr svg{width:32mm;height:32mm;display:block}.qrl{font-size:7.6pt;text-align:center;color:#7a828c;margin-top:1mm;letter-spacing:.06em;text-transform:uppercase;font-weight:600}.bank{font-size:8.8pt}.brow{display:flex;gap:3mm;padding:.8mm 0}.brow span{width:17mm;color:#7a828c;flex-shrink:0}.brow b{font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}.total{border:1.6pt solid #1d2228;border-radius:2.5mm;padding:4.5mm 5.5mm}.tv{font-size:17pt;font-weight:800;text-align:right;font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}.foot{display:flex;justify-content:space-between;align-items:flex-end;padding-top:6mm;font-size:9.2pt}.legal{color:#7a828c;font-size:8.2pt;margin-top:2.5mm}.sign{width:50mm;text-align:center}.sline{border-bottom:.8pt solid #1d2228;height:20mm;margin-bottom:1.5mm}
/* příloha GOORN */
.att .top{align-items:flex-end}.att .kind{font-size:22pt}
.att .sumband{margin-top:7mm}
.sec{margin-top:7mm;font-size:8pt;letter-spacing:.09em;text-transform:uppercase;color:#7a828c;font-weight:700;display:flex;align-items:center;gap:3mm}
.sec::after{content:"";flex:1;border-bottom:.8pt solid #c9cdd2}
.ord{display:grid;grid-template-columns:7mm minmax(0,1fr) 38mm;gap:3mm;padding:3.6mm 0;border-bottom:.6pt solid #e3e5e8;font-size:9.6pt;line-height:1.45}
.ord .no{font-weight:800;color:var(--accent,#2f8a4c);font-variant-numeric:tabular-nums}
.ord .who{font-weight:700;font-size:10.4pt}
.ord .ad{color:#4a525b}
.ord .calc{text-align:right;font-variant-numeric:tabular-nums}
.ord .calc .b{font-size:8.6pt;color:#7a828c}
.ord .calc .k{font-weight:800;font-size:11pt}
.att .total{margin-top:auto;align-self:flex-end;width:70mm}`.replace('.inv{width:210mm;height:297mm;margin:0;', '.inv{width:210mm;height:297mm;margin:10px auto;box-shadow:0 2px 12px rgba(0,0,0,.12);');
export function openInvoiceWindow(inv) {
  const pages = invoiceHtml(inv) + (inv.attachment && inv.attachment.length ? attachmentHtml(inv) : '');
  const title = 'Faktura ' + inv.number;
  const html = '<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + E(title) + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"><style>' + INVOICE_CSS + '</style></head><body>'
    + '<div class="bar"><span>' + E(title) + ' · ' + E(inv.customer.name) + '</span><button onclick="window.print()">🖨️ Tisk / Uložit jako PDF</button></div>' + pages + '</body></html>';
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const w = window.open(url, '_blank');
  if (!w) location.href = url;
}
