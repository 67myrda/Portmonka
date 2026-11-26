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
export function autoRoll(root, scope) {
  root.querySelectorAll('.big,.ubig .disp,.metric .v,.big2').forEach((el, i) => {
    if (el.dataset.roll || el.children.length) return; const m = /^([\d\s\u00a0]+)\s*Kč$/.exec(el.textContent.trim()); if (!m) return;
    el.dataset.roll = scope + '|' + (el.className || 'x') + '|' + i; el.dataset.v = String(parseInt(m[1].replace(/[\s\u00a0]/g, ''), 10));
  });
}
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
export function celebrateInvoice(color = '#f5b84a') { ding([880, 1320]); buzz(20); hopElf(); coinsTo('way', color, 5, 40, [color, '#5eead4', '#ffffff']); }
export function celebratePaid() { ding([784, 1175, 1568]); buzz([20, 40, 30]); hopElf(); coinsTo('paid', '#4ade9b', 8, 80, ['#f5b84a', '#4ade9b', '#6ea8ff', '#ffffff']); }

/* ---- zvuk (vypnutý, dokud ho nezapneš; localStorage pm.sound) ---- */
let sound = false; try { sound = localStorage.getItem('pm.sound') === '1'; } catch (_) {}
export const isSound = () => sound;
export function setSound(v) { sound = !!v; try { localStorage.setItem('pm.sound', sound ? '1' : '0'); } catch (_) {} if (sound) ding([880, 1320]); }
let ac;
export function ding(notes = [880, 1320]) {
  if (!sound || calm) return;
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); notes.forEach((fr, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = fr; const t = ac.currentTime + i * .09; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .55); }); } catch (_) {}
}

/* ---- skřítek průvodce: doběhne k číslům a řekne, co jsou ---- */
let guiding = false, gi = 0;
const docPos = el => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
const sleep = ms => new Promise(r => setTimeout(r, calm ? Math.min(ms, 60) : ms));
export async function guide(steps, from) {
  if (guiding) return; const live = steps.filter(s => document.querySelector(s.sel)); if (!live.length) return; guiding = true;
  const [s0] = [live[gi++ % live.length]], t = document.querySelector(s0.sel);
  const rv = document.createElement('div'); rv.style.cssText = 'position:absolute;left:0;top:0;width:88px;height:88px;z-index:95;pointer-events:none;transition:transform 1.1s cubic-bezier(.6,0,.3,1),opacity .3s;opacity:0';
  const im = document.createElement('img'); im.src = 'img/elf/klid.webp?v=8.22'; im.alt = ''; im.style.cssText = 'width:100%;height:100%;display:block;transform-origin:50% 92%;filter:drop-shadow(0 8px 10px rgba(0,0,0,.25))';
  rv.appendChild(im); const tag = document.createElement('div'); tag.style.cssText = 'position:absolute;z-index:96;max-width:230px;background:var(--fg);color:var(--bg);padding:8px 12px;border-radius:14px;font:700 14px system-ui;opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s;pointer-events:none';
  document.body.append(rv, tag);
  const h = from ? docPos(from) : { x: scrollX + 20, y: scrollY + innerHeight - 140 };
  rv.style.transition = 'none'; rv.style.transform = `translate(${h.x}px,${h.y}px)`; void rv.offsetWidth; rv.style.transition = ''; rv.style.opacity = 1;
  if (!calm) im.animate([{ transform: 'translateY(0) rotate(-6deg)' }, { transform: 'translateY(-9px) rotate(6deg)' }], { duration: 320, iterations: 5, direction: 'alternate' });
  t.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' }); await sleep(650);
  const p = docPos(t), tx = Math.max(8, Math.min(p.x + p.w - 90, scrollX + innerWidth - 100)), ty = p.y - 70;
  rv.style.transform = `translate(${tx}px,${ty}px)`; await sleep(1150);
  im.src = 'img/elf/napad.webp?v=8.22'; tag.textContent = s0.text; tag.style.left = Math.max(8, Math.min(tx - 120, scrollX + innerWidth - 240)) + 'px'; tag.style.top = (ty + 92) + 'px'; tag.style.opacity = 1; tag.style.transform = 'none';
  const card = t.closest('.card,.mission') || t; hit(card); buzz(15); ding([660, 990]);
  await sleep(2600); tag.style.opacity = 0; rv.style.opacity = 0; await sleep(350); rv.remove(); tag.remove(); guiding = false;
}
