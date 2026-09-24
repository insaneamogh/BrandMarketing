'use strict';
// engine.js: a small paint engine for this video, on Canvas 2D.
// Brush lines taper and "boil" (they're redrawn 12 times a second with a little jitter, like hand-drawn animation),
// fills carry pigment grain, backgrounds are layered watercolour, and the finished frame is multiplied with paper.
// Every frame is a pure function of time: frames render in parallel and out of order, so nothing carries over.
const W = 1920, H = 1080, FPS = 24, BOIL = 12, TAU = Math.PI * 2;
const BEAT = 60 / CUES.bpm, DUR = CUES.duration;
const PAL = {
  paper: '#F7EFE4', ink: '#2B2130', cream: '#FFF8EE', white: '#FFFDF8', berry: '#E8618C', heart: '#FF4F7E',
  gold: '#FFD45E', tear: '#A6DDFF', skin: '#F6C7A1', skinDk: '#DD9E78'
};

let T = 0, BOILN = 0, ctx = null, OUT = null, GRAIN = null, PIGC = null;

// ---------- numbers ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const frac = x => x - Math.floor(x);
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeIn = x => Math.pow(clamp(x), 3);
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = (x, s = 1.9) => { x = clamp(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * TAU / 3) + 1; };
// 0 before t0, then a wobble that dies away: settles, jiggles, follow-through
const spring = (t, t0, k = 6, w = 18) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
// 0 → 1 over [a, b], then 1 → 0 over [b, c]
const bump = (t, a, b, c) => t <= a || t >= c ? 0 : t < b ? ease(seg(t, a, b)) : 1 - ease(seg(t, b, c));
const beatPos = t => t / BEAT;
const pulse = (t, k = 6) => Math.exp(-frac(beatPos(t)) * k);   // 1 on each beat, then decays
// keyframes: kf(t, [[t0, v0], [t1, v1], ...], easeFn); values may be numbers or arrays
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
    }
  }
  return keys[keys.length - 1][1];
}
// A hop that takes off at t0 and lands at t1, h units high: a crouch first, a stretch on take-off, round at the top,
// a stretch into the landing and a squash that springs back. Returns { dy, sq } to add into a pose.
function hop(t, t0, t1, h = 1) {
  if (t < t0 - .1) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: .24 * ease(seg(t, t0 - .1, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: h * 4 * k * (1 - k), sq: -.2 * Math.abs(1 - 2 * k) }; }
  const a = t - t1; return { dy: 0, sq: .3 * Math.exp(-7 * a) * Math.cos(18 * a) };
}
// A jelly jiggle kicked at t0, for { wob, wobPh }.
const jiggle = (t, t0, amp = .1) => t < t0 ? { wob: 0, wobPh: 0 } : { wob: amp * Math.exp(-4.5 * (t - t0)), wobPh: (t - t0) * 17 };

// ---------- randomness ----------
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
let R = mulberry32(1);
// seed(key) before each separate element: its jitter then depends only on the key and the boil drawing, so a moving
// thing drawn earlier can't make everything after it re-boil every frame.
const seed = key => { R = mulberry32(strHash(key + '|' + BOILN)); };
const seedFixed = key => { R = mulberry32(strHash('fixed|' + key)); };
const rnd = () => R();
const jit = a => (R() * 2 - 1) * a;
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function gauss() { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * R()); }

// ---------- colour ----------
const RGB = {};
const hexRgb = h => RGB[h] || (RGB[h] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const rgbHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, k) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((v, i) => lerp(v, B[i], clamp(k)))); };
const rgba = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`; };

// ---------- geometry ----------
function ellPts(cx, cy, rx, ry, n = 32, rot = 0) {
  const P = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; P.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return P;
}
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function rrPts(x, y, w, h, r, n = 5) {
  const P = [], corner = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  return P;
}
function starPts(cx, cy, r, inner = .4, n = 4, rot = -Math.PI / 2) {
  const P = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * inner : r; P.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); }
  return P;
}
// A heart about 2r wide: its lobes top out near cy - .75r and its tip sits near cy + 1.06r.
function heartPts(cx, cy, r, n = 64, rot = 0) {
  const P = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, x = 16 * Math.pow(Math.sin(a), 3) / 16 * r, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 * r;
    P.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return P;
}
// Smooth Catmull-Rom curve through the points, n samples per span.
function through(P, n = 6, closed = false) {
  const L = P.length; if (L < 3) return P.slice();
  const out = [], get = i => closed ? P[((i % L) + L) % L] : P[clamp(i, 0, L - 1)], spans = closed ? L : L - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  if (!closed) out.push(P[L - 1]);
  return out;
}
function densify(P, step) {
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return out;
}
// The first k (0..1) of a polyline, by length: for lines that draw themselves on.
function cutPath(P, k) {
  if (k >= 1) return P; if (k <= 0) return [P[0], P[0]];
  let L = 0; const d = [0];
  for (let i = 1; i < P.length; i++) { L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); d.push(L); }
  const target = L * k, out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    if (d[i] < target) out.push(P[i]);
    else { const f = (target - d[i - 1]) / ((d[i] - d[i - 1]) || 1); out.push([lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)]); break; }
  }
  return out;
}
function pathLen(P) { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }
function diag(P) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return Math.hypot(x1 - x0, y1 - y0);
}
function poly(P) { ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); }
// Outline of a stroke of varying width along a dense centre line: wFn(s 0..1) gives the width.
function strokeShape(C, wFn) {
  const n = C.length, L = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = wFn(i / Math.max(1, n - 1)) / 2;
    L.push([C[i][0] - dy * w, C[i][1] + dx * w]); Rt.push([C[i][0] + dy * w, C[i][1] - dx * w]);
  }
  return L.concat(Rt.reverse());
}

// ---------- paint ----------
const PATS = new Map();
function pigment() { let p = PATS.get(ctx); if (!p) { p = ctx.createPattern(PIGC, 'repeat'); PATS.set(ctx, p); } return p; }

// One painted shape: flat gouache colour, pigment grain inside it, and a darker pooled edge, all boiling a little.
function paintShape(pts, col, o = {}) {
  const d = diag(pts), j = o.j ?? d * .004, a = o.a ?? 1;
  let P = j ? pts.map(p => [p[0] + jit(j), p[1] + jit(j)]) : pts;
  if (o.smooth !== false) P = through(P, 3, true);
  ctx.beginPath(); poly(P);
  ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fill();
  const tex = o.tex ?? .3;
  if (tex > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a * tex; ctx.fillStyle = pigment(); ctx.fill(); ctx.restore(); }
  const edge = o.edge ?? .3;
  if (edge > 0) { ctx.globalAlpha = a * edge; ctx.strokeStyle = o.edgeCol || mix(col, PAL.ink, .3); ctx.lineWidth = o.edgeW ?? Math.max(.02, d * .008); ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.globalAlpha = 1;
  return P;
}
// A painted brush line through the points: tapered ends and a little pressure wobble. Width and jitter are in the
// units of whatever space it's drawn in, so it works the same in world pixels and in a scaled face.
function inkLine(pts, w, col = PAL.ink, o = {}) {
  if (pts.length < 2 || w <= 0) return;
  const j = o.j ?? w * .12, P = j ? pts.map(p => [p[0] + jit(j), p[1] + jit(j)]) : pts;
  const C = densify(o.raw ? P : through(P, o.n ?? 6), Math.max(w * .6, 1e-3));
  if (o.cut != null && o.cut < 1) { const cc = cutPath(C, o.cut); if (cc.length < 2) return; C.length = 0; C.push(...cc); }
  const t0 = o.t0 ?? .18, t1 = o.t1 ?? .22, mn = o.min ?? .25, ph = rnd() * 10;
  const out = strokeShape(C, s => w * Math.max(mn, Math.min(1, t0 > 0 ? s / t0 : 1, t1 > 0 ? (1 - s) / t1 : 1)) * (1 + .16 * Math.sin(s * 9 + ph)));
  ctx.globalAlpha = o.a ?? 1; ctx.fillStyle = col;
  ctx.beginPath(); poly(out); ctx.fill();
  ctx.globalAlpha = 1;
}
// A closed brush outline around a shape, thick and thin as it goes round.
function inkLoop(pts, w, col = PAL.ink, o = {}) {
  const j = o.j ?? w * .15, P = j ? pts.map(p => [p[0] + jit(j), p[1] + jit(j)]) : pts;
  const C = o.raw ? P : through(P, o.n ?? 3, true), n = C.length, ph = rnd() * 10, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = C[(i - 1 + n) % n], b = C[(i + 1) % n];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const s = i / n, ww = w * (1 + .3 * Math.sin(s * TAU * 3 + ph) + .14 * Math.sin(s * TAU * 7 + ph * 2)) / 2;
    A.push([C[i][0] - dy * ww, C[i][1] + dx * ww]); B.push([C[i][0] + dy * ww, C[i][1] - dx * ww]);
  }
  ctx.globalAlpha = o.a ?? 1; ctx.fillStyle = col;
  ctx.beginPath(); poly(A); poly(B); ctx.fill('evenodd');
  ctx.globalAlpha = 1;
}
// Light: an additive glow for anything that shines. It adds real light instead of painting pigment.
function glow(x, y, r, col = '#FFD98A', a = 1) {
  if (a <= 0 || r < 1) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, .7 * a)); g.addColorStop(.35, rgba(col, .3 * a)); g.addColorStop(1, rgba(col, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
// Watercolour: many translucent layers of a shape whose edge is deformed at random, so colour pools and bleeds.
// Slow, so it's for cached backgrounds.
function deformPoly(Q, depth, amt) {
  for (let d = 0; d < depth; d++) {
    const out = [];
    for (let i = 0; i < Q.length; i++) {
      const a = Q[i], b = Q[(i + 1) % Q.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), v = (a[2] + b[2]) / 2 * (.6 + R() * .8);
      out.push(a, [(a[0] + b[0]) / 2 + gauss() * amt * len * v * .5, (a[1] + b[1]) / 2 + gauss() * amt * len * v * .5, v]);
    }
    Q = out;
  }
  return Q;
}
function watercolor(pts, col, o = {}) {
  const layers = o.layers ?? 16, alpha = o.alpha ?? .07, amt = o.amt ?? .4;
  const ring = densify([...pts, pts[0]], o.step ?? 80).slice(0, -1).map(p => [p[0], p[1], .4 + R() * .9]);
  const base = deformPoly(ring, 1, amt);
  ctx.save(); ctx.fillStyle = col;
  for (let l = 0; l < layers; l++) { const Q = deformPoly(base, 2, amt * .7); ctx.globalAlpha = alpha; ctx.beginPath(); poly(Q); ctx.fill(); }
  ctx.restore();
}

// ---------- caches ----------
// Painting that doesn't move is painted once per boil drawing (a few variants that cycle) and reused.
const CACHE = {};
function cached(key, w, h, fn) {
  let c = CACHE[key];
  if (!c) {
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const prev = ctx, prevR = R; ctx = c.getContext('2d'); seedFixed(key); fn(); ctx = prev; R = prevR; CACHE[key] = c;
  }
  return c;
}

// ---------- camera ----------
let CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) {
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy); CAM = { cx, cy, zoom, rot };
}
function camEnd() { ctx.restore(); CAM = null; }
function toScreen(x, y) {
  if (!CAM) return [x, y];
  const c = Math.cos(CAM.rot), s = Math.sin(CAM.rot), dx = (x - CAM.cx) * CAM.zoom, dy = (y - CAM.cy) * CAM.zoom;
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };

// ---------- full-frame effects (screen space, after camEnd) ----------
function flash(k, col = '#FFFDF6') { if (k > .01) { ctx.globalAlpha = clamp(k); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } }
function grade(mode, col, a) { if (a <= .001) return; ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha = clamp(a); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.restore(); }
// Paint everything outside a shape (an iris), with an ink ring round the hole.
function irisShape(P, col, ringW = 7) {
  ctx.beginPath(); ctx.rect(-50, -50, W + 100, H + 100); poly(P); ctx.fillStyle = col; ctx.fill('evenodd');
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .3; ctx.fillStyle = pigment(); ctx.fill('evenodd'); ctx.restore();
  if (ringW > 0) inkLoop(P, ringW, PAL.ink, { a: .85 });
}
function iris(cx, cy, r, col) { if (r < 3) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); } else irisShape(ellPts(cx, cy, r, r, 48), col); }
// Fat paint strokes sweep across (p 0 → .5) and then drag off (.5 → 1); cut to the next shot under full cover.
function brushWipe(p, cols) {
  if (p <= 0 || p >= 1) return;
  seed('wipe');
  const n = 6, bh = (H + 360) / n + 70;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.12); ctx.translate(-W / 2, -H / 2);
  for (let i = 0; i < n; i++) {
    const y = -180 + (i + .5) * (H + 360) / n, d = [0, .14, .05, .18, .09, .2][i];
    const q = p < .5 ? easeOut(clamp((p * 2 - d) / (1 - d))) : ease(clamp(((p - .5) * 2 - d) / (1 - d)));
    const x0 = p < .5 ? -320 : lerp(-320, W + 320, q), x1 = p < .5 ? lerp(-320, W + 320, q) : W + 320;
    if (x1 - x0 < 30) continue;
    const C = []; for (let k = 0; k <= 30; k++) C.push([lerp(x0, x1, k / 30), y + Math.sin(k * .5 + i * 2) * 16]);
    const col = cols[i % cols.length];
    const out = strokeShape(C, s => bh * (s < .03 ? .75 + s * 8 : s > .97 ? .75 + (1 - s) * 8 : 1) * (1 + .05 * Math.sin(s * 50 + i)));
    ctx.beginPath(); poly(out); ctx.fillStyle = col; ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .45; ctx.fillStyle = pigment(); ctx.fill(); ctx.restore();
    for (let k = 0; k < 6; k++) {
      const yy = y + (k / 5 - .5) * bh * .78;
      inkLine([[x0 + 60 + hash(i * 9 + k) * 90, yy], [x1 - 60 - hash(i * 7 + k) * 90, yy + jit(8)]], 3 + hash(k + i) * 5, mix(col, '#FFFFFF', .4), { a: .5, j: 2 });
    }
  }
  ctx.restore();
}

// ---------- paper ----------
function lcg(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function makePigment() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), r = lcg(3);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) {
    const x = r() * 512, y = r() * 512, rr = 10 + r() * 55, a = .04 + r() * .1;
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
      gr.addColorStop(0, `rgba(130,100,95,${a})`); gr.addColorStop(1, 'rgba(130,100,95,0)');
      g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, 2 * rr, 2 * rr);
    }
  }
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(95,75,70,${r() * .2})`; g.fillRect(r() * 512, r() * 512, 1 + r() * 1.6, 1 + r() * 1.6); }
  return c;
}
// Paper grain, fibres, soft blotches and a vignette, multiplied over every finished frame.
function makeGrain() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = lcg(7);
  const id = g.createImageData(W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - (r() < .5 ? r() * r() * 36 : 0); d[i] = v; d[i + 1] = v - 2; d[i + 2] = v - 6; d[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, rr = 120 + r() * 380, gr = g.createRadialGradient(x, y, 0, x, y, rr), a = .05 * r();
    gr.addColorStop(0, `rgba(170,130,100,${a})`); gr.addColorStop(1, 'rgba(170,130,100,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
  g.lineWidth = 1;
  for (let i = 0; i < 1500; i++) {
    const x = r() * W, y = r() * H, l = 6 + r() * 26, a = r() * TAU;
    g.strokeStyle = `rgba(110,85,65,${.04 + r() * .06})`; g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const vg = g.createRadialGradient(W / 2, H / 2, H * .42, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(150,105,95,.42)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  return c;
}

// ---------- the frame ----------
const SHOTS = [];
function shots(list) { SHOTS.push(...list); SHOTS.sort((a, b) => a[0] - b[0]); }
function drawFrame(t) {
  T = t; BOILN = Math.floor(t * BOIL + 1e-6);
  ctx = OUT.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, W, H);
  if (SHOTS.length) {
    let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
    const t0 = SHOTS[i][0], end = i + 1 < SHOTS.length ? SHOTS[i + 1][0] : DUR;
    SHOTS[i][1](t, t - t0, end - t0);
  }
  CAM = null; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(GRAIN, 0, 0); ctx.globalCompositeOperation = 'source-over';
}
window.renderAt = (t, type = 'image/jpeg', q = .93) => { drawFrame(t); return OUT.toDataURL(type, q); };
// Contact sheet: several times in a grid, each labelled; crop = [x, y, w, h] fills each cell with that part of the frame.
window.renderSheet = (times, cols = 3, w = 640, crop = null) => {
  const [cx, cy, cw, ch] = crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols);
  const sc = document.createElement('canvas'); sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  times.forEach((t, i) => {
    const t0 = performance.now(); drawFrame(t); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    c.drawImage(OUT, cx, cy, cw, ch, x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x, y, 70, 22); c.fillStyle = '#fff'; c.font = '14px sans-serif'; c.fillText(t.toFixed(2) + 's', x + 6, y + 16);
  });
  return { url: sc.toDataURL('image/jpeg', .88), ms };
};
function boot() {
  OUT = document.getElementById('out'); PIGC = makePigment(); GRAIN = makeGrain();
  window.ready = true;
  if (location.search.includes('render')) return;
  const s = document.getElementById('scrub'), lab = document.getElementById('tt'); s.max = DUR;
  const go = () => { const t0 = performance.now(), t = +s.value; drawFrame(t); lab.textContent = `${t.toFixed(2)} s · ${Math.round(performance.now() - t0)} ms/frame`; };
  s.addEventListener('input', go);
  const q = new URLSearchParams(location.search).get('t'); if (q) s.value = q;
  go();
}
