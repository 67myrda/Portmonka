// Orbit jako soustava planet: každý náklad měsíce je planeta, raketa doletí na tu, která je kryta ze skutečných plateb.
// Čistě vizuální vrstva nad daty z orbit.js. Žádná čísla se tu nepočítají, jen se kreslí.
// Použití: <div class="os" data-orbit='{"planets":[...],"total":..,"pct":..}'></div>; po renderu mountAll(root).
import { isCalm, confetti, buzz } from './fx.js?v=8.21';

const PAL = ['--blue', '--green', '--coral', '--gold', '--vio', '--mint', '--vio2', '--lime'];
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let seenK = null; // kolik planet už raketa v této relaci navštívila (animuje se jen přírůstek)

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kc = minor => Math.round(minor / 100).toLocaleString('cs-CZ').replace(/ /g, ' ') + ' Kč';

export function sceneHtml(o) {
  return `<div class="os" data-orbit='${esc(JSON.stringify(o))}' role="img" aria-label="Orbit: ${o.planets.filter(p => p.state === 'done').length} z ${o.planets.length} planet je pokryto"></div>`;
}

function layout(n) {
  // vlnovka zleva doprava; domovská planeta nahoře uprostřed
  return Array.from({ length: n }, (_, i) => ({ x: n === 1 ? 50 : 20 + 66 * i / (n - 1), y: [70, 48, 74, 46, 72, 50, 76, 48][i % 8] }));
}

export function mountAll(root = document) {
  root.querySelectorAll('.os[data-orbit]').forEach(mount);
}

function mount(el) {
  if (el.dataset.mounted) return; el.dataset.mounted = '1';
  const o = JSON.parse(el.dataset.orbit), P = o.planets, pos = layout(P.length);
  const HOME = { x: 50, y: 17 }, PAD = { x: 8, y: 90 };
  const sizeOf = a => Math.round(26 + Math.min(26, Math.sqrt(a / 100) / 5));
  const covered = P.findIndex(p => p.state !== 'done'); const k = covered < 0 ? P.length : covered;
  el.innerHTML = `<canvas class="osc"></canvas>
    <div class="ospad" style="left:${PAD.x}%;top:${PAD.y}%"></div>
    ${P.map((p, i) => `<div class="ospl ${p.state}" data-i="${i}" style="left:${pos[i].x}%;top:${pos[i].y}%;--c:var(${PAL[i % PAL.length]});--z:${sizeOf(p.amountMinor)}px;--p:${p.pct}"><div class="osb"></div><b>${esc(p.emoji || '')} ${esc(p.name)}</b><span>${kc(p.amountMinor)}</span></div>`).join('')}
    <div class="ospl oshome" style="left:${HOME.x}%;top:${HOME.y}%;--z:64px"><div class="osb"></div><b>Orbit</b><span>polštář a prasátko</span></div>
    <div class="osrk"><svg viewBox="0 0 40 74" aria-hidden="true"><path class="osfl" d="M12 56 Q20 92 28 56 Z" fill="#f5b84a"/><path class="osfl" d="M16 56 Q20 78 24 56 Z" fill="#ff7a6b"/><path d="M20 2 C31 14 32 34 30 58 H10 C8 34 9 14 20 2Z" fill="#f4f2ff" stroke="#2f2958" stroke-width="2"/><path d="M20 2 C25 8 28 14 29 22 H11 C12 14 15 8 20 2Z" fill="#ff7a6b" stroke="#2f2958" stroke-width="2"/><path d="M10 42 L1 60 H10Z M30 42 L39 60 H30Z" fill="#b493ff" stroke="#2f2958" stroke-width="2"/><circle cx="20" cy="34" r="6" fill="#6ea8ff" stroke="#2f2958" stroke-width="2"/></svg></div>`;
  const cv = el.querySelector('canvas'), rk = el.querySelector('.osrk'), pls = [...el.querySelectorAll('.ospl:not(.oshome)')], homeEl = el.querySelector('.oshome');
  let W = 0, H = 0, at = Math.min(seenK ?? 0, k), orbiting = false, trail = [], stars = [], rp = { x: 0, y: 0 };
  const wp = i => i === 0 ? { x: PAD.x * W / 100, y: PAD.y * H / 100 - 34 } : i > P.length ? { x: HOME.x * W / 100, y: HOME.y * H / 100 } : { x: pos[i - 1].x * W / 100, y: pos[i - 1].y * H / 100 - sizeOf(P[i - 1].amountMinor) / 2 - 30 };
  const setRk = (x, y, a, s = 1) => { rp = { x, y, a }; rk.style.transform = `translate(${x}px,${y}px) rotate(${a}rad) scale(${s})`; };
  const fit = () => { const r = el.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.getContext('2d').setTransform(d, 0, 0, d, 0, 0); stars = Array.from({ length: Math.round(W * H / 2600) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + .3, p: Math.random() * 6.28 })); };
  const dark = () => document.documentElement.dataset.theme !== 'light';
  function draw() {
    const x = cv.getContext('2d'); x.clearRect(0, 0, W, H); const t = performance.now() / 900;
    for (const s of stars) { x.globalAlpha = (dark() ? .25 : .12) + (dark() ? .7 : .25) * Math.abs(Math.sin(t + s.p)); x.fillStyle = dark() ? '#f1eefe' : css('--vio'); x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.28); x.fill(); }
    x.globalAlpha = 1; x.lineWidth = 2.5; x.lineCap = 'round';
    for (let i = 0; i <= P.length; i++) {
      const A = wp(i), B = wp(i + 1), done = i < at || (i === P.length && orbiting);
      x.setLineDash(done ? [] : [3, 9]); x.strokeStyle = done ? css('--mint') : css('--mu'); x.globalAlpha = done ? .9 : .45;
      const bend = i === P.length ? -60 : (i % 2 ? -40 : 40), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
      x.beginPath(); x.moveTo(A.x, A.y); x.quadraticCurveTo(mx - dy / L * bend, my + dx / L * bend, B.x, B.y); x.stroke();
    }
    x.setLineDash([]); x.globalAlpha = 1;
    if (orbiting) { const h = wp(P.length + 1); x.strokeStyle = css('--mint'); x.globalAlpha = .35; x.setLineDash([4, 7]); x.beginPath(); x.ellipse(h.x, h.y, 80, 26, 0, 0, 6.28); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; }
    trail = trail.filter(p => p.l > 0); for (const p of trail) { p.l -= .03; x.globalAlpha = Math.max(0, p.l) * .8; x.fillStyle = p.l > .6 ? css('--gold') : css('--coral'); x.beginPath(); x.arc(p.x, p.y, Math.max(.1, p.r * p.l), 0, 6.28); x.fill(); } x.globalAlpha = 1;
  }
  function flySeg(A, B, bend, ms) {
    return new Promise(res => {
      if (isCalm()) { setRk(B.x, B.y, 0); return res(); }
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, cx = mx - dy / L * bend, cy = my + dx / L * bend, t0 = performance.now();
      rk.classList.add('burn');
      (function f(t) {
        if (!el.isConnected) return res();
        const p = Math.min(1, (t - t0) / ms), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, u = 1 - e;
        const x = u * u * A.x + 2 * u * e * cx + e * e * B.x, y = u * u * A.y + 2 * u * e * cy + e * e * B.y, vx = 2 * u * (cx - A.x) + 2 * e * (B.x - cx), vy = 2 * u * (cy - A.y) + 2 * e * (B.y - cy);
        setRk(x, y, Math.atan2(vy, vx) + Math.PI / 2); trail.push({ x, y: y + 18, l: 1, r: 3 + Math.random() * 3 });
        if (p < 1) requestAnimationFrame(f); else { rk.classList.remove('burn'); setRk(B.x, B.y, 0); res(); }
      })(t0);
    });
  }
  const wait = ms => new Promise(r => setTimeout(r, isCalm() ? 30 : ms));
  function orbitLoop() { if (!orbiting || !el.isConnected || isCalm()) return; const h = wp(P.length + 1), t = performance.now() / 1000 * 1.5, x = h.x + Math.cos(t) * 80, y = h.y + Math.sin(t) * 26, back = Math.sin(t) < 0; setRk(x, y, Math.atan2(Math.cos(t) * 26, -Math.sin(t) * 80) + Math.PI / 2, back ? .5 : .68); homeEl.classList.toggle('back', back); trail.push({ x, y, l: .8, r: 2.5 }); requestAnimationFrame(orbitLoop); }
  function loop() { if (!el.isConnected) return; draw(); if (isCalm()) setTimeout(loop, 600); else requestAnimationFrame(loop); }
  async function go() {
    pls.forEach((e, i) => { if (i < at) e.classList.add('on'); });
    let cur = wp(at); setRk(cur.x, cur.y, 0);
    while (at < k && el.isConnected) {
      await flySeg({ x: rp.x, y: rp.y }, wp(at + 1), at % 2 ? -40 : 40, 820); at++;
      const e = pls[at - 1]; e.classList.add('on', 'boom'); setTimeout(() => e.classList.remove('boom'), 950); buzz(20);
      const r = e.querySelector('.osb').getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, [css(PAL[(at - 1) % PAL.length]), '#ffffff'], 18); await wait(220);
    }
    seenK = k;
    if (k === P.length && P.length && el.isConnected) { await flySeg({ x: rp.x, y: rp.y }, { x: wp(P.length + 1).x + 80, y: wp(P.length + 1).y }, -60, 1000); orbiting = true; rk.classList.add('burn'); orbitLoop(); }
  }
  fit(); new ResizeObserver(() => { const w = W; fit(); if (w) { const c = wp(at); if (!orbiting) setRk(c.x, c.y, 0); } }).observe(el);
  loop();
  // spustit až když je scéna vidět, ať animace nepropadne mimo obrazovku
  const start = () => go();
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { threshold: .3 }); io.observe(el); } else start();
}
