// Živé pozadí: hvězdy a občasná kometa (tmavé téma), jemné plující barevné skvrny (světlé). Jen kosmetika pod obsahem.
import { isCalm } from './fx.js?v=8.24';
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let cv, cx, W = 0, H = 0, stars = [], blobs = [], shoot = null, px = 0, py = 0, started = false;
const dark = () => document.documentElement.dataset.theme !== 'light';
function size() {
  const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
  stars = Array.from({ length: Math.round(W * H / 6500) }, () => ({ x: Math.random() * W, y: Math.random() * H * 1.6, r: Math.random() * 1.4 + .3, z: Math.random() * .8 + .2, p: Math.random() * 6.28 }));
  blobs = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 120 + Math.random() * 160, a: Math.random() * 6.28, c: ['--mint', '--vio', '--gold', '--blue', '--green'][i] }));
}
function frame(t) {
  if (!cv.isConnected) return;
  cx.clearRect(0, 0, W, H); const sc = scrollY;
  if (dark()) {
    for (const s of stars) { const y = ((s.y - sc * s.z * .25) % (H * 1.6) + H * 1.6) % (H * 1.6) - H * .3, x = s.x - px * 24 * s.z; cx.globalAlpha = .3 + .6 * Math.abs(Math.sin(t / 1000 * s.z + s.p)); cx.fillStyle = '#f1eefe'; cx.beginPath(); cx.arc(x, y, s.r, 0, 6.28); cx.fill(); }
    cx.globalAlpha = 1;
    if (!shoot && !isCalm() && Math.random() < .0025) shoot = { x: Math.random() * W * .7, y: Math.random() * H * .4, l: 0 };
    if (shoot) { shoot.l += .035; const a = Math.sin(shoot.l * 3.14); cx.strokeStyle = 'rgba(241,238,254,' + a + ')'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(shoot.x + shoot.l * 260, shoot.y + shoot.l * 110); cx.lineTo(shoot.x + shoot.l * 260 - 60, shoot.y + shoot.l * 110 - 25); cx.stroke(); if (shoot.l >= 1) shoot = null; }
  } else {
    for (const b of blobs) { if (!isCalm()) b.a += .0015; const x = b.x + Math.cos(b.a) * 60 - px * 20, y = b.y + Math.sin(b.a * 1.3) * 50 - sc * .06; const g = cx.createRadialGradient(x, y, 0, x, y, b.r); g.addColorStop(0, css(b.c) + '22'); g.addColorStop(1, 'transparent'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
  }
  if (isCalm()) setTimeout(() => requestAnimationFrame(frame), 1500); else requestAnimationFrame(frame);
}
export function startSky() {
  if (started) return; started = true;
  cv = document.createElement('canvas'); cv.id = 'sky'; cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  document.body.prepend(cv); cx = cv.getContext('2d'); size(); addEventListener('resize', size);
  addEventListener('pointermove', e => { px = e.clientX / W - .5; py = e.clientY / H - .5; }, { passive: true });
  requestAnimationFrame(frame);
}
