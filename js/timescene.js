// Cesta časem: řeka času se splátkami jako hvězdami, skřítek jede po posuvníku. Data = nároky s datem z core.js, nic se nepočítá nově.
import { isCalm, buzz } from './fx.js?v=8.23';
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const resolve = c => { const m = /^var\((--[a-z0-9-]+)\)/.exec(c || ''); return m ? css(m[1]) : (c || '#888'); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kc = minor => Math.round(minor / 100).toLocaleString('cs-CZ').replace(/ /g, ' ') + ' Kč';
const DAYS = 120;
export function timeHtml(o) { return `<div class="ts" data-time='${esc(JSON.stringify(o))}'></div>`; }
export function mountAll(root = document) { root.querySelectorAll('.ts[data-time]').forEach(mount); }
const remembered = { v: 0 };
function mount(el) {
  if (el.dataset.mounted) return; el.dataset.mounted = '1';
  const o = JSON.parse(el.dataset.time), P = o.points; // {d, a (minor), c (barva), n (název)}
  const total = P.reduce((s, p) => s + p.a, 0);
  el.innerHTML = `<div class="tsnum"><span class="k">Dozraje do <b class="tsdate">dneška</b></span><div class="tsbig mono">0 Kč</div></div>
    <div class="tsc" tabindex="-1"><canvas></canvas><img class="tsrider" src="img/elf/cas.webp?v=8.23" alt="" width="64" height="64"></div>
    <label class="k" for="tsr">Posun v čase</label><input id="tsr" class="tsrng" type="range" min="0" max="${DAYS}" value="${remembered.v}" step="1" aria-label="Posun v čase ve dnech">`;
  const sc = el.querySelector('.tsc'), cv = el.querySelector('canvas'), rider = el.querySelector('.tsrider'), rng = el.querySelector('.tsrng'), big = el.querySelector('.tsbig'), dateEl = el.querySelector('.tsdate');
  let tv = remembered.v, W = 0, H = 0, bursts = [], lastLit = 0, shown = 0, anim = false;
  const base = new Date(); const MONTHS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  const X = d => 26 + (W - 52) * d / DAYS, Y = d => H * .34 + Math.sin(d / DAYS * Math.PI * 2.3 + .6) * H * .11;
  const fit = () => { const r = sc.getBoundingClientRect(), dp = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dp); cv.height = Math.round(H * dp); cv.getContext('2d').setTransform(dp, 0, 0, dp, 0, 0); draw(); };
  const dark = () => document.documentElement.dataset.theme !== 'light';
  function draw() {
    const x = cv.getContext('2d'); x.clearRect(0, 0, W, H); const baseY = H - 30, top = H * .58, acc = css('--gold'), mu = css('--mu'), ln = css('--ln');
    x.font = '600 11px monospace'; x.textAlign = 'center';
    for (let m = 0; m < 5; m++) { const dt = new Date(base.getFullYear(), base.getMonth() + m, 1), d = m === 0 ? 0 : Math.round((dt - base) / 864e5); if (d > DAYS) break; const px = X(d); x.strokeStyle = ln; x.lineWidth = 1; x.setLineDash([2, 6]); x.beginPath(); x.moveTo(px, 18); x.lineTo(px, baseY); x.stroke(); x.setLineDash([]); x.fillStyle = mu; x.fillText(m === 0 ? 'dnes' : MONTHS[dt.getMonth()], Math.max(22, Math.min(W - 26, px)), H - 10); }
    const yv = v => baseY - (baseY - top) * (total ? v / total : 0);
    const stair = (to, close) => { x.beginPath(); x.moveTo(X(0), baseY); let cur = 0; for (const p of P) { if (p.d > to) break; x.lineTo(X(p.d), yv(cur)); cur += p.a; x.lineTo(X(p.d), yv(cur)); } x.lineTo(X(to), yv(cur)); if (close) { x.lineTo(X(to), baseY); x.closePath(); } };
    x.strokeStyle = mu; x.globalAlpha = .4; x.lineWidth = 1.5; x.setLineDash([3, 6]); stair(DAYS, false); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
    const g = x.createLinearGradient(0, top, 0, baseY); g.addColorStop(0, acc + 'aa'); g.addColorStop(1, acc + '11'); x.fillStyle = g; stair(tv, true); x.fill(); x.strokeStyle = acc; x.lineWidth = 2.5; stair(tv, false); x.stroke();
    const river = to => { x.beginPath(); for (let d = 0; d <= to; d++) { const px = X(d), py = Y(d); d ? x.lineTo(px, py) : x.moveTo(px, py); } };
    x.lineCap = 'round'; x.strokeStyle = mu; x.globalAlpha = .45; x.lineWidth = 3; x.setLineDash([2, 9]); river(DAYS); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
    if (tv > 0) { const rg = x.createLinearGradient(X(0), 0, X(tv), 0); rg.addColorStop(0, css('--vio')); rg.addColorStop(1, css('--mint')); x.strokeStyle = rg; x.lineWidth = 5; if (dark()) { x.shadowColor = css('--mint'); x.shadowBlur = 12; } river(tv); x.stroke(); x.shadowBlur = 0; }
    for (const p of P) {
      const px = X(p.d), py = Y(p.d), r = 6 + Math.sqrt(p.a / 100) / 13, col = resolve(p.c), lit = p.d <= tv;
      if (lit) { x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, 6.28); x.fill(); x.strokeStyle = dark() ? '#fff' : css('--s1'); x.lineWidth = 2; x.stroke(); x.strokeStyle = col; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; x.beginPath(); x.moveTo(px + Math.cos(a) * (r + 3), py + Math.sin(a) * (r + 3)); x.lineTo(px + Math.cos(a) * (r + 8), py + Math.sin(a) * (r + 8)); x.stroke(); } x.fillStyle = css('--fg'); x.font = '700 11px monospace'; x.fillText(String(Math.round(p.a / 10000) / 10).replace('.', ',') + 'k', px, py + r + 20); }
      else { x.strokeStyle = col; x.lineWidth = 2.5; x.setLineDash([3, 4]); x.fillStyle = css('--s2'); x.beginPath(); x.arc(px, py, r, 0, 6.28); x.fill(); x.stroke(); x.setLineDash([]); }
    }
    bursts = bursts.filter(b => b.l > 0); for (const b of bursts) { b.x += b.vx; b.y += b.vy; b.vy += .12; b.l -= .03; x.globalAlpha = Math.max(0, b.l); x.fillStyle = b.c; x.beginPath(); x.arc(b.x, b.y, b.r, 0, 6.28); x.fill(); } x.globalAlpha = 1;
    rider.style.transform = `translate(${X(tv) - 32}px,${Y(tv) - 62}px)`;
    if (bursts.length && !anim) { anim = true; requestAnimationFrame(() => { anim = false; if (el.isConnected) draw(); }); }
  }
  function set(v) {
    tv = +v; remembered.v = tv; const d = new Date(base); d.setDate(d.getDate() + tv); dateEl.textContent = tv === 0 ? 'dneška' : d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
    let sum = 0, lit = 0; P.forEach((p, i) => { if (p.d <= tv) { sum += p.a; lit++; if (i >= lastLit && !isCalm()) { const c = resolve(p.c); for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, s = 1.5 + Math.random() * 3.5; bursts.push({ x: X(p.d), y: Y(p.d), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, l: 1, r: 2 + Math.random() * 2.5, c }); } } } });
    if (lit > lastLit) buzz(8); lastLit = lit;
    const from = shown; shown = sum; const t0 = performance.now();
    if (isCalm()) big.textContent = kc(sum); else (function f(t) { if (!el.isConnected) return; const p = Math.min(1, (t - t0) / 350); big.textContent = kc(from + (sum - from) * p); if (p < 1) requestAnimationFrame(f); })(t0);
    draw();
  }
  rng.addEventListener('input', e => set(e.target.value));
  const drag = e => { const r = sc.getBoundingClientRect(), d = Math.round(Math.max(0, Math.min(DAYS, (e.clientX - r.left - 26) / (r.width - 52) * DAYS))); rng.value = d; set(d); };
  sc.addEventListener('pointerdown', e => { sc.setPointerCapture(e.pointerId); drag(e); });
  sc.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') drag(e); });
  new ResizeObserver(fit).observe(sc); fit(); set(tv);
}
