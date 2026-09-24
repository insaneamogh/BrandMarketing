'use strict';
// room.js: the one set, a desk in a school therapy room. The room is painted once per boil drawing (three variants
// that cycle, so it lives without re-painting every frame); the sky in the window changes with the story.
const GY = CUES.ground;                               // the squishies sit on the desk here
const M = 260;                                        // margin round the frame so the camera can drift and zoom out
const WIN = { x: 610, y: 205, w: 700, h: 420 };       // the window glass: the sky shows behind their heads
const TABLE = { top: 770, front: 1020, apron: 1150 };

function roomCanvas(v) {
  return cached('room' + v, W + 2 * M, H + 2 * M, () => {
    ctx.translate(M, M);
    // ---- the wall: peach wash, blotches, hand-painted polka dots ----
    ctx.fillStyle = '#F6DBC9'; ctx.fillRect(-M, -M, W + 2 * M, TABLE.top + M + 20);
    for (let i = 0; i < 16; i++) {
      const x = -M + R() * (W + 2 * M), y = -M + R() * (TABLE.top + M), r = 140 + R() * 260;
      watercolor(ellPts(x, y, r, r * (.6 + R() * .5), 10), R() < .5 ? '#F0C8B2' : '#FCEBDD', { layers: 8, alpha: .06, amt: .5 });
    }
    for (let row = 0; row * 105 < TABLE.top + M; row++) {
      for (let col = 0; col * 115 < W + 2 * M; col++) {
        const x = -M + col * 115 + (row % 2) * 57 + jit(6), y = -M + 40 + row * 105 + jit(6);
        paintShape(ellPts(x, y, 8, 8, 10), '#EFC2AC', { a: .75, tex: .25, edge: .25, j: 1.2 });
      }
    }
    const wallShade = ctx.createLinearGradient(0, TABLE.top - 140, 0, TABLE.top);
    wallShade.addColorStop(0, 'rgba(170,110,90,0)'); wallShade.addColorStop(1, 'rgba(170,110,90,.22)');
    ctx.fillStyle = wallShade; ctx.fillRect(-M, TABLE.top - 140, W + 2 * M, 150);

    // ---- the window: cut the glass out (the sky shows through), then the frame, bars and sill ----
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h); ctx.restore();
    const fr = '#FFF3E3', bw = 26;
    paintShape(rectPts(WIN.x - bw, WIN.y - bw, WIN.w + 2 * bw, bw + 2), fr, { tex: .2, smooth: false, j: 1.5 });
    paintShape(rectPts(WIN.x - bw, WIN.y + WIN.h - 2, WIN.w + 2 * bw, bw + 2), fr, { tex: .2, smooth: false, j: 1.5 });
    paintShape(rectPts(WIN.x - bw, WIN.y - bw, bw + 2, WIN.h + 2 * bw), fr, { tex: .2, smooth: false, j: 1.5 });
    paintShape(rectPts(WIN.x + WIN.w - 2, WIN.y - bw, bw + 2, WIN.h + 2 * bw), fr, { tex: .2, smooth: false, j: 1.5 });
    paintShape(rectPts(WIN.x + WIN.w / 2 - 9, WIN.y, 18, WIN.h), fr, { tex: .2, smooth: false, j: 1.2 });
    paintShape(rectPts(WIN.x, WIN.y + WIN.h * .47 - 8, WIN.w, 16), fr, { tex: .2, smooth: false, j: 1.2 });
    const inkA = { a: .85 };
    inkLine([[WIN.x, WIN.y], [WIN.x + WIN.w, WIN.y]], 3.2, PAL.ink, inkA); inkLine([[WIN.x, WIN.y + WIN.h], [WIN.x + WIN.w, WIN.y + WIN.h]], 3.2, PAL.ink, inkA);
    inkLine([[WIN.x, WIN.y], [WIN.x, WIN.y + WIN.h]], 3.2, PAL.ink, inkA); inkLine([[WIN.x + WIN.w, WIN.y], [WIN.x + WIN.w, WIN.y + WIN.h]], 3.2, PAL.ink, inkA);
    inkLine([[WIN.x - bw, WIN.y - bw], [WIN.x + WIN.w + bw, WIN.y - bw]], 3.6, PAL.ink, inkA); inkLine([[WIN.x - bw, WIN.y - bw], [WIN.x - bw, WIN.y + WIN.h + bw]], 3.6, PAL.ink, inkA);
    inkLine([[WIN.x + WIN.w + bw, WIN.y - bw], [WIN.x + WIN.w + bw, WIN.y + WIN.h + bw]], 3.6, PAL.ink, inkA);
    for (const x of [WIN.x + WIN.w / 2 - 9, WIN.x + WIN.w / 2 + 9]) inkLine([[x, WIN.y], [x, WIN.y + WIN.h]], 2.2, PAL.ink, { a: .7 });
    for (const y of [WIN.y + WIN.h * .47 - 8, WIN.y + WIN.h * .47 + 8]) inkLine([[WIN.x, y], [WIN.x + WIN.w, y]], 2.2, PAL.ink, { a: .7 });
    // sill
    const sy = WIN.y + WIN.h + bw;
    paintShape(rectPts(WIN.x - 70, sy - 4, WIN.w + 140, 30), '#FFEBD6', { tex: .25, smooth: false, j: 1.5 });
    inkLine([[WIN.x - 70, sy - 4], [WIN.x + WIN.w + 70, sy - 4]], 3.4, PAL.ink, inkA); inkLine([[WIN.x - 70, sy + 26], [WIN.x + WIN.w + 70, sy + 26]], 3.4, PAL.ink, inkA);
    ctx.fillStyle = 'rgba(160,100,80,.18)'; ctx.fillRect(WIN.x - 64, sy + 27, WIN.w + 128, 16);

    // ---- curtains, gathered by a tie ----
    for (const s of [-1, 1]) {   // s = -1 is the left curtain; "inner" is toward the middle of the window
      const ex = s < 0 ? WIN.x - 20 : WIN.x + WIN.w + 20, top = WIN.y - 50, bot = WIN.y + WIN.h + 110, waist = WIN.y + 290;
      const P = [[ex - s * 95, top], [ex - s * 75, WIN.y + 100], [ex - s * 25, WIN.y + 240], [ex - s * 10, waist], [ex - s * 30, WIN.y + 380],
                 [ex - s * 65, bot], [ex + s * 85, bot], [ex + s * 60, WIN.y + 380], [ex + s * 55, waist], [ex + s * 70, WIN.y + 150], [ex + s * 80, top]];
      paintShape(P, '#F4A6BC', { tex: .35, edge: .35 });
      for (let k = 0; k < 4; k++) {
        const f = (k + .5) / 4, xt = lerp(ex + s * 80, ex - s * 95, f), xw = lerp(ex + s * 55, ex - s * 10, f), xb = lerp(ex + s * 85, ex - s * 65, f);
        inkLine([[xt, top + 12], [lerp(xt, xw, .6), WIN.y + 190], [xw, waist - 14]], 2.4, '#D9819C', { a: .8 });
        inkLine([[xw, waist + 14], [lerp(xw, xb, .5), WIN.y + 420], [xb, bot - 8]], 2.4, '#D9819C', { a: .8 });
      }
      inkLoop(P, 3, PAL.ink, { a: .85 });
      const tie = rrPts(ex + s * 22 - 52, waist - 14, 104, 28, 12);
      paintShape(tie, '#FFD27A', { tex: .3 }); inkLoop(tie, 2.6, PAL.ink);
    }
    inkLine([[WIN.x - 150, WIN.y - 56], [WIN.x + WIN.w + 150, WIN.y - 56]], 11, '#A0714F', { t0: .02, t1: .02, min: .9 });
    for (const x of [WIN.x - 150, WIN.x + WIN.w + 150]) { paintShape(ellPts(x, WIN.y - 56, 13, 13, 10), '#A0714F', { tex: .3 }); inkLoop(ellPts(x, WIN.y - 56, 13, 13, 10), 2.5, PAL.ink); }

    // ---- the feelings-faces poster ----
    ctx.save(); ctx.translate(330, 400); ctx.rotate(-.035);
    paintShape(rectPts(-150, -165, 300, 330), '#FFFBF3', { tex: .25, smooth: false, j: 1.5 });
    inkLoop(rectPts(-150, -165, 300, 330), 3, PAL.ink, { raw: true, a: .85 });
    const faces = [[-68, -72, '#FFD66B', 'happy'], [68, -72, '#8EC5F0', 'sad'], [-68, 72, '#FF9A8A', 'cross'], [68, 72, '#A7DDA8', 'calm']];
    for (const [fx, fy, c, k] of faces) {
      paintShape(ellPts(fx, fy, 54, 54, 24), c, { tex: .3 }); inkLoop(ellPts(fx, fy, 54, 54, 24), 3, PAL.ink);
      if (k === 'calm') { inkLine([[fx - 26, fy - 10], [fx - 16, fy - 4], [fx - 6, fy - 10]], 4); inkLine([[fx + 6, fy - 10], [fx + 16, fy - 4], [fx + 26, fy - 10]], 4); }
      else { paintShape(ellPts(fx - 17, fy - 10, 6, 8, 10), PAL.ink, { tex: 0 }); paintShape(ellPts(fx + 17, fy - 10, 6, 8, 10), PAL.ink, { tex: 0 }); }
      if (k === 'happy' || k === 'calm') inkLine([[fx - 20, fy + 14], [fx, fy + 26], [fx + 20, fy + 14]], 4);
      if (k === 'sad') { inkLine([[fx - 18, fy + 26], [fx, fy + 16], [fx + 18, fy + 26]], 4); paintShape([[fx + 22, fy - 2], [fx + 16, fy + 12], [fx + 22, fy + 16], [fx + 28, fy + 12]], '#5FA8E6', { tex: 0 }); }
      if (k === 'cross') { inkLine([[fx - 20, fy + 22], [fx + 20, fy + 20]], 4); inkLine([[fx - 30, fy - 30], [fx - 8, fy - 20]], 3.6); inkLine([[fx + 30, fy - 30], [fx + 8, fy - 20]], 3.6); }
    }
    for (const [tx, ty, r] of [[-150, -165, -.6], [150, -165, .6]]) paintShape(rectPts(-30, -10, 60, 20).map(([x, y]) => [tx + x * Math.cos(r) - y * Math.sin(r), ty + x * Math.sin(r) + y * Math.cos(r)]), '#9FD6D0', { a: .8, tex: .2, smooth: false });
    ctx.restore();

    // ---- the cork board with kids' drawings ----
    paintShape(rectPts(1460, 260, 320, 250), '#B98556', { tex: .3, smooth: false, j: 1.5 });
    paintShape(rectPts(1476, 276, 288, 218), '#DDAE78', { tex: .5, smooth: false, j: 1.5 });
    for (let i = 0; i < 90; i++) { ctx.fillStyle = 'rgba(140,90,50,.35)'; ctx.fillRect(1480 + R() * 280, 280 + R() * 210, 2, 2); }
    inkLoop(rectPts(1460, 260, 320, 250), 3, PAL.ink, { raw: true, a: .85 });
    // a sun drawing
    ctx.save(); ctx.translate(1545, 352); ctx.rotate(-.08);
    paintShape(rectPts(-55, -62, 110, 124), '#FFFDF7', { tex: .15, smooth: false, j: 1.2 });
    paintShape(ellPts(0, 0, 22, 22, 14), '#FFC94D', { tex: .4, j: 2 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; inkLine([[Math.cos(a) * 30, Math.sin(a) * 30], [Math.cos(a) * 44, Math.sin(a) * 44]], 4, '#F2A541'); }
    ctx.restore();
    // a heart drawing
    ctx.save(); ctx.translate(1690, 390); ctx.rotate(.07);
    paintShape(rectPts(-55, -62, 110, 124), '#FFFDF7', { tex: .15, smooth: false, j: 1.2 });
    paintShape(heartPts(0, 0, 34, 40), '#FF7FA3', { tex: .4, j: 2 }); inkLoop(heartPts(0, 0, 34, 40), 2.6, '#D84F7A');
    ctx.restore();
    for (const [px, py] of [[1545, 295], [1690, 333]]) { paintShape(ellPts(px, py, 7, 7, 8), '#E0525E', { tex: 0 }); inkLoop(ellPts(px, py, 7, 7, 8), 2, PAL.ink); }

    // ---- the desk ----
    ctx.fillStyle = '#EDC39A'; ctx.fillRect(-M, TABLE.top, W + 2 * M, TABLE.front - TABLE.top);
    for (let i = 0; i < 10; i++) {
      const x = -M + R() * (W + 2 * M), y = TABLE.top + R() * 230;
      watercolor(ellPts(x, y, 260 + R() * 300, 30 + R() * 40, 10), R() < .6 ? '#E2AD7E' : '#F6D3AE', { layers: 8, alpha: .07, amt: .5 });
    }
    for (let i = 0; i < 13; i++) {
      const y = TABLE.top + 18 + i * 19 + jit(4), P = [];
      for (let k = 0; k <= 12; k++) P.push([-M + k * (W + 2 * M) / 12, y + Math.sin(k * .8 + i) * 5 + jit(2)]);
      inkLine(P, 1.6 + R() * 1.6, '#C99468', { a: .45, t0: .05, t1: .05 });
    }
    for (const [kx, ky] of [[430, 960], [1330, 920], [1700, 985]]) { inkLoop(ellPts(kx, ky, 26, 8, 14), 2, '#B98256', { a: .6 }); inkLoop(ellPts(kx, ky, 12, 4, 10), 1.6, '#B98256', { a: .6 }); }
    const back = ctx.createLinearGradient(0, TABLE.top, 0, TABLE.top + 40);
    back.addColorStop(0, 'rgba(150,90,60,.35)'); back.addColorStop(1, 'rgba(150,90,60,0)');
    ctx.fillStyle = back; ctx.fillRect(-M, TABLE.top, W + 2 * M, 40);
    inkLine([[-M, TABLE.top], [W / 2, TABLE.top + 2], [W + M, TABLE.top]], 3.4, PAL.ink, { a: .85, t0: .01, t1: .01 });
    paintShape(rectPts(-M - 20, TABLE.front, W + 2 * M + 40, TABLE.apron - TABLE.front), '#C98E5E', { tex: .4, smooth: false, j: 2 });
    inkLine([[-M, TABLE.front], [W + M, TABLE.front]], 4, PAL.ink, { a: .9, t0: .01, t1: .01 });
    ctx.fillStyle = '#7C5A4A'; ctx.fillRect(-M, TABLE.apron, W + 2 * M, H + M - TABLE.apron);
    inkLine([[-M, TABLE.apron], [W + M, TABLE.apron]], 4, PAL.ink, { a: .9, t0: .01, t1: .01 });

    // ---- things on the desk ----
    const books = [[110, 816, 290, 44, '#7FB8D8'], [132, 776, 250, 40, '#F2A7B6'], [120, 742, 238, 34, '#FFD27A']];
    for (const [x, y, w, h, c] of books) {
      paintShape(rrPts(x, y, w, h, 7), c, { tex: .35 });
      paintShape(rectPts(x + w - 26, y + 5, 20, h - 10), '#FFF7EA', { tex: .1, smooth: false, j: 1 });
      for (let k = 1; k < 4; k++) inkLine([[x + w - 24, y + 5 + k * (h - 10) / 4], [x + w - 8, y + 5 + k * (h - 10) / 4]], 1.2, '#C8B8A8');
      inkLine([[x + 30, y + h * .3], [x + 30, y + h * .7]], 3, mix(c, PAL.ink, .35));
      inkLoop(rrPts(x, y, w, h, 7), 2.8, PAL.ink);
    }
    // pencil cup
    const pens = [[422, 690, '#FF8A7A', -.2], [448, 676, '#8EC5F0', .05], [472, 694, '#9FD9A0', .22]];
    for (const [px, py, c, r] of pens) {
      const tip = [px + Math.sin(r) * -8, py - 28], base = [px + Math.sin(r) * 60, py + 120];
      inkLine([base, [px, py]], 13, c, { t0: .01, t1: .01, min: .95 });
      paintShape([[px - 6, py], [px + 6, py], tip], '#F6D9B3', { tex: 0, smooth: false }); inkLoop([[px - 6, py], [px + 6, py], tip], 1.6, PAL.ink, { raw: true });
    }
    const cup = [[406, 770], [496, 770], [490, 858], [412, 858]];
    paintShape(cup, '#A6D8C8', { tex: .4, smooth: false, j: 1.2 }); inkLoop(cup, 3, PAL.ink, { raw: true });
    for (let k = 0; k < 3; k++) inkLine([[416, 790 + k * 22], [486, 790 + k * 22]], 2, '#7FBFA9', { a: .8 });
    // tissue box (it's a therapy room)
    const top = [[1474, 790], [1646, 790], [1632, 772], [1488, 772]];
    paintShape(top, '#D8F0F8', { tex: .3, smooth: false, j: 1.2 }); inkLoop(top, 2.6, PAL.ink, { raw: true });
    paintShape(rectPts(1474, 790, 172, 80), '#9ED4EA', { tex: .4, smooth: false, j: 1.5 });
    for (let k = 0; k < 6; k++) paintShape(heartPts(1494 + k * 28, 830 + (k % 2) * 16, 7, 20), '#FFFFFF', { a: .8, tex: 0 });
    inkLoop(rectPts(1474, 790, 172, 80), 2.8, PAL.ink, { raw: true });
    const tis = [[1530, 778], [1520, 740], [1542, 712], [1558, 730], [1576, 700], [1592, 736], [1586, 778]];
    paintShape(tis, '#FFFFFF', { tex: .1 }); inkLoop(tis, 2.2, PAL.ink);
    inkLine([[1550, 772], [1556, 736]], 1.4, '#C9D6DE');
    // plant
    const pot = [[1696, 790], [1828, 790], [1810, 872], [1714, 872]];
    const leaves = [[-50, -.9, 60], [-25, -.45, 88], [0, 0, 108], [25, .45, 90], [50, .9, 62], [-10, -.2, 70], [14, .25, 74]];
    for (const [ox, a, len] of leaves) {
      const bx = 1762 + ox * .4, by = 792, tx = bx + Math.sin(a) * len * 1.3, ty = by - Math.cos(a) * len * 1.3;
      const L = [[bx, by], [lerp(bx, tx, .5) - Math.cos(a) * 22, lerp(by, ty, .5) - Math.sin(a) * 22], [tx, ty], [lerp(bx, tx, .5) + Math.cos(a) * 22, lerp(by, ty, .5) + Math.sin(a) * 22]];
      paintShape(L, R() < .5 ? '#7DBF8E' : '#62AA79', { tex: .35 }); inkLoop(L, 2.4, PAL.ink);
      inkLine([[bx, by], [lerp(bx, tx, .8), lerp(by, ty, .8)]], 1.6, '#4E8F62', { a: .7 });
    }
    paintShape(pot, '#E48B6B', { tex: .4, smooth: false, j: 1.5 }); inkLoop(pot, 3, PAL.ink, { raw: true });
    paintShape(rectPts(1688, 780, 148, 22), '#D57A5C', { tex: .4, smooth: false, j: 1.2 }); inkLoop(rectPts(1688, 780, 148, 22), 2.6, PAL.ink, { raw: true });
    // contact shadows under the props
    ctx.fillStyle = 'rgba(140,85,60,.18)';
    for (const [x, w] of [[255, 170], [451, 55], [1560, 100], [1762, 80]]) { ctx.beginPath(); ctx.ellipse(x, 868, w, 9, 0, 0, TAU); ctx.fill(); }
  });
}

// ---------- the sky in the window ----------
function skyCanvas(kind, v) {
  const w = WIN.w + 40, h = WIN.h + 40;
  return cached('sky' + kind + v, w, h, () => {
    const grad = (stops) => { const g = ctx.createLinearGradient(0, 0, 0, h); stops.forEach(([s, c]) => g.addColorStop(s, c)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };
    const clouds = (col, n, y0, y1, a = .09) => { for (let i = 0; i < n; i++) { const x = R() * w, y = y0 + R() * (y1 - y0), r = 60 + R() * 70; watercolor(ellPts(x, y, r, r * .45, 10), col, { layers: 10, alpha: a, amt: .45, step: 40 }); } };
    if (kind === 'day' || kind === 'rainbow') {
      grad([[0, '#86C6F0'], [1, '#DDF3FF']]);
      glow(w * .82, h * .15, 170, '#FFF1B8', .9);
      if (kind === 'rainbow') {
        const cols = ['#FF8A8A', '#FFB86B', '#FFE27A', '#9FE0A0', '#8EC8F5', '#B79BF0'];
        cols.forEach((c, i) => { const r = 330 - i * 17, P = []; for (let k = 0; k <= 24; k++) { const a = Math.PI + k / 24 * Math.PI; P.push([w * .5 + Math.cos(a) * r, h * 1.02 + Math.sin(a) * r * .95]); } inkLine(P, 19, c, { a: .75, t0: .08, t1: .08, j: 1.5 }); });
      }
      clouds('#FFFFFF', 5, h * .15, h * .7, .12);
      if (kind === 'rainbow') { watercolor(ellPts(w * .5 - 330, h * .98, 90, 40, 10), '#FFFFFF', { layers: 12, alpha: .2, step: 30 }); watercolor(ellPts(w * .5 + 330, h * .98, 90, 40, 10), '#FFFFFF', { layers: 12, alpha: .2, step: 30 }); }
    } else if (kind === 'rain') {
      grad([[0, '#6C7C98'], [1, '#A9B7CC']]);
      clouds('#56627A', 7, 0, h * .45, .12);
      clouds('#8391A8', 4, h * .4, h * .8, .08);
    } else if (kind === 'magic') {
      grad([[0, '#2A2152'], [.6, '#5B3C94'], [1, '#9C6CC8']]);
      clouds('#C38BE8', 4, h * .3, h * .9, .06);
      for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h * .8, r = 1.5 + R() * 2.5; ctx.fillStyle = '#FFF6D8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    } else if (kind === 'sunset') {
      grad([[0, '#7E67C4'], [.45, '#F58FA8'], [1, '#FFCB8C']]);
      glow(w * .6, h * .78, 220, '#FFE3A0', 1);
      paintShape(ellPts(w * .6, h * .8, 62, 62, 24), '#FFE6A6', { tex: .2, edge: 0 });
      clouds('#F7A4C0', 5, h * .25, h * .6, .1);
      clouds('#B98AD6', 3, h * .05, h * .3, .08);
    }
  });
}
function room(t, sky) {
  const v = BOILN % 3;
  ctx.save(); ctx.beginPath(); ctx.rect(WIN.x - 4, WIN.y - 4, WIN.w + 8, WIN.h + 8); ctx.clip();
  let sum = 0;
  for (const k of ['day', 'rain', 'magic', 'rainbow', 'sunset']) {
    const a = sky[k] || 0; if (a <= .002) continue;
    sum += a; ctx.globalAlpha = a / sum; ctx.drawImage(skyCanvas(k, v), WIN.x - 20, WIN.y - 20);
  }
  ctx.globalAlpha = 1;
  if (sky.rain > .01) {   // rain on the glass
    ctx.strokeStyle = rgba('#E6EEF8', .55 * sky.rain); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = WIN.x + hash(i) * (WIN.w + 60), y = WIN.y - 40 + frac(hash(i + 50) + t * (1.3 + hash(i + 9) * .6)) * (WIN.h + 80);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 30); ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {   // drops running down the pane
      const x = WIN.x + 20 + hash(i + 200) * (WIN.w - 40), y = WIN.y + frac(hash(i + 300) + t * .12 * (1 + hash(i))) * WIN.h;
      ctx.fillStyle = rgba('#F2F7FF', .7 * sky.rain); ctx.beginPath(); ctx.ellipse(x, y, 3.5, 5, 0, 0, TAU); ctx.fill();
    }
  }
  if (sky.magic > .01) {   // twinkling stars
    for (let i = 0; i < 18; i++) {
      const x = WIN.x + hash(i + 400) * WIN.w, y = WIN.y + hash(i + 500) * WIN.h * .75, tw = .5 + .5 * Math.sin(t * (2 + 3 * hash(i + 600)) + i);
      ctx.globalAlpha = sky.magic * tw; ctx.fillStyle = '#FFF4C8'; ctx.beginPath(); poly(starPts(x, y, 5 + 5 * tw, .3, 4)); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.drawImage(roomCanvas(v), -M, -M);
}
