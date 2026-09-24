'use strict';
// scenes.js: the film, shot by shot (see STORYBOARD.md). Every time comes from cues.js, which the soundtrack reads too.
const U = 42, BX = 730, MX = 1190;
const PL = CUES.play, SQZ = CUES.squeeze, SAD = CUES.sad, MAG = CUES.magic, PTY = CUES.party, LOV = CUES.love;
const POP = SQZ.pop, WHO = ['bao', 'mochi'];
const IRIS_PINK = '#EE8FB4';
const WIPE = ['#FF9EC2', '#FFD27A', '#9FE0A0', '#8EC8F5', '#C9A6F2', '#FF8FA3'];
// after the pop they lie flat here; Mochi then scoots over to lean on Bao
const FLAT = { bao: 640, mochi: 1280 }, SCOOT = 80;

// ---------- acting timelines ----------
const BAO_DESK = [
  [0, 'happy'], [1.05, 'hum'], [3.45, 'happy', { lookX: .6 }], [4.25, 'surprised', { lookX: .8 }], [4.85, 'joy'],
  [7.25, 'surprised', { lookX: -1 }], [7.9, 'alarmed', { lookX: -.8 }], [8.6, 'squeeze'],
  [10.45, 'dizzy'], [12.3, 'worried', { lookX: -.5 }], [12.9, 'worried', { lookY: 1, lookX: .2 }], [13.4, 'teary', { lookY: .6 }], [14.1, 'cry'],
  [17.0, 'sad', { lookX: .8 }], [19.9, 'surprised', { lookX: -1, lookY: .6 }], [20.4, 'hopeful', { lookY: -.8 }],
  [23.6, 'surprised'], [24.3, 'happy', { lookY: 1, lookX: -.3 }], [25.0, 'starstruck'], [25.5, 'joy', { lookX: .8 }]
];
const MOCHI_DESK = [
  [0, 'happy'], [1.3, 'happy', { lookX: -.5 }], [3.4, 'mischief', { lookX: -1 }], [4.3, 'joy'], [5.45, 'surprised', { lookX: -.8 }], [5.85, 'joy'],
  [7.3, 'surprised', { lookX: 1 }], [8.0, 'alarmed', { lookX: .8 }], [8.7, 'worried'], [9.2, 'squeeze'],
  [10.45, 'dizzy'], [12.5, 'worried', { lookX: .5 }], [13.1, 'worried', { lookY: 1 }], [13.7, 'teary', { lookY: .6 }], [14.4, 'sad'],
  [15.3, 'worried', { lookX: -.9 }], [16.7, 'sad', { lookX: -.6 }], [19.4, 'surprised', { lookX: 1, lookY: .6 }], [20.4, 'hopeful', { lookY: -.8 }],
  [24.0, 'surprised'], [24.5, 'happy', { lookY: 1, lookX: .3 }], [25.1, 'starstruck'], [25.55, 'joy', { lookX: -.8 }]
];
const BAO_PARTY = [[26.4, 'joy'], [29.2, 'mischief'], [30.0, 'starstruck'], [30.5, 'joy'], [31.2, 'surprised', { lookY: -1 }], [31.55, 'joy'], [34.2, 'happy', { lookX: .6 }], [34.7, 'joy'], [35.6, 'happy', { lookX: .7 }]];
const MOCHI_PARTY = [[26.4, 'joy'], [27.4, 'hum'], [29.35, 'surprised', { lookX: -1 }], [30.0, 'starstruck'], [30.45, 'mischief', { lookX: -1 }], [31.2, 'joy'], [34.2, 'joy'], [35.6, 'happy', { lookX: -.7 }]];
const BAO_LOVE = [[36.0, 'happy', { lookX: .7 }], [37.2, 'content'], [38.6, 'hopeful', { lookY: -1, lookX: .3, emote: null }], [39.8, 'love'], [41.4, 'happy'], [41.6, 'kiss'], [42.4, 'content'], [43.5, 'joy']];
const MOCHI_LOVE = [[36.0, 'happy', { lookX: -.7 }], [37.25, 'content'], [38.7, 'hopeful', { lookY: -1, lookX: -.3, emote: null }], [39.9, 'love'], [41.45, 'happy'], [41.65, 'kiss'], [42.45, 'content'], [43.55, 'joy']];

// ---------- the squeeze, the pop and the glitter ----------
function squeezeAmt(t) {
  if (t < SQZ.presses[0] || t > POP + .12) return 0;
  const peaks = [.32, .58, .8], rests = [.27, .53, .78];
  let v = 0;
  SQZ.presses.forEach((tp, i) => {
    if (t >= tp) { v = lerp(i ? rests[i - 1] : 0, peaks[i], easeOut(seg(t, tp, tp + .16))); v = lerp(v, rests[i], ease(seg(t, tp + .2, tp + .5))); }
  });
  const [ta] = SQZ.tremble;
  if (t >= ta) v = lerp(.78, .9, ease(seg(t, ta, POP))) + .025 * Math.sin(t * 90) * seg(t, ta, POP);
  if (t >= POP) v = .9 * (1 - easeOut(seg(t, POP, POP + .1)));
  return clamp(v);
}
const pressKick = t => SQZ.presses.reduce((s, tp) => s + (t >= tp ? Math.exp(-9 * (t - tp)) : 0), 0);
// Each flake's trip: burst out at the pop, land on the desk, lift at the magic, swirl, and flow home.
const SPILL = {}, LIFT = {}, ARRIVE = {}, GLINT = {};
for (const who of WHO) {
  const F = FLAKES[who], n = F.length, sgn = who === 'bao' ? -1 : 1, s = who === 'bao' ? 11 : 23;
  const x0 = 960 + sgn * halfWidth(.9, 0, U), sx = 1 - .4 * .9, sy = 1 + .55 * .9, lim = 5 - 1.2 * .9, g = 2000;
  SPILL[who] = F.map((fl, i) => {
    const xs = x0 + clamp(fl.x, -lim, lim) * sx * U, ys = GY + fl.y * sy * U;
    let vx = fl.x / 5 * 460 + (hash(i * 2.7 + s) - .5) * 320 + sgn * 150; const vy = -(520 + hash(i * 1.9 + s) * 560);
    const yl = GY + 6 + hash(i * 4.4 + s) * 40, al = (-vy + Math.sqrt(vy * vy + 2 * g * (yl - ys))) / g;
    let xl = xs + vx * al; const xc = clamp(xl, 380, 1540); if (xc !== xl) { vx = (xc - xs) / al; xl = xc; }
    return { xs, ys, vx, vy, g, al, xl, yl };
  });
  LIFT[who] = F.map((_, i) => MAG.lift + hash(i * 5.1 + s) * .5);
  ARRIVE[who] = F.map((_, i) => MAG.stream[0] + (MAG.stream[1] - MAG.stream[0]) * Math.min(.999, (i + hash(i * 3.3 + s) * .8) / n));
  // the flake that glints first: out on the desk, a little beyond its squishy, where the eye can find it
  const want = who === 'mochi' ? 1390 : 560;
  GLINT[who] = SPILL[who].reduce((best, p, i) => Math.abs(p.xl - want) < Math.abs(SPILL[who][best].xl - want) ? i : best, 0);
}
const arrived = (t, who) => ARRIVE[who].reduce((n, a) => n + (t >= a ? 1 : 0), 0) / ARRIVE[who].length;
function deflateAmt(t, who) {
  if (t < POP) return 0;
  const tb = MAG.boings[who === 'bao' ? 0 : 1];
  if (t < tb) return easeOut(seg(t, POP, POP + .14)) - .3 * arrived(t, who);
  return .7 * (1 - elasticOut(seg(t, tb, tb + .75)));
}
const flakeInside = (t, who, i) => t < POP || t >= ARRIVE[who][i];
const DULL = {}; for (const who of WHO) DULL[who] = FLAKES[who].map(fl => ({ ...fl, col: mix(fl.col, '#98A2B6', .55) }));

// Where a flake is while it's out of its squishy, and whether it's in front of the bodies.
function flakeOut(t, who, i, home) {
  const p = SPILL[who][i], lift = LIFT[who][i], arr = ARRIVE[who][i];
  if (t < lift) {
    const a = t - POP;
    if (a < p.al) return { x: p.xs + p.vx * a, y: p.ys + p.vy * a + .5 * p.g * a * a, front: true, spin: a * 9, bright: 1, burst: true };
    return { x: p.xl, y: p.yl, front: true, spin: 0, bright: 0 };
  }
  const k = seg(t, lift, arr), cx = home.x, cy = GY - 2.6 * U, dir = who === 'bao' ? 1 : -1;
  const r0 = Math.hypot(p.xl - cx, p.yl - cy), a0 = Math.atan2(p.yl - cy, p.xl - cx), ang = a0 + dir * 3.4 * Math.PI * ease(k);
  let r = lerp(r0, 4.3 * U, ease(seg(k, 0, .35))); r = lerp(r, 1.2 * U, easeIn(seg(k, .45, .9)));
  let x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * .45 - 1.3 * U * Math.sin(Math.PI * k);
  const b = ease(seg(k, 0, .15)); x = lerp(p.xl, x, b); y = lerp(p.yl, y, b);
  const tgt = home.pos(i), e = easeIn(seg(k, .8, 1)); x = lerp(x, tgt[0], e); y = lerp(y, tgt[1], e);
  return { x, y, front: Math.sin(ang) > 0 || k > .85, spin: t * 4, bright: 1, flying: true };
}
function drawLooseFlakes(t, who, home, front) {
  if (t < POP || t > MAG.stream[1] + .3) return;
  const F = FLAKES[who];
  for (let i = 0; i < F.length; i++) {
    if (flakeInside(t, who, i)) continue;
    const q = flakeOut(t, who, i, home); if (q.front !== front) continue;
    const dull = q.bright < 1 && t > POP + .9 && t < LIFT[who][i];
    const fl = dull ? { ...DULL[who][i], rot: F[i].rot + q.spin } : { ...F[i], rot: F[i].rot + q.spin };
    const tw = .5 + .5 * Math.sin(t * F[i].sp * 3 + F[i].ph), size = F[i].s * U * (q.flying || q.burst ? 1.8 : 1.15);
    if (q.flying) {   // a short trail of light behind each flake on its way home
      const p0 = flakeOut(t - .06, who, i, home);
      seed('trail' + who + i); inkLine([[p0.x, p0.y], [q.x, q.y]], size * .5, '#FFF3C4', { a: .55, t0: .9, t1: .05, j: 0 });
      glow(q.x, q.y, 22, '#FFE9A8', .4);
    }
    flake(q.x, q.y, size, fl, dull ? .75 : .75 + .25 * tw, dull ? 0 : tw);
  }
}
function glints(t) {
  MAG.glints.forEach((tg, j) => {
    const who = j === 0 ? 'mochi' : 'bao', p = SPILL[who][GLINT[who]], k = bump(t, tg, tg + .15, tg + 1.1);
    if (k <= 0) return;
    glow(p.xl, p.yl, 160, '#FFF1B0', k);
    sparkle(p.xl, p.yl, 80, seg(t, tg, tg + .8), '#FFFBE6');
    sparkle(p.xl, p.yl, 50, seg(t, tg + .3, tg + 1.0), '#FFFBE6');
  });
}
// Comic impact marks where two squishies bump: a fan of short strokes and a sparkle.
function impact(x, y, t, t0) {
  const k = seg(t, t0, t0 + .3); if (k <= 0 || k >= 1) return;
  seed('impact' + t0);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * (.12 + .76 * i / 4), r0 = 40 + 60 * easeOut(k), r1 = r0 + 46 * (1 - k);
    inkLine([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], 7, PAL.ink, { a: 1 - k * k, t0: .3, t1: .3 });
  }
  sparkle(x, y - 30, 46, k);
}
// A burst of sparkles on the tear just before the patch or band-aid pops on.
function mendSparkles(t, x, y, t0) { for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; sparkle(x + Math.cos(a) * 70, y + Math.sin(a) * 50, 26, seg(t, t0 + i * .02, t0 + .5 + i * .02)); } }

// ---------- where Bao and Mochi are, and how they act, on the desk (0–26.4 s) ----------
function jigAt(t, evs, amp) { let e = null; for (const x of evs) if (t >= x) e = x; return e === null ? { wob: 0, wobPh: 0 } : jiggle(t, e, amp); }
function deskState(t, who) {
  const bao = who === 'bao', hx = squeezeAmt(t), d = deflateAmt(t, who), sgn = bao ? -1 : 1;
  let x;
  if (bao) x = BX - 60 * easeOut(seg(t, PL.bump, PL.bump + .3)) + 92 * ease(seg(t, PL.bumpBack - .35, PL.bumpBack)) - 32 * ease(seg(t, PL.bumpBack + .3, PL.bumpBack + .9));
  else x = MX + 10 * ease(seg(t, PL.windup, PL.windup + .4)) - 60 * easeIn(seg(t, PL.bump - .2, PL.bump)) + 50 * easeOut(seg(t, PL.bump, PL.bump + .5))
         + 40 * easeOut(seg(t, PL.bumpBack, PL.bumpBack + .3)) - 40 * ease(seg(t, PL.bumpBack + .6, PL.bumpBack + 1.2));
  x = lerp(x, 960 + sgn * halfWidth(hx, 0, U), ease(seg(t, SQZ.push[0], SQZ.push[1])));
  if (t >= POP) x = lerp(960 + sgn * halfWidth(.9, 0, U), FLAT[who], easeOut(seg(t, POP, POP + .45)));
  if (!bao) x -= SCOOT * ease(seg(t, SAD.scoot[0], SAD.scoot[1]));

  const m = moodAt(t, bao ? BAO_DESK : MOCHI_DESK, SQ[who].ph);
  let sq = m.sq, dy = m.dy * (1 - .7 * clamp(d)), lean = m.lean, dx = m.dx;
  for (const [a, b] of bao ? PL.hopsBao : PL.hopsMochi) { const h = hop(t, a, b, 1.1); sq += h.sq; dy += h.dy; }
  if (bao) { lean += -.34 * spring(t, PL.bump, 5, 12) + .34 * bump(t, PL.bumpBack - .35, PL.bumpBack, PL.bumpBack + .5); if (t >= PL.bump) sq -= .16 * Math.exp(-8 * (t - PL.bump)) * Math.cos(20 * (t - PL.bump)); }
  else if (t >= PL.bumpBack) sq -= .14 * Math.exp(-8 * (t - PL.bumpBack)) * Math.cos(20 * (t - PL.bumpBack));
  else lean += .22 * ease(seg(t, PL.windup, PL.windup + .4)) - .57 * easeIn(seg(t, PL.bump - .2, PL.bump)) + .35 * easeOut(seg(t, PL.bump, PL.bump + .5)) + .25 * spring(t, PL.bumpBack, 5, 12)
            - .14 * ease(seg(t, SAD.scoot[1] - .3, SAD.scoot[1]));
  if (!bao && t > SAD.scoot[0] && t < SAD.scoot[1]) sq += .1 * Math.max(0, Math.sin((t - SAD.scoot[0]) * 16));   // inching over
  sq += .06 * pressKick(t) * (t < POP ? 1 : 0);
  const tb = MAG.boings[bao ? 0 : 1];
  if (t >= tb) { const a = t - tb; sq += -.3 * Math.exp(-5 * a) * Math.cos(14 * a); dy += 1.3 * Math.exp(-5 * a) * Math.max(0, Math.sin(Math.min(Math.PI, a * 7))); }
  const jg = jigAt(t, [PL.bump, PL.bumpBack, POP + .05, tb], .16), mend = bao ? MAG.patch : MAG.bandaid;
  return {
    x, o: {
      who, sq, dy, dx, lean, hx, deflate: d, wob: jg.wob + m.wob, wobPh: m.wob ? m.wobPh : jg.wobPh, face: m.face,
      emote: m.emote, emoteK: m.emoteK, emoteAge: m.emoteAge,
      rip: seg(t, POP, POP + .12), ripOpen: 1 - seg(t, mend, mend + .08),
      patch: bao ? seg(t, mend, mend + .25) : 0, bandaid: bao ? 0 : seg(t, mend, mend + .25),
      glitter: i => flakeInside(t, who, i) ? 1 : 0
    }
  };
}
const deskSky = t => ({ day: 1 - seg(t, 11.4, 12.6), rain: seg(t, 11.4, 12.6) * (1 - seg(t, 19.9, 21.0)), magic: seg(t, 19.9, 21.0) * (1 - seg(t, 24.4, 25.6)), rainbow: seg(t, 24.4, 25.6) });
function deskCam(t) {
  const z = kf(t, [[0, 1.2], [7.2, 1.23], [8.6, 1.3], [10.4, 1.34], [11.6, 1.36], [14.5, 1.48], [19.2, 1.5], [20.4, 1.44], [21.8, 1.28], [26.4, 1.22]]);
  const cy = kf(t, [[0, 680], [8.6, 690], [11.6, 740], [14.5, 790], [19.2, 790], [21.8, 700], [26.4, 680]]);
  let [sx, sy] = t >= POP ? shakeXY(t, 18 * Math.exp(-(t - POP) * 6)) : [0, 0];
  const pk = shakeXY(t + 3, 4 * pressKick(t) * (t < POP ? 1 : 0)); sx += pk[0]; sy += pk[1];
  return [960 + 14 * Math.sin(t * .35) + sx, cy + sy, z];
}
// A squishy's flake positions right now, for glitter flying home.
function homeOf(x, o) { const f = warpOf(o, U); return { x, pos: i => { const fl = FLAKES[o.who][i], p = f(fl.x, fl.y); return [x + (o.dx || 0) * U + p[0], GY - (o.dy || 0) * U + p[1]]; } }; }

function deskShot(t, lt, dur) {
  const [cx, cy, z] = deskCam(t);
  camBegin(cx, cy, z);
  room(t, deskSky(t));
  const S = { bao: deskState(t, 'bao'), mochi: deskState(t, 'mochi') }, home = {};
  for (const who of WHO) home[who] = homeOf(S[who].x, S[who].o);
  // magic light behind them
  const mg = seg(t, MAG.lift - .4, MAG.lift + .8) * (1 - seg(t, 25.4, 26.4));
  if (mg > 0) for (const who of WHO) glow(S[who].x, GY - 2.5 * U, 400 + 40 * Math.sin(t * 3), '#FFD98A', .55 * mg);
  for (const who of WHO) drawLooseFlakes(t, who, home[who], false);
  // Bao is drawn over Mochi while Bao bumps back; otherwise Mochi is on top
  const order = t > PL.bumpBack - .5 && t < PL.bumpBack + .8 ? ['mochi', 'bao'] : ['bao', 'mochi'];
  const info = {};
  for (const who of order) info[who] = squishy(S[who].x, GY, U, S[who].o);
  // the kid's hands, and the scribble of big feelings above them
  if (t > SQZ.handsIn[0] && t < SQZ.handsOut[1]) {
    const hx = squeezeAmt(t), hw0 = halfWidth(0, 0, U), s = 1.45 * U, hy = GY - 3.2 * U;
    const inK = easeOut(seg(t, SQZ.handsIn[0], SQZ.handsIn[1]));
    let xL = lerp(-520, BX - hw0 - 4, inK), xR = lerp(W + 520, MX + hw0 + 4, inK);
    if (t >= SQZ.push[0]) { xL = S.bao.x - halfWidth(hx, 0, U); xR = S.mochi.x + halfWidth(hx, 0, U); }
    if (t >= POP) {
      const xp = 960 - 2 * halfWidth(.9, 0, U), back = 170 * backOut(seg(t, POP, POP + .35)) + 1200 * easeIn(seg(t, SQZ.handsOut[0], SQZ.handsOut[1]));
      xL = xp - back; xR = 1920 - xp + back;
    }
    const rk = -.18 * spring(t, POP, 5, 14) + .05 * pressKick(t) * (t < POP ? 1 : 0);
    const sw = { sweat: seg(t, POP + .35, POP + .6), sweatAge: t - POP - .35 };
    kidHand(xL, hy, s, -1, { rot: rk, ...sw }); kidHand(xR, hy, s, 1, { rot: rk, ...sw });
    const fk = ease(seg(t, 7.9, 8.4)) * (1 + .5 * hx);
    if (t < POP) feelings(960, 520, 130, fk, t); else puffs(960, 520, t - POP);
  }
  for (const who of WHO) drawLooseFlakes(t, who, home[who], true);
  glints(t);
  impact(935, GY - 3.4 * U, t, PL.bump); impact(985, GY - 3.4 * U, t, PL.bumpBack);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .2, r = 230 + 160 * hash(i + 40); sparkle(960 + Math.cos(a) * r, GY - 3 * U + Math.sin(a) * r * .6, 36, seg(t, POP + .03 + i * .025, POP + .65 + i * .025)); }
  // mending: sparkles, then the band-aid and the heart patch pop on
  mendSparkles(t, ...info.mochi.toWorld(2.45, -5.6), MAG.bandaid - .15);
  mendSparkles(t, ...info.bao.toWorld(-2.45, -5.55), MAG.patch - .15);
  // the pop: a starburst of light
  if (t >= POP && t < POP + .4) {
    const k = seg(t, POP, POP + .4), S1 = starPts(960, GY - 3 * U, 340 * easeOut(k * 1.6), .5, 12, k);
    seed('burst'); paintShape(S1, '#FFF6D2', { a: 1 - k, tex: 0, edge: 0 }); inkLoop(S1, 6, PAL.ink, { a: .8 * (1 - k) });
    glow(960, GY - 3 * U, 560, '#FFF3C0', 1 - k);
  }
  // healing: sparkles as they spring back, then star-eyed wonder
  for (const [j, tb] of MAG.boings.entries()) { const who = WHO[j]; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + j; sparkle(S[who].x + Math.cos(a) * 5.4 * U, GY - 3 * U + Math.sin(a) * 3.6 * U, 34, seg(t, tb + i * .03, tb + .7 + i * .03)); } }
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, x = 960 + Math.cos(a) * 560, y = GY - 3.4 * U + Math.sin(a) * 280; sparkle(x, y, 40, seg(t, MAG.starstruck + i * .04, MAG.starstruck + .8 + i * .04)); }
  const ctr = toScreen(960, GY - 2.6 * U);
  camEnd();
  // colour: the rain drains it to blue, the magic warms it to violet and gold
  const sad = seg(t, 11.8, 13.0) * (1 - seg(t, 19.7, 21.0)), mag = seg(t, 20.0, 21.2) * (1 - seg(t, 25.2, 26.4));
  grade('saturation', '#808080', .5 * sad); grade('multiply', '#AFC0E4', .5 * sad);
  grade('soft-light', '#9D6BF0', .5 * mag); grade('screen', '#2A1450', .12 * mag);
  if (t >= POP) flash(1 - seg(t, POP, POP + .12));
  if (t < PL.iris[1]) iris(ctr[0], ctr[1], lerp(0, 1500, easeIn(seg(t, PL.iris[0], PL.iris[1]))), IRIS_PINK);
  if (t > MAG.wipe[0]) brushWipe((t - MAG.wipe[0]) / (MAG.wipe[1] - MAG.wipe[0]), WIPE);
}

// ---------- party (26.4–36 s) and love (36–45.6 s) ----------
const lateSky = t => ({ rainbow: 1 - seg(t, 35.4, 37.0), sunset: seg(t, 35.4, 37.0) });
function topOf(x, o) { const f = warpOf(o, U), p = f(0, TOP + .15); return [x + (o.dx || 0) * U + p[0], GY - (o.dy || 0) * U + p[1]]; }
function confetti(t, t0) {
  const cols = ['#FF8FB3', '#FFD27A', '#9FE0A0', '#8EC8F5', '#C9A6F2', '#FF9A7A'];
  for (let j = 0; j < 130; j++) {
    const ts = t0 + hash(j * 3.1) * 10 - 1.6, a = t - ts; if (a < 0 || a > 5) continue;
    const x = 160 + hash(j * 7.7) * 1600 + Math.sin(a * (2 + hash(j) * 2) + j) * 34, y = 120 + a * (160 + hash(j * 5.3) * 130);
    if (y > GY + 70) continue;
    const r = 8 + hash(j * 2.2) * 7, flip = Math.cos(a * (5 + hash(j) * 4) + j);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a * (3 + hash(j * 9) * 5) + j); ctx.scale(1, flip);
    ctx.fillStyle = cols[j % cols.length]; ctx.fillRect(-r, -r * .55, 2 * r, 1.1 * r); ctx.restore();
  }
}
function partyState(t) {
  const mb = moodAt(t, BAO_PARTY, SQ.bao.ph), mm = moodAt(t, MOCHI_PARTY, SQ.mochi.ph);
  // Bao: hops, a backflip, and holding Mochi up
  let bsq = mb.sq, bdy = mb.dy, brot = 0, blean = mb.lean;
  for (const [a, b] of PTY.hopsBao) { const h = hop(t, a, b, 1.2); bsq += h.sq; bdy += h.dy; }
  const [fa, fb] = PTY.flip, fh = hop(t, fa, fb, 3.6);
  bsq += fh.sq + (t > fa && t < fb ? .12 * Math.sin(Math.PI * seg(t, fa, fb)) : 0); bdy += fh.dy; brot = -TAU * ease(seg(t, fa + .03, fb - .03));
  const [sa, sb] = PTY.stackOn, [oa, ob] = PTY.stackOff, stacked = t >= sb && t < oa;
  if (t >= sb) bsq += .32 * Math.exp(-5 * (t - sb)) * Math.cos(13 * (t - sb));
  for (const tb of PTY.stackBounce) bsq += .24 * bump(t, tb - .12, tb, tb + .25);
  if (t >= oa - .1) bsq += .14 * bump(t, oa - .1, oa, oa + .12) - .14 * spring(t, oa + .05, 6, 14);
  if (stacked) { blean += .13 * spring(t, sb, 3, 7); bdy = mb.dy * .2; }
  const bo = { who: 'bao', sq: bsq, dy: bdy, dx: mb.dx, lean: blean, rot: brot, face: mb.face, emote: mb.emote, emoteK: mb.emoteK, emoteAge: mb.emoteAge, patch: 1, glitter: null, ...jiggle(t, fb, .12) };
  // Mochi: hops, cheers, and a ride on Bao's head
  let msq = mm.sq, mdy = mm.dy, mlean = mm.lean, mx = MX, my = GY;
  for (const [a, b] of PTY.hopsMochi) { const h = hop(t, a, b, 1.2); msq += h.sq; mdy += h.dy; }
  const top = topOf(BX, bo);
  if (t >= sa - .1 && t < sb) { const h = hop(t, sa, sb, 0), k = ease(seg(t, sa, sb)); mx = lerp(MX, top[0], k); my = lerp(GY, top[1] + .25 * U, k) - 130 * 4 * k * (1 - k) * (t >= sa ? 1 : 0); msq += h.sq; }
  else if (stacked) {
    mx = top[0]; my = top[1] + .25 * U; mlean += -.16 * spring(t, sb + .06, 3, 7); msq += .3 * Math.exp(-6 * (t - sb)) * Math.cos(15 * (t - sb));
    for (const tb of PTY.stackBounce) { const h = hop(t, tb + .06, tb + .38, .7); msq += h.sq; mdy += h.dy; }
    mdy = mdy * .5;
  } else if (t >= oa && t < ob + .6) { const h = hop(t, oa, ob, 0), k = ease(seg(t, oa, ob)); mx = lerp(top[0], MX, k); my = lerp(top[1] + .25 * U, GY, k) - 110 * 4 * k * (1 - k) * (t < ob ? 1 : 0); msq += h.sq; }
  const mo = { who: 'mochi', sq: msq, dy: mdy, dx: mm.dx, lean: mlean, face: mm.face, emote: mm.emote, emoteK: mm.emoteK, emoteAge: mm.emoteAge, bandaid: 1, glitter: null, ...jiggle(t, sb, .1) };
  return { bao: { x: BX, y: GY, o: bo }, mochi: { x: mx, y: my, o: mo } };
}
function partyShot(t, lt) {
  camBegin(960 + 12 * Math.sin(t * .5), 650 + 4 * Math.sin(t * 1.3), 1.16 + .01 * pulse(t, 5));
  room(t, lateSky(t));
  const S = partyState(t);
  glow(960, 330, 700, '#FFF2C4', .35);
  squishy(S.bao.x, S.bao.y, U, S.bao.o);
  squishy(S.mochi.x, S.mochi.y, U, S.mochi.o);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; sparkle(BX + Math.cos(a) * 240, GY - 130 + Math.sin(a) * 150, 34, seg(t, PTY.flip[1] + i * .03, PTY.flip[1] + .6 + i * .03)); }
  confetti(t, CUES.sections.party);
  camEnd();
  grade('soft-light', '#FF9A6B', .4 * seg(t, 35.6, 37.0));
  if (lt < .3) brushWipe(.5 + lt / (MAG.wipe[1] - MAG.wipe[0]), WIPE);
}
function loveState(t, who) {
  const bao = who === 'bao', m = moodAt(t, bao ? BAO_LOVE : MOCHI_LOVE, SQ[who].ph), sgn = bao ? 1 : -1;
  let sq = m.sq, dy = m.dy;
  for (const [a, b] of bao ? LOV.scootBao : LOV.scootMochi) { const h = hop(t, a, b, .55); sq += h.sq; dy += h.dy; }
  const hb = hop(t, LOV.bounce + (bao ? 0 : .1), LOV.bounce + (bao ? .36 : .46), .9); sq += hb.sq; dy += hb.dy;
  const x = (bao ? BX : MX) + sgn * 20 * ease(seg(t, 36.1, 37.1));
  const lean = m.lean * .5 + sgn * .2 * ease(seg(t, LOV.hug - .2, LOV.hug + .2));
  sq += .1 * bump(t, LOV.hug - .1, LOV.hug + .05, LOV.hug + .5);
  return { x, o: { who, sq, dy, dx: m.dx, lean, face: m.face, emote: m.emote, emoteK: m.emoteK, emoteAge: m.emoteAge, patch: bao ? 1 : 0, bandaid: bao ? 0 : 1, glitter: null, ...jiggle(t, LOV.hug, .08) } };
}
function kissHeart(x, y, r, a) {
  if (r < 1 || a <= 0) return;
  ctx.globalAlpha = a; const Hh = heartPts(x, y, r, 44);
  paintShape(Hh, PAL.heart, { tex: .2 }); inkLoop(Hh, Math.max(2, r * .08), PAL.ink);
  paintShape(ellPts(x - r * .38, y - r * .42, r * .16, r * .1, 10, -.6), PAL.white, { tex: 0, edge: 0 });
  ctx.globalAlpha = 1;
}
function loveShot(t, lt) {
  const z = kf(t, [[36, 1.16], [38.5, 1.22], [42.6, 1.24], [44.5, 1.34]]), cy = kf(t, [[36, 650], [38.5, 655], [42.6, 670], [44.5, 720]]);
  camBegin(960 + 8 * Math.sin(t * .5), cy, z);
  room(t, lateSky(t));
  // the heart draws itself round them, then fills with a warm glow
  const hk = ease(seg(t, LOV.heart[0], LOV.heart[1])), HP = heartPts(960, 700, 470, 90);
  if (hk > 0) {
    const fillA = seg(t, LOV.heart[1] - .2, LOV.heart[1] + .4);
    glow(960, 700, 640, '#FFB3CB', .55 * fillA);
    if (fillA > 0) { seed('bigheart'); paintShape(HP, '#FFC2D6', { a: .35 * fillA, tex: .3, edge: 0 }); }
    const ring = [...HP.slice(45), ...HP.slice(0, 46)];   // start drawing from the tip
    seed('heartline'); inkLine(ring, 11, PAL.berry, { cut: hk, t0: .02, t1: .02, min: .8, n: 2 });
  }
  const b = loveState(t, 'bao'), m = loveState(t, 'mochi');
  const ib = squishy(b.x, GY, U, b.o), im = squishy(m.x, GY, U, m.o);
  lettering(CUES.message + ' ♥', 960, 440, 118, ease(seg(t, LOV.write[0], LOV.write[1])));
  if (t > LOV.write[0]) for (let i = 0; i < 5; i++) sparkle(600 + i * 180, 290 + (i % 2) * 70, 30, frac((t - LOV.write[0]) * .7 + i * .21));
  // blown kisses: a heart from each mouth floats up toward the camera
  [ib, im].forEach((inf, j) => {
    const k = seg(t, LOV.kiss + .1 + j * .08, LOV.kiss + 1.0 + j * .08); if (k <= 0 || k >= 1) return;
    const p = arcPt(inf.mouth, [960 + (j ? 300 : -300), 420], 120, easeOut(k));
    kissHeart(p[0], p[1], lerp(34, 180, ease(k)), 1 - seg(k, .75, 1));
  });
  const ctr = toScreen(960, 760);
  camEnd();
  grade('soft-light', '#FF9A6B', .4 * seg(t, 35.6, 37.0)); grade('multiply', '#FFE6D6', .2 * seg(t, 35.6, 37.0));
  // a heart-shaped iris closes on them, holds, and shuts on a sparkle
  if (t > LOV.iris[0]) {
    const r = t < LOV.iris[1] ? lerp(1700, 520, ease(seg(t, LOV.iris[0], LOV.iris[1]))) : t < LOV.shut[0] ? lerp(520, 500, seg(t, LOV.iris[1], LOV.shut[0])) : lerp(500, 0, easeIn(seg(t, LOV.shut[0], LOV.shut[1])));
    seed('iris');
    if (r > 6) irisShape(heartPts(ctr[0], ctr[1] - r * .12, r, 90), IRIS_PINK, 8);
    else { ctx.fillStyle = IRIS_PINK; ctx.fillRect(0, 0, W, H); }
  }
  if (t > LOV.sparkle) {
    const k = seg(t, LOV.sparkle, LOV.sparkle + .35);
    kissHeart(W / 2, H / 2 + 10, 70 * backOut(k), 1);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; sparkle(W / 2 + Math.cos(a) * 150, H / 2 + Math.sin(a) * 120, 34, seg(t, LOV.sparkle + i * .04, LOV.sparkle + .45 + i * .04)); }
  }
}
function arcPt(p0, p1, h, k) { return [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)]; }

shots([[0, deskShot], [CUES.sections.party, partyShot], [CUES.sections.love, loveShot]]);
