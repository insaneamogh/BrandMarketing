'use strict';
// squishy.js: the two dumpling squishies (Bao and Mochi): their jelly bodies with glitter inside, faces and moods.
// Also the kid's hands and the scribble cloud of big feelings.
const SQ = {
  bao:   { body: '#FF9EC2', lt: '#FFDCEA', dk: '#E2648F', line: '#B9446F', ph: .13 },
  mochi: { body: '#8FD3F7', lt: '#DDF5FF', dk: '#4F9FD6', line: '#2E76AE', ph: .61 },
};
const GLITTER = ['#FFFFFF', '#FFF0A0', '#BDF3FF', '#FFC4EA', '#D8C6FF', '#FFE6F1', '#FFFFFF'];

// ---------- the body, in body units ----------
// 10 wide and 7 tall, ground at y = 0 and up negative: a round dome with a little pleated nub, on a flat soft base.
const N1 = 2.3, N2 = 3.4, MID = -2.6, TOP = -7.0;
function bodyUnit(a) {
  const c = Math.cos(a), s = Math.sin(a);
  if (s <= 0) {
    const e = 2 / N1; let y = MID - 4.4 * Math.pow(-s, e);
    y -= .42 * Math.exp(-Math.pow((a - 1.5 * Math.PI) / .15, 2));
    return [5 * Math.sign(c) * Math.pow(Math.abs(c), e), y];
  }
  const e = 2 / N2; return [5 * Math.sign(c) * Math.pow(Math.abs(c), e), MID + 2.6 * Math.pow(s, e)];
}
const BODY = Array.from({ length: 84 }, (_, i) => bodyUnit(i / 84 * TAU));
function insideUnit(x, y, k = 1) {
  const X = Math.abs(x) / (5 * k);
  if (y < MID) { const Y = (MID - y) / (4.4 * k); return Math.pow(X, N1) + Math.pow(Y, N1) <= 1; }
  const Y = (y - MID) / (2.6 * k); return Math.pow(X, N2) + Math.pow(Y, N2) <= 1;
}
function makeFlakes(who, n) {
  seedFixed('flakes' + who); const F = [];
  for (let guard = 0; F.length < n && guard < 5000; guard++) {
    const x = (R() * 2 - 1) * 4.6, y = MID + (R() * 2 - 1) * 4;
    if (y > -.5 || !insideUnit(x, y, .84)) continue;
    F.push({ x, y, s: .1 + R() * .17, type: R() < .5 ? 0 : R() < .55 ? 1 : 2, col: GLITTER[Math.floor(R() * GLITTER.length)], ph: R() * TAU, sp: 2 + R() * 5, rot: R() * TAU, h: R() });
  }
  return F;
}
const FLAKES = { bao: makeFlakes('bao', 64), mochi: makeFlakes('mochi', 64) };
// Where each one tears when it pops: across the top of the dome, clear of the eyes.
const RIP = {
  bao:   [[-3.9, -4.9], [-3.3, -5.55], [-2.8, -5.0], [-2.2, -5.95], [-1.6, -5.4], [-1.0, -6.3]],
  mochi: [[1.0, -6.3], [1.6, -5.5], [2.2, -6.0], [2.8, -5.2], [3.3, -5.65], [3.9, -4.9]],
};

// The pose, as a map from body units to local pixels. o: sq (squash, negative stretches), hx (pressed from both
// sides), deflate (0..1, a flat puddle), lean (the top leans sideways), wob/wobPh (jelly jiggle).
function warpOf(o, u) {
  const sy0 = 1 - (o.sq || 0), sx0 = 1 / Math.sqrt(Math.max(.3, sy0));
  const hx = o.hx || 0, d = o.deflate || 0;
  const sx = sx0 * (1 - .4 * hx) * lerp(1, 1.32, d), sy = sy0 * (1 + .55 * hx) * lerp(1, .27, d);
  const lean = o.lean || 0, wa = o.wob || 0, wp = o.wobPh || 0, ph = SQ[o.who].ph * 10, lim = 5 - 1.2 * hx;
  const f = (x, y) => {
    const dy = y - MID, r = Math.hypot(x, dy), th = Math.atan2(dy, x), rr = Math.min(1, r / 4.6);
    const k = 1 + wa * Math.sin(2 * th + wp) * rr + d * (.1 * Math.sin(3 * th + ph) + .05 * Math.sin(5 * th + 2 * ph)) * rr;
    let X = x * k; const Y = Math.min(0, MID + dy * k);
    if (hx) X = clamp(X, -lim, lim);
    X += lean * -Y * .32;
    return [X * sx * u, Y * sy * u];
  };
  f.sx = sx; f.sy = sy; f.hw = lim * sx * u;
  return f;
}
// Half-width of a squishy in pixels for a given squeeze and deflation (ignoring the mood's squash): for placing hands.
const halfWidth = (hx, d, u) => (5 - 1.2 * hx) * (1 - .4 * hx) * lerp(1, 1.32, d) * u;

// ---------- drawing a squishy ----------
// (x, y): the ground point under its middle; u: the size unit. Returns where things are, for props and effects.
function squishy(x, y, u, o) {
  const who = o.who, C = SQ[who], f = warpOf(o, u);
  const lift = (o.dy || 0) * u, px = x + (o.dx || 0) * u, py = y - lift, pivot = MID * f.sy * u;
  const rot = o.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
  const toWorld = (ux, uy) => { const [lx, ly] = f(ux, uy), dy = ly - pivot; return [px + lx * cr - dy * sr, py + pivot + lx * sr + dy * cr]; };
  // contact shadow on the desk, shrinking as it rises
  const shK = clamp(1 - lift / (9 * u));
  ctx.fillStyle = rgba('#7A4A3C', .16 * shK);
  ctx.beginPath(); ctx.ellipse(px, y + .1 * u, f.hw * (1.05 - .3 * (1 - shK)), .7 * u * (1 - .4 * (1 - shK)), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba('#7A4A3C', .14 * shK);
  ctx.beginPath(); ctx.ellipse(px, y + .05 * u, f.hw * .85, .38 * u, 0, 0, TAU); ctx.fill();

  ctx.save(); ctx.translate(px, py);
  if (rot) { ctx.translate(0, pivot); ctx.rotate(rot); ctx.translate(0, -pivot); }
  seed(who + 'body');
  const P = paintShape(BODY.map(p => f(p[0], p[1])), C.body, { a: .95, tex: .22, edge: 0, j: u * .025 });
  ctx.save(); ctx.beginPath(); poly(P); ctx.clip();
  // jelly light: a bright core up and to the left, deeper colour toward the base, a darker inner rim
  let [lx, ly] = f(-1.4, -4.6), g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 5.4 * u);
  g.addColorStop(0, rgba(C.lt, .9)); g.addColorStop(.5, rgba(C.lt, .28)); g.addColorStop(1, rgba(C.lt, 0));
  ctx.fillStyle = g; ctx.fillRect(-10 * u, -12 * u, 20 * u, 14 * u);
  [lx, ly] = f(1, .6); g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 6.5 * u);
  g.addColorStop(0, rgba(C.dk, .55)); g.addColorStop(.6, rgba(C.dk, .14)); g.addColorStop(1, rgba(C.dk, 0));
  ctx.fillStyle = g; ctx.fillRect(-10 * u, -12 * u, 20 * u, 14 * u);
  ctx.beginPath(); poly(P); ctx.strokeStyle = rgba(C.dk, .42); ctx.lineWidth = u; ctx.stroke();
  drawGlitter(who, f, u, o);
  if ((o.deflate || 0) < .95) drawPleats(who, f, u, C, 1 - (o.deflate || 0));
  seed(who + 'gloss');
  paintShape(ellPts(-2.55, -5.3, 1.25, .42, 16, -.62).map(p => f(p[0], p[1])), PAL.white, { a: .72, tex: 0, edge: 0 });
  paintShape(ellPts(-3.6, -4.15, .26, .21, 10).map(p => f(p[0], p[1])), PAL.white, { a: .8, tex: 0, edge: 0 });
  inkLine([f(3.7, -4.7), f(4.3, -3.6), f(4.45, -2.5)], .2 * u, PAL.white, { a: .45 });
  ctx.restore();
  seed(who + 'line');
  inkLoop(P, .15 * u, mix(C.line, PAL.ink, .25), { a: .92, j: u * .015 });
  if (o.rip || o.patch || o.bandaid) drawRip(who, f, u, o, C);
  const fc = drawFace(o, f, u, C);
  if (o.emote) { const [hx, hy] = f(0, TOP); emote(o.emote, hx, hy, u, o.emoteK ?? 1, o.emoteAge ?? 0, who === 'bao' ? -1 : 1); }
  ctx.restore();
  return { x: px, y: py, hw: f.hw, f, toWorld, top: toWorld(0, TOP + .1), mouth: toWorld(0, -2.35), face: fc };
}

function drawGlitter(who, f, u, o) {
  const F = FLAKES[who], vis = o.glitter, sc = Math.sqrt(f.sx * f.sy);
  for (let i = 0; i < F.length; i++) {
    const fl = F[i], va = vis ? vis(i) : 1; if (va <= 0) continue;
    const [x, y] = f(fl.x, fl.y), tw = .5 + .5 * Math.sin(T * fl.sp + fl.ph);
    flake(x, y, fl.s * u * (.85 + .3 * tw) * Math.max(.7, sc), fl, va * (.5 + .5 * tw), tw);
  }
}
// One glitter flake: a dot, a hexagon or a little star, with a glint when it catches the light.
function flake(x, y, s, fl, a, tw = .5) {
  ctx.globalAlpha = clamp(a); ctx.fillStyle = fl.col; ctx.beginPath();
  if (fl.type === 0) ctx.arc(x, y, s * .6, 0, TAU);
  else if (fl.type === 1) { for (let k = 0; k < 6; k++) { const an = fl.rot + T * .5 + k * TAU / 6, px = x + Math.cos(an) * s * .75, py = y + Math.sin(an) * s * .75; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }
  else poly(starPts(x, y, s * .9, .42, 4, fl.rot));
  ctx.fill();
  if (tw > .86 && fl.h > .45) {
    const g = s * 2.4 * (tw - .86) / .14;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1, s * .2); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - g, y); ctx.lineTo(x + g, y); ctx.moveTo(x, y - g); ctx.lineTo(x, y + g); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawPleats(who, f, u, C, a) {
  const top = [0, TOP - .15];
  for (let k = 0; k < 7; k++) {
    const q = k / 6 * 2 - 1, e = bodyUnit(1.5 * Math.PI + q * .95), end = [e[0] * .8, MID + (e[1] - MID) * .8];
    const mid = [lerp(top[0], end[0], .5) + q * .45, lerp(top[1], end[1], .45) - .25];
    seed(who + 'pleat' + k);
    inkLine([top, mid, end].map(p => f(p[0] + .2, p[1] + .08)), .16 * u, C.dk, { a: .6 * a, t0: .05, t1: .6 });
    inkLine([top, mid, end].map(p => f(p[0], p[1])), .34 * u, C.lt, { a: .9 * a, t0: .05, t1: .55 });
  }
  // the little twist where the pleats meet
  seed(who + 'knot');
  paintShape(ellPts(0, TOP + .05, .62, .3, 14).map(p => f(p[0], p[1])), C.lt, { a: .95 * a, tex: 0, edge: 0 });
  inkLine([[-.4, TOP + .1], [0, TOP - .12], [.35, TOP + .02], [.05, TOP + .2]].map(p => f(p[0], p[1])), .1 * u, C.dk, { a: .75 * a, n: 3 });
}
// The tear, and what mends it: Bao gets a heart patch with white stitching, Mochi a band-aid.
function drawRip(who, f, u, o, C) {
  const P = RIP[who].map(p => f(p[0], p[1])), open = clamp(o.ripOpen ?? 1);
  seed(who + 'rip');
  if (o.rip > 0 && open > .02) {
    const cut = cutPath(densify(P, u * .2), clamp(o.rip));
    if (cut.length > 2) {
      const out = strokeShape(cut, s => u * .5 * open * (.3 + .7 * Math.sin(Math.PI * clamp(s))));
      ctx.beginPath(); poly(out); ctx.fillStyle = mix(C.dk, PAL.ink, .55); ctx.fill();
      inkLine(cut, .1 * u, PAL.ink, { a: .9, t0: .05, t1: .05 });
    }
  }
  if (o.patch > 0) {
    const [px, py] = f(-2.45, -5.55), r = 1.08 * u * backOut(clamp(o.patch)), Hp = heartPts(px, py + .1 * u, r, 44, -.3);
    paintShape(Hp, '#FFDC80', { tex: .3, edge: .3 });
    const In = heartPts(px, py + .1 * u, r * .72, 44, -.3);
    for (let i = 0; i < 44; i += 3) inkLine([In[i], In[(i + 1) % 44]], .08 * u, PAL.white, { a: .95, t0: 0, t1: 0, min: 1 });
    inkLoop(Hp, .12 * u, PAL.ink, { a: .9 });
  }
  if (o.bandaid > 0) {
    const [bx, by] = f(2.45, -5.6), k = backOut(clamp(o.bandaid)), L = 3.1 * u * k, Wd = 1.05 * u * k;
    if (L > 1) {
      ctx.save(); ctx.translate(bx, by); ctx.rotate(.6);
      const band = rrPts(-L / 2, -Wd / 2, L, Wd, Wd / 2);
      paintShape(band, '#FFE2C8', { tex: .25, edge: .3 });
      paintShape(rrPts(-L * .17, -Wd * .34, L * .34, Wd * .68, Wd * .14), '#F5BE98', { tex: .35, edge: 0 });
      for (const sx of [-1, 1]) for (const [dx, dy] of [[.3, -.18], [.36, .16], [.42, -.02]]) paintShape(ellPts(sx * L * dx, dy * Wd, .05 * u, .05 * u, 8), '#E3A57E', { tex: 0, edge: 0 });
      inkLoop(band, .11 * u, PAL.ink, { a: .9 });
      ctx.restore();
    }
  }
}

// ---------- faces ----------
// Drawn in face units (the eyes sit at x = ±2.2), squashed with the body but never flatter than half its width, so a
// flattened squishy still has a readable face.
function drawFace(o, f, u, C) {
  const fc = o.face; if (!fc) return null;
  const ey = -3.3, [cx, cy] = f(0, ey);
  const jx = f(.5, ey)[0] - f(-.5, ey)[0], jy = Math.max(f(0, ey + .5)[1] - f(0, ey - .5)[1], jx * .55);
  const yG = -cy / jy;   // the ground, in face units
  seed(o.who + 'face');
  ctx.save(); ctx.translate(cx, cy); ctx.scale(jx, jy);
  const lx = (fc.lookX || 0) * .22, ly = (fc.lookY || 0) * .17;
  if ((fc.blush || 0) > .02) for (const side of [-1, 1]) {
    const bx = side * 3.15 + lx * .5, by = .72;
    paintShape(ellPts(bx, by, .55, .27, 14), '#FF7FA6', { a: .32 * fc.blush, tex: 0, edge: 0 });
    for (const k of [-1, 0, 1]) inkLine([[bx + k * .27 - .07, by + .12], [bx + k * .27 + .07, by - .12]], .09, '#FF5C8A', { a: .9 * fc.blush, t0: .2, t1: .2 });
  }
  for (const side of [-1, 1]) {
    const e = Array.isArray(fc.eyes) ? fc.eyes[side < 0 ? 0 : 1] : fc.eyes;
    drawEye(e, side * 2.2 + lx, ly, side, fc);
  }
  drawMouth(fc.mouth, lx * .8, .95 + ly * .7, fc);
  if ((fc.tears || 0) > .02) for (const side of [-1, 1]) {
    const sx = side * 2.35 + lx, len = Math.max(.5, yG - .55), a = fc.tears;
    const Pt = [[sx, .5], [sx + side * .25, .5 + len * .5], [sx + side * .5, yG - .05]];
    inkLine(Pt, .34 * a, PAL.tear, { a: .85, t0: .12, t1: .05, min: .6 });
    inkLine(Pt.map(p => [p[0] - .07, p[1]]), .07 * a, PAL.white, { a: .8, t0: .3, t1: .3 });
    paintShape(ellPts(sx + side * .6, yG - .02, .75 * a + .1, .13, 14), PAL.tear, { a: .55 * a, tex: 0, edge: 0 });
  }
  ctx.restore();
  return { cx, cy, jx, jy };
}
function eyeBall(ex, ey, big, fc) {
  const sq = clamp(fc.squint || 0), rx = .58 * big, ry = .74 * big * (1 - .92 * sq);
  if (ry < .12) { inkLine([[ex - rx, ey], [ex, ey + .12], [ex + rx, ey]], .17); return 0; }
  paintShape(ellPts(ex, ey, rx, ry, 20), PAL.ink, { tex: 0, edge: 0 });
  paintShape(ellPts(ex + .18 * big, ey - .3 * big * (1 - sq), .2 * big, .2 * big * (1 - .8 * sq), 12), PAL.white, { tex: 0, edge: 0 });
  paintShape(ellPts(ex - .2 * big, ey + .3 * big * (1 - sq), .085 * big, .085 * big, 8), PAL.white, { tex: 0, edge: 0, a: .9 });
  return ry;
}
function drawEye(type, ex, ey, side, fc) {
  switch (type) {
    case 'normal': eyeBall(ex, ey, 1, fc); break;
    case 'wide': eyeBall(ex, ey, 1.2, fc); break;
    case 'sad': {
      eyeBall(ex, ey + .05, 1, fc);
      inkLine([[ex + side * .62, ey - .98], [ex - side * .5, ey - 1.3]], .15, PAL.ink, { t0: .3, t1: .3 });
      break;
    }
    case 'teary': {
      const ry = eyeBall(ex, ey, 1.12, fc);
      if (ry) {
        ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, .65, ry, 0, 0, TAU); ctx.clip();
        paintShape(ellPts(ex, ey + ry * .62, .8, ry * .5, 16), PAL.tear, { a: .9, tex: 0, edge: 0 });
        ctx.restore();
        const w = Math.sin(T * 22 + side) * .025;
        paintShape(ellPts(ex - .2 + w, ey - .05, .14, .1, 10), PAL.white, { tex: 0, edge: 0, a: .9 });
        paintShape([[ex + side * .55, ey + .45], [ex + side * .72, ey + .72], [ex + side * .6, ey + .86], [ex + side * .45, ey + .72]], PAL.tear, { tex: 0, edge: 0 });
      }
      inkLine([[ex + side * .62, ey - 1.02], [ex - side * .5, ey - 1.3]], .15, PAL.ink, { t0: .3, t1: .3 });
      break;
    }
    case 'happy': inkLine([[ex - .56, ey + .2], [ex, ey - .34], [ex + .56, ey + .2]], .25, PAL.ink, { n: 4 }); break;
    case 'closed': inkLine([[ex - .55, ey - .04], [ex, ey + .22], [ex + .55, ey - .04]], .2); break;
    case 'squeeze': inkLine([[ex + side * .5, ey - .46], [ex - side * .42, ey], [ex + side * .5, ey + .46]], .25, PAL.ink, { n: 2 }); break;
    case 'dizzy': {
      const P = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * TAU * 1.9 + T * 7 * side, r = .06 + .52 * k / 48; P.push([ex + Math.cos(a) * r, ey + Math.sin(a) * r * 1.1]); }
      inkLine(P, .13, PAL.ink, { n: 2, t0: .05, t1: .1 }); break;
    }
    case 'star': {
      const S = starPts(ex, ey, .8 * (1 + .07 * Math.sin(T * 14 + side)), .45, 5, -Math.PI / 2 + .1 * side);
      paintShape(S, PAL.gold, { tex: 0, edge: 0, smooth: false }); inkLoop(S, .09, PAL.ink, { raw: true });
      paintShape(ellPts(ex - .14, ey - .16, .12, .09, 8), PAL.white, { tex: 0, edge: 0 });
      break;
    }
    case 'heart': {
      const Hh = heartPts(ex, ey - .08, .64 * (1 + .12 * pulse(T, 5)), 40);
      paintShape(Hh, PAL.heart, { tex: 0, edge: 0 }); inkLoop(Hh, .09, PAL.ink);
      paintShape(ellPts(ex - .24, ey - .3, .13, .09, 8, -.5), PAL.white, { tex: 0, edge: 0 });
      break;
    }
    default: eyeBall(ex, ey, 1, fc);
  }
}
function drawMouth(type, mx, my, fc) {
  const dark = '#3B1F2E';
  switch (type) {
    case 'smile': inkLine([[mx - .38, my - .08], [mx, my + .22], [mx + .38, my - .08]], .17); break;
    case 'w': inkLine([[mx - .5, my - .06], [mx - .25, my + .18], [mx, my - .02], [mx + .25, my + .18], [mx + .5, my - .06]], .15, PAL.ink, { n: 3 }); break;
    case 'grin': case 'wail': {
      const wide = type === 'grin' ? .55 : .42, deep = type === 'grin' ? .55 : .75, P = [[mx - wide, my - .12]];
      for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI; P.push([mx - Math.cos(a) * wide, my - .12 + Math.sin(a) * deep]); }
      if (type === 'wail') P[0] = [mx - wide, my - .05];
      paintShape(P, dark, { tex: 0, edge: 0 });
      ctx.save(); ctx.beginPath(); poly(P); ctx.clip();
      paintShape(ellPts(mx, my - .12 + deep * .9, wide * .6, deep * .38, 14), '#FF7A9A', { tex: 0, edge: 0 });
      ctx.restore();
      inkLoop(P, .1, PAL.ink); break;
    }
    case 'o': paintShape(ellPts(mx, my + .06, .2, .25, 12), dark, { tex: 0, edge: 0 }); inkLoop(ellPts(mx, my + .06, .2, .25, 12), .09, PAL.ink); break;
    case 'frown': inkLine([[mx - .38, my + .18], [mx, my - .1], [mx + .38, my + .18]], .17); break;
    case 'wobble': { const w = Math.sin(T * 30) * .03; inkLine([[mx - .5, my + .06 + w], [mx - .25, my - .08], [mx, my + .06 - w], [mx + .25, my - .08], [mx + .5, my + .06 + w]], .14, PAL.ink, { n: 3 }); break; }
    case 'kiss': inkLine([[mx - .05, my - .3], [mx + .24, my - .15], [mx + .02, my], [mx + .24, my + .15], [mx - .05, my + .3]], .15, PAL.ink, { n: 3 }); break;
    case 'flat': inkLine([[mx - .35, my + .02], [mx + .35, my]], .15); break;
  }
}

// ---------- emotes: painted marks by the head ----------
function dropPts(x, y, r) { const P = []; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; P.push([x + .78 * r * Math.sin(a) * Math.pow(Math.abs(Math.sin(a / 2)), 1.1), y - r * Math.cos(a)]); } return P; }
function drop(x, y, r, col = PAL.tear) { const P = dropPts(x, y, r); paintShape(P, col, { tex: 0, edge: 0 }); inkLoop(P, Math.max(1.5, r * .12), PAL.ink, { a: .85 }); paintShape(ellPts(x - r * .25, y + r * .15, r * .14, r * .22, 8), PAL.white, { tex: 0, edge: 0 }); }
function cloudPts(cx, cy, w, h) { const P = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, s = Math.sin(a), r = 1 + .16 * Math.abs(Math.sin(a * 2.5)) * (s < 0 ? 1 : .2); P.push([cx + Math.cos(a) * w * r, cy + s * h * r * (s > 0 ? .7 : 1)]); } return P; }
function note(x, y, s, a) {
  ctx.save(); ctx.globalAlpha = a;
  paintShape(ellPts(x, y, .34 * s, .25 * s, 12, -.4), PAL.ink, { tex: 0, edge: 0 });
  inkLine([[x + .3 * s, y - .05 * s], [x + .3 * s, y - 1.15 * s]], .1 * s, PAL.ink, { t0: 0, t1: 0, min: 1 });
  inkLine([[x + .3 * s, y - 1.15 * s], [x + .7 * s, y - .85 * s], [x + .62 * s, y - .5 * s]], .1 * s, PAL.ink, { t0: 0, t1: .4 });
  ctx.restore();
}
function sparkle(x, y, r, k = .5, col = '#FFF6C8') {
  if (k <= 0 || k >= 1 || r < 1) return;
  const s = r * backOut(clamp(k * 2.2)) * (1 - k * .5);
  ctx.globalAlpha = 1 - k * k; ctx.fillStyle = col; ctx.beginPath(); poly(starPts(x, y, s, .22, 4, k * 1.5)); ctx.fill(); ctx.globalAlpha = 1;
}
function emote(kind, hx, hy, u, k, age, side = 1) {
  if (!kind || k <= 0) return;
  const s = u * backOut(clamp(k));
  seed('emote' + kind + side);
  switch (kind) {
    case 'sweat': drop(hx + side * 3.3 * u, hy + 1.3 * u + clamp(age * .7, 0, .9) * u, .6 * s); break;
    case 'bang': {
      const a = 1 - seg(age, .9, 1.25); if (a <= 0) break;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(hx + side * 3.3 * u, hy - .5 * u); ctx.rotate(.18 * side);
      inkLine([[0, -1.2 * s], [0, .15 * s]], .55 * s, PAL.berry, { t0: .02, t1: .7, min: .35 });
      paintShape(ellPts(0, .6 * s, .22 * s, .22 * s, 10), PAL.berry, { tex: 0, edge: 0 });
      ctx.restore(); break;
    }
    case 'rain': {
      const cx = hx, cy = hy - 3.2 * u, P = cloudPts(cx, cy, 2.6 * s, 1.05 * s);
      for (let i = 0; i < 8; i++) {
        const q = frac(age * 1.6 + hash(i)), x = cx + (i / 7 - .5) * 4 * u, y = cy + .7 * u + q * 2.4 * u;
        inkLine([[x, y], [x - .15 * u, y + .6 * u]], .14 * u, '#6FA8DC', { a: 1 - q, t0: .2, t1: .2 });
      }
      paintShape(P, '#9AA6BC', { tex: .3 }); inkLoop(P, .13 * u, PAL.ink, { a: .9 });
      paintShape(ellPts(cx - 1.1 * u, cy - .35 * u, .5 * u, .22 * u, 12), '#C3CAD8', { tex: 0, edge: 0, a: .8 });
      break;
    }
    case 'hearts': for (let i = 0; i < 3; i++) {
      const q = frac(age * .55 + i / 3), x = hx + (i - 1) * 1.5 * u + Math.sin(q * 6 + i) * .3 * u, y = hy - .3 * u - q * 2.6 * u, r = .5 * u * (1 - q * .3) * clamp(k);
      ctx.globalAlpha = Math.sin(q * Math.PI); paintShape(heartPts(x, y, r, 32), PAL.heart, { tex: 0 }); inkLoop(heartPts(x, y, r, 32), .07 * u, PAL.ink, { a: .8 }); ctx.globalAlpha = 1;
    } break;
    case 'notes': for (let i = 0; i < 2; i++) { const q = frac(age * .45 + i * .5); note(hx + side * (2.4 + i * 1.3) * u + Math.sin(q * 5) * .2 * u, hy - (.2 + q * 1.8) * u, .8 * s, Math.sin(q * Math.PI)); } break;
    case 'sparkles': for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4, q = frac(age * .9 + i * .27); sparkle(hx + Math.cos(a) * 3.6 * u, hy + .8 * u + Math.sin(a) * 2.2 * u, .75 * s, q); } break;
    case 'stars': for (let i = 0; i < 3; i++) {
      const a = age * 5 + i * TAU / 3, x = hx + Math.cos(a) * 2.6 * u, y = hy - .2 * u + Math.sin(a) * .6 * u, S = starPts(x, y, .5 * s, .45, 5, a);
      paintShape(S, PAL.gold, { tex: 0, edge: 0, smooth: false }); inkLoop(S, .06 * u, PAL.ink, { raw: true, a: .9 });
    } break;
  }
}

// ---------- moods ----------
// A mood is a face, a blush, tears, an emote and a way of moving. moodAt() acts the changes between moods: a squint
// hides the face swap, then a take (squash and a little hop) sized to the new mood.
const MOODS = {
  happy:      { eyes: 'normal', mouth: 'smile', blush: .7, take: .4, idle: 'bob' },
  hum:        { eyes: 'happy', mouth: 'smile', blush: .8, take: .3, idle: 'bob', emote: 'notes' },
  mischief:   { eyes: 'happy', mouth: 'w', blush: .9, take: .5, idle: 'sway' },
  joy:        { eyes: 'happy', mouth: 'grin', blush: 1, take: .7, idle: 'giggle' },
  surprised:  { eyes: 'wide', mouth: 'o', blush: .3, take: 1, idle: 'still', emote: 'bang' },
  alarmed:    { eyes: 'wide', mouth: 'wobble', blush: .2, take: .7, idle: 'shiver', emote: 'sweat' },
  squeeze:    { eyes: 'squeeze', mouth: 'wobble', blush: 1, take: .3, idle: 'shiver', emote: 'sweat' },
  dizzy:      { eyes: 'dizzy', mouth: 'wobble', blush: .2, take: .6, idle: 'dizzy', emote: 'stars' },
  worried:    { eyes: 'sad', mouth: 'wobble', blush: .3, take: .3, idle: 'still' },
  teary:      { eyes: 'teary', mouth: 'wobble', blush: .45, tears: .35, take: .3, idle: 'shiver' },
  cry:        { eyes: 'teary', mouth: 'wail', blush: .5, tears: 1, take: .5, idle: 'sob', emote: 'rain' },
  sad:        { eyes: 'sad', mouth: 'frown', blush: .35, tears: .25, take: .2, idle: 'droop' },
  hopeful:    { eyes: 'wide', mouth: 'o', blush: .7, take: .6, idle: 'float', emote: 'sparkles' },
  starstruck: { eyes: 'star', mouth: 'grin', blush: 1, take: 1, idle: 'bounce', emote: 'sparkles' },
  love:       { eyes: 'heart', mouth: 'w', blush: 1, take: .7, idle: 'bounce', emote: 'hearts' },
  content:    { eyes: 'happy', mouth: 'smile', blush: 1, take: .3, idle: 'sway' },
  kiss:       { eyes: 'happy', mouth: 'kiss', blush: 1, take: .5, idle: 'still' },
};
const IDLE = {
  still:  () => ({}),
  bob:    (t, ph) => ({ sq: .05 * pulse(t + ph * .05, 5) }),
  sway:   (t, ph) => ({ lean: .07 * Math.sin((t + ph) * TAU / (BEAT * 2)), sq: .03 * pulse(t, 5) }),
  giggle: (t, ph) => ({ sq: .045 * Math.sin((t + ph) * 26) + .05 * pulse(t, 5), dy: .12 * Math.abs(Math.sin((t + ph) * 13)) }),
  shiver: (t, ph) => ({ dx: .035 * Math.sin((t + ph) * 70) }),
  dizzy:  (t, ph) => ({ wob: .07, wobPh: (t + ph) * 7 }),
  sob:    (t, ph) => ({ sq: .06 * Math.max(0, Math.sin((t + ph) * 8.5)), dx: .02 * Math.sin((t + ph) * 50) }),
  droop:  (t, ph) => ({ sq: .07 + .02 * Math.sin((t + ph) * 1.7) }),
  float:  (t, ph) => ({ dy: .12 + .1 * Math.sin((t + ph) * 3.2), sq: -.03 }),
  bounce: (t, ph) => ({ sq: .09 * pulse(t + ph * .05, 4), dy: .2 * pulse(t + ph * .05 - .08, 6) }),
};
function blink(t, ph) { const P = 3.4, x = frac((t + ph * 9.7) / P) * P; return bump(x, 0, .06, .15); }
function moodAt(t, keys, ph = 0) {
  let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
  const [tk, name, over = {}] = keys[i], m = MOODS[name];
  const val = (mm, ov, f, d) => ov[f] ?? mm[f] ?? d;
  const face = { eyes: over.eyes ?? m.eyes, mouth: over.mouth ?? m.mouth };
  const k = i > 0 ? ease(seg(t, tk, tk + .22)) : 1, pm = i > 0 ? MOODS[keys[i - 1][1]] : m, po = i > 0 ? (keys[i - 1][2] || {}) : over;
  for (const [fl, d] of [['blush', .5], ['tears', 0], ['lookX', 0], ['lookY', 0]]) face[fl] = lerp(val(pm, po, fl, d), val(m, over, fl, d), k);
  let squint = 0, sq = 0, dy = 0;
  for (let j = 1; j < keys.length; j++) { const tc = keys[j][0]; if (t > tc - .1 && t < tc + .12) squint = Math.max(squint, bump(t, tc - .1, tc, tc + .12)); }
  if (i > 0) { const a = t - tk, amt = m.take ?? .5; sq += -.2 * amt * Math.exp(-6.5 * a) * Math.cos(15 * a); dy += .9 * amt * Math.exp(-7 * a) * Math.max(0, Math.sin(Math.min(Math.PI, a * 10))); }
  if (i + 1 < keys.length) { const tn = keys[i + 1][0], mn = MOODS[keys[i + 1][1]]; if (t > tn - .12) sq += .1 * (mn.take ?? .5) * ease(seg(t, tn - .12, tn)); }
  face.squint = Math.max(squint, blink(t, ph));
  const id = IDLE[m.idle || 'bob'](t, ph);
  return { face, sq: sq + (id.sq || 0), dy: dy + (id.dy || 0), dx: id.dx || 0, lean: id.lean || 0, wob: id.wob || 0, wobPh: id.wobPh || 0,
           emote: over.emote !== undefined ? over.emote : m.emote, emoteK: easeOut(seg(t, tk, tk + .3)), emoteAge: t - tk };
}

// ---------- the kid's hands ----------
// Seen from the back, fingers pointing at the squishy they're squeezing: (x, y) is where the fingertips press, side -1
// is the left hand. A striped hoodie sleeve runs off-screen, rising at an angle so the arm never goes through the desk.
const SLEEVE = ['#F2A541', '#5BB8A8'];
const FINGERS = [[-1.12, -.45, .58], [-.43, -.1, .7], [.3, .06, .74], [1.04, -.1, .72]];   // [y, tip x, width]: pinky to index
function kidHand(x, y, s, side, o = {}) {
  seed('hand' + side);
  const S = P => P.map(p => [p[0] * s, p[1] * s]);
  ctx.save(); ctx.translate(x, y); ctx.scale(-side, 1); ctx.rotate(.3 + (o.rot || 0));
  const sl = [[-2.9, -1.75], [-17, -2.3], [-17, 2.6], [-2.9, 2.1]];
  paintShape(S(sl), SLEEVE[0], { tex: .35, smooth: false });
  for (let k = 0; k < 9; k++) { const x0 = -4.0 - k * 1.5, e = .04 * k; paintShape(S([[x0, -1.8 - e], [x0 - .7, -1.83 - e], [x0 - .7, 2.14 + e], [x0, 2.12 + e]]), SLEEVE[1], { tex: .35, smooth: false, edge: 0 }); }
  inkLine(S([[-2.9, -1.75], [-17, -2.3]]), .1 * s, PAL.ink, { t0: .02, t1: .02 }); inkLine(S([[-2.9, 2.1], [-17, 2.6]]), .1 * s, PAL.ink, { t0: .02, t1: .02 });
  const palm = rrPts(-3.3, -1.45, 2.3, 3.05, .95);
  paintShape(S(palm), PAL.skin, { tex: .25, edge: .3 }); inkLoop(S(palm), .09 * s, PAL.ink);
  for (let k = 0; k < 4; k++) {   // pinky first, so each finger overlaps the one above it
    const [fy, tip, w] = FINGERS[k], base = -1.75, F = rrPts(base, fy - w / 2, tip - base, w, w / 2);
    paintShape(S(F), PAL.skin, { tex: .2, edge: .25 }); inkLoop(S(F), .085 * s, PAL.ink);
    paintShape(S(ellPts(tip - .3, fy, .17, w * .3, 10)), '#FCE6D8', { tex: 0, edge: 0, a: .95 });
    inkLine(S([[base + .3, fy - w * .28], [base + .4, fy], [base + .3, fy + w * .28]]), .05 * s, PAL.skinDk, { a: .8 });
  }
  const th = ellPts(-1.75, 1.6, 1.05, .43, 20, .5);
  paintShape(S(th), mix(PAL.skin, '#FFFFFF', .08), { tex: .2, edge: .25 }); inkLoop(S(th), .085 * s, PAL.ink);
  paintShape(S(ellPts(-.95, 2.0, .16, .12, 8, .5)), '#FCE6D8', { tex: 0, edge: 0 });
  const cuff = rrPts(-3.6, -1.95, 1.0, 4.15, .3);
  paintShape(S(cuff), mix(SLEEVE[0], PAL.ink, .12), { tex: .3 });
  for (let k = 1; k < 4; k++) inkLine(S([[-3.6 + k * .25, -1.85], [-3.6 + k * .25, 2.1]]), .04 * s, mix(SLEEVE[0], PAL.ink, .35), { a: .8 });
  inkLoop(S(cuff), .09 * s, PAL.ink);
  if (o.sweat > 0) { drop(-1.2 * s, -2.4 * s + clamp(o.sweatAge * .5, 0, .5) * s, .42 * s * backOut(clamp(o.sweat))); drop(-2.6 * s, -2.9 * s, .3 * s * backOut(clamp(o.sweat * 1.3 - .3))); }
  ctx.restore();
}
// The kid's big feelings: a tangled scribble that re-scribbles itself 12 times a second.
function feelings(x, y, r, k, t) {
  if (k <= .01) return;
  seed('feel');
  const cols = ['#7E2A3E', '#3A2A3F', '#B23A48'];
  for (let L = 0; L < 3; L++) {
    const P = [];
    for (let i = 0; i < 44; i++) { const a = i / 44 * TAU * 3.3 + L * 2.1 + t * (2.5 + L), rr = r * k * (.35 + .65 * rnd()); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * .7]); }
    inkLine(P, 5 - L * 1.2, cols[L], { a: .85, n: 3 });
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU + t * .8, rr = r * k * 1.2, cx = x + Math.cos(a) * rr, cy = y + Math.sin(a) * rr * .72;
    inkLine([[cx - 11, cy - 7], [cx - 4, cy + 7], [cx + 4, cy - 7], [cx + 11, cy + 7]], 3.2, '#B23A48', { a: .8, n: 1 });
  }
}
// After the pop the feelings burst into little grey puffs that drift off.
function puffs(x, y, age) {
  if (age < 0 || age > .9) return;
  seed('puffs');
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + .3, d = easeOut(age / .9), px = x + Math.cos(a) * 240 * d, py = y + Math.sin(a) * 150 * d - 60 * age;
    paintShape(ellPts(px, py, 16 + 30 * age, 13 + 24 * age, 12), '#C9C2CC', { a: 1 - age / .9, tex: .2 });
  }
}
