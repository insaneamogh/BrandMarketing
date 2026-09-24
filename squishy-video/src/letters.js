'use strict';
// letters.js: hand-painted lettering. Each lowercase letter is a few brush strokes (in a box 1 unit tall: 0 is the top
// of the tall letters, .42 the top of the short ones, 1 the baseline, 1.36 the bottom of the tails), so the words
// paint themselves on stroke by stroke. Doubled points make sharp corners.
const BOWL = [[.55, .52], [.38, .42], [.16, .5], [.08, .72], [.18, .95], [.38, .99], [.55, .84]];
const GL = {
  a: { w: .68, s: [BOWL, [[.57, .43], [.57, .86], [.63, 1.0]]] },
  b: { w: .66, s: [[[.1, 0], [.1, 1]], [[.1, .62], [.3, .44], [.5, .48], [.6, .7], [.52, .93], [.3, 1.0], [.1, .92]]] },
  c: { w: .6, s: [[[.54, .5], [.38, .42], [.16, .49], [.08, .72], [.18, .94], [.38, 1.0], [.56, .9]]] },
  d: { w: .68, s: [BOWL, [[.57, 0], [.57, .86], [.63, 1.0]]] },
  e: { w: .64, s: [[[.1, .72], [.52, .7], [.5, .52], [.33, .42], [.13, .5], [.08, .74], [.2, .95], [.42, 1.0], [.58, .9]]] },
  f: { w: .5, s: [[[.52, .08], [.4, 0], [.26, .05], [.22, .22], [.22, 1.0]], [[.04, .44], [.46, .44]]] },
  g: { w: .68, s: [BOWL, [[.57, .43], [.57, 1.14], [.46, 1.32], [.24, 1.34], [.08, 1.24]]] },
  h: { w: .68, s: [[[.1, 0], [.1, 1]], [[.1, .63], [.28, .45], [.46, .44], [.56, .58], [.56, 1.0]]] },
  i: { w: .3, s: [[[.15, .44], [.15, 1]], [[.15, .2], [.16, .23]]] },
  j: { w: .4, s: [[[.28, .44], [.28, 1.16], [.18, 1.32], [.02, 1.28]], [[.28, .2], [.29, .23]]] },
  k: { w: .6, s: [[[.1, 0], [.1, 1]], [[.5, .44], [.1, .76]], [[.25, .65], [.55, 1.0]]] },
  l: { w: .32, s: [[[.14, 0], [.14, .88], [.22, 1.0], [.28, .98]]] },
  m: { w: .9, s: [[[.08, .44], [.08, 1]], [[.08, .6], [.22, .44], [.38, .47], [.43, .6], [.43, 1.0]], [[.43, .6], [.57, .44], [.73, .47], [.78, .6], [.78, 1.0]]] },
  n: { w: .68, s: [[[.1, .44], [.1, 1]], [[.1, .63], [.28, .45], [.46, .44], [.56, .58], [.56, 1.0]]] },
  o: { w: .68, s: [[[.36, .42], [.14, .5], [.07, .72], [.18, .95], [.38, 1.0], [.57, .9], [.62, .68], [.52, .47], [.36, .42], [.28, .45]]] },
  p: { w: .66, s: [[[.1, .44], [.1, 1.36]], [[.1, .62], [.3, .44], [.5, .48], [.6, .7], [.52, .93], [.3, 1.0], [.1, .92]]] },
  q: { w: .68, s: [BOWL, [[.57, .43], [.57, 1.36], [.66, 1.28]]] },
  r: { w: .52, s: [[[.1, .44], [.1, 1]], [[.1, .66], [.24, .48], [.4, .43], [.5, .47]]] },
  s: { w: .58, s: [[[.5, .5], [.34, .42], [.14, .47], [.12, .6], [.3, .7], [.46, .78], [.5, .9], [.34, 1.0], [.08, .95]]] },
  t: { w: .5, s: [[[.24, .12], [.24, .88], [.34, 1.0], [.46, .96]], [[.04, .44], [.46, .44]]] },
  u: { w: .68, s: [[[.1, .44], [.1, .82], [.2, .98], [.38, 1.0], [.52, .9], [.56, .76]], [[.56, .44], [.56, 1.0]]] },
  v: { w: .62, s: [[[.05, .44], [.31, 1.0], [.31, 1.0], [.57, .44]]] },
  w: { w: .86, s: [[[.04, .44], [.22, 1.0], [.22, 1.0], [.43, .56], [.43, .56], [.64, 1.0], [.64, 1.0], [.82, .44]]] },
  x: { w: .62, s: [[[.07, .44], [.55, 1.0]], [[.55, .44], [.07, 1.0]]] },
  y: { w: .62, s: [[[.05, .44], [.31, .96]], [[.57, .44], [.3, 1.12], [.2, 1.3], [.04, 1.32]]] },
  z: { w: .62, s: [[[.07, .44], [.55, .44], [.55, .44], [.07, 1.0], [.07, 1.0], [.56, 1.0]]] },
  '!': { w: .32, s: [[[.16, 0], [.15, .7]], [[.15, .94], [.16, .97]]] },
  "'": { w: .24, s: [[[.13, 0], [.1, .24]]] },
  '.': { w: .26, s: [[[.12, .95], [.13, .98]]] },
  ',': { w: .26, s: [[[.14, .92], [.1, 1.12]]] },
  '?': { w: .56, s: [[[.08, .18], [.2, .03], [.4, 0], [.52, .14], [.46, .34], [.28, .48], [.27, .68]], [[.27, .94], [.28, .97]]] },
  ' ': { w: .34, s: [] },
  '♥': { w: .95, heart: true },
};
const INKS = ['#FF5C8A', '#FF8A5C', '#B77BEA', '#3FB3C4'];

// Lay the text out: every stroke in pixels, with where it starts and ends in the write-on (0..1).
function layoutLetters(txt, cx, by, size) {
  const chars = [...txt.toLowerCase()].map(c => GL[c] ? c : ' '), track = size * .07;
  let wsum = 0; chars.forEach((c, i) => { wsum += GL[c].w * size + (i < chars.length - 1 ? track : 0); });
  let x = cx - wsum / 2; const glyphs = [];
  let total = 0;
  chars.forEach((c, i) => {
    const g = GL[c], strokes = [];
    if (g.heart) { strokes.push({ heart: true, len: size * .9 }); total += size * .9; }
    else for (const s of g.s) {
      const P = s.map(([u, v]) => [x + u * size, by - size + v * size]);
      const len = Math.max(pathLen(P), size * .08); strokes.push({ P, len, dot: pathLen(P) < size * .08 }); total += len + size * .15;
    }
    glyphs.push({ c, x, w: g.w * size, strokes, i });
    x += g.w * size + track;
  });
  let acc = 0;
  for (const g of glyphs) for (const s of g.strokes) { s.a = acc / total; acc += s.len + (s.heart ? 0 : size * .15); s.b = (acc - (s.heart ? 0 : size * .15)) / total; }
  for (const g of glyphs) { g.a = g.strokes.length ? g.strokes[0].a : 1; g.b = g.strokes.length ? g.strokes[g.strokes.length - 1].b : 1; }
  return glyphs;
}
// Paint the text centred on cx with its baseline at `by`, written on as p goes 0 → 1.
function lettering(txt, cx, by, size, p) {
  if (p <= 0) return;
  const glyphs = layoutLetters(txt, cx, by, size), w = size * .135;
  for (const g of glyphs) {
    if (!g.strokes.length || p < g.a) continue;
    const pop = backOut(clamp((p - g.a) / Math.max(.02, (g.b - g.a) * .8))), col = INKS[g.i % INKS.length];
    const gx = g.x + g.w / 2, gy = by - size * .35, rot = (hash(g.i * 7.3) - .5) * .16, bob = Math.sin(T * 4 + g.i * .9) * size * .018;
    ctx.save(); ctx.translate(gx, gy + bob); ctx.rotate(rot); ctx.scale(.75 + .25 * pop, .75 + .25 * pop); ctx.translate(-gx, -gy);
    seed('glyph' + g.i);
    for (const s of g.strokes) {
      const k = clamp((p - s.a) / Math.max(1e-4, s.b - s.a)); if (k <= 0) continue;
      if (s.heart) {
        const Hh = heartPts(gx, by - size * .46, size * .38 * backOut(k), 44);
        paintShape(Hh.map(q => [q[0] + size * .035, q[1] + size * .05]), PAL.ink, { tex: 0, edge: 0 });
        paintShape(Hh, PAL.heart, { tex: .2, edge: 0 }); inkLoop(Hh, w * .3, PAL.ink);
        paintShape(ellPts(gx - size * .14, by - size * .6, size * .07, size * .045, 10, -.6), PAL.white, { tex: 0, edge: 0 });
        continue;
      }
      if (s.dot) {
        const [x, y] = s.P[0], r = w * .62 * backOut(k);
        paintShape(ellPts(x + size * .03, y + size * .045, r, r, 12), PAL.ink, { tex: 0, edge: 0 });
        paintShape(ellPts(x, y, r, r, 12), col, { tex: .2, edge: 0 });
        continue;
      }
      inkLine(s.P.map(q => [q[0] + size * .03, q[1] + size * .045]), w * 1.12, PAL.ink, { cut: k, t0: .04, t1: .06, min: .75, n: 5 });
      inkLine(s.P, w, col, { cut: k, t0: .04, t1: .06, min: .75, n: 5 });
      inkLine(s.P.map(q => [q[0] - w * .16, q[1] - w * .2]), w * .28, PAL.white, { cut: k, a: .6, t0: .3, t1: .3, n: 5 });
    }
    ctx.restore();
  }
}
