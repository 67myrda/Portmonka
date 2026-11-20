// Portmonka – pohyb. Vrstvy mimo #app (render() přepisuje celé #app), nic nesahá na data.
// Klidný režim: prefers-reduced-motion nebo přepínač (localStorage pm.calm). Bez pohybu se čísla jen přepíšou.
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion:reduce)') : { matches: false };
let stored = null;
try { stored = localStorage.getItem('pm.calm'); } catch (_) {}
let calm = stored === null ? mq.matches : stored === '1';
export const isCalm = () => calm;
export function setCalm(v) {
  calm = !!v;
  try { localStorage.setItem('pm.calm', calm ? '1' : '0'); } catch (_) {}
  document.documentElement.classList.toggle('calm', calm);
}
document.documentElement.classList.toggle('calm', calm);

export function buzz(p) { try { if (!calm && navigator.vibrate) navigator.vibrate(p); } catch (_) {} }

/* ---- čítač čísel: [data-roll="klíč"][data-v="částka v Kč"] ---- */
const shown = new Map();
const kc = n => Math.round(n).toLocaleString('cs-CZ').replace(/ /g, ' ') + ' Kč';
export function rollAll(root = document) {
  root.querySelectorAll('[data-roll]').forEach(el => {
    const key = el.dataset.roll, to = Number(el.dataset.v);
    if (!Number.isFinite(to)) return;
    const from = shown.has(key) ? shown.get(key) : null;
    shown.set(key, to);
    if (calm || from === null || from === to) return;
    const t0 = performance.now(), ms = 800;
    (function f(t) {
      if (!el.isConnected) return;
      const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      el.textContent = kc(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  });
}

/* ---- konfety na plátně mimo #app ---- */
let cv, cx, parts = [], on = false, W = 0, H = 0;
function ensure() {
  if (cv) return;
  cv = document.createElement('canvas'); cv.id = 'fx'; cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90';
  document.body.appendChild(cv); cx = cv.getContext('2d');
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); W = innerWidth; H = innerHeight; };
  size(); addEventListener('resize', size);
}
export function confetti(x, y, colors = ['#5eead4', '#f5b84a', '#b493ff'], n = 46) {
  if (calm) return; ensure();
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 3 + Math.random() * 7; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 3 + Math.random() * 4, c: colors[i % colors.length], l: 1, s: Math.random() * 6.28 }); }
  if (!on) { on = true; requestAnimationFrame(step); }
}
function step() {
  cx.clearRect(0, 0, W, H); parts = parts.filter(p => p.l > 0);
  for (const p of parts) { p.vy += .28; p.x += p.vx; p.y += p.vy; p.vx *= .985; p.l -= .014; p.s += .3; cx.globalAlpha = Math.max(0, p.l); cx.fillStyle = p.c; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.s); cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); cx.restore(); }
  cx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(step); else { on = false; cx.clearRect(0, 0, W, H); }
}
export const mid = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

/* ---- mince letí z bodu do bodu (elementy nebo souřadnice) ---- */
export function fly(a, b, color = '#f5b84a', n = 5) {
  return new Promise(res => {
    if (calm) return res();
    const A = a.getBoundingClientRect ? mid(a) : a, B = b.getBoundingClientRect ? mid(b) : b;
    let done = 0;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.style.cssText = `position:fixed;z-index:91;left:${A.x}px;top:${A.y}px;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;pointer-events:none;background:${color};border:2px solid rgba(255,255,255,.7);box-shadow:0 0 14px ${color}`;
      document.body.appendChild(c);
      const dx = B.x - A.x, dy = B.y - A.y, lift = -90 - Math.random() * 70, side = (Math.random() - .5) * 80;
      c.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 0 }, { transform: `translate(${dx / 2 + side}px,${dy / 2 + lift}px) scale(1.25)`, opacity: 1, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: .9 }],
        { duration: 850, delay: i * 90, easing: 'cubic-bezier(.4,0,.5,1)', fill: 'both' }).onfinish = () => { c.remove(); if (++done === n) res(); };
    }
  });
}

/* ---- puls prvku ---- */
export function hit(el) { if (calm || !el) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }

/* ---- oslavy: volají se po úspěšném zápisu ---- */
const toCenter = () => ({ x: innerWidth / 2, y: Math.min(innerHeight * .35, 260) });
export function hopElf() {
  if (calm) return;
  document.querySelectorAll('.elfimg').forEach(e => { e.classList.remove('hop'); void e.offsetWidth; e.classList.add('hop'); setTimeout(() => e.classList.remove('hop'), 1000); });
}
// mince z prostředka obrazovky k dlaždici [data-fx], pak puls a konfety na ní
async function coinsTo(fxKey, color, n, confN, cols) {
  const t = document.querySelector(`[data-fx="${fxKey}"]`), p = toCenter();
  if (!t) { confetti(p.x, p.y, cols, confN); return; }
  t.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  await fly(p, t, color, n);
  hit(t); const m = mid(t); confetti(m.x, m.y, cols, confN);
}
export function celebrateInvoice(color = '#f5b84a') { buzz(20); hopElf(); coinsTo('way', color, 5, 40, [color, '#5eead4', '#ffffff']); }
export function celebratePaid() { buzz([20, 40, 30]); hopElf(); coinsTo('paid', '#4ade9b', 8, 80, ['#f5b84a', '#4ade9b', '#6ea8ff', '#ffffff']); }
