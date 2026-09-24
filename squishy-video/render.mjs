// render.mjs: paints studio.html in headless Chromium (Playwright) and encodes the frames with ffmpeg.
//
//   Look at it:
//     node render.mjs --sheet=1,4.2,10.4 [--cols=3] [--w=640] [--crop=x,y,w,h] --out=out/check/a.jpg   chosen times
//     node render.mjs --strip=10.2:10.8 [--cols=6] [--w=320] --out=out/check/strip.jpg                every frame
//   Make the video:
//     node render.mjs --frames [--fresh] [--range=a:b] [--workers=4]   JPEG frames into out/frames (parallel, resumable;
//                                                                       --fresh clears old frames after the scenes change)
//     node render.mjs --encode [--audio=out/soundtrack.wav] [--out=out/squishy.mp4] [--crf=18] [--width=1280]
//
// Needs Playwright (npm i -D playwright, or a global install on NODE_PATH) and ffmpeg (on PATH, or FFMPEG=<path>).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const FPS = 24, FRAMES = 'out/frames', FFMPEG = process.env.FFMPEG || 'ffmpeg';
const nums = s => String(s).split(/[,:]/).map(Number);
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(`${cmd} exited ${c}`)) : ok()); });

if (args.encode) {
  const n = readdirSync(FRAMES).filter(f => f.endsWith('.jpg')).length, out = args.out || 'out/squishy.mp4', audio = args.audio;
  mkdirSync(dirname(out), { recursive: true });
  console.log(`encoding ${n} frames → ${out}${audio ? ' with ' + audio : ''}`);
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-nostats', '-framerate', String(FPS), '-i', `${FRAMES}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    ...(args.width ? ['-vf', `scale=${args.width}:-2:flags=lanczos`] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 18), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
async function openPage(tag = '') {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(pathToFileURL(resolve('studio.html')).href + '?render');
  await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
  return page;
}
const frameAt = async (page, t) => { const url = await page.evaluate(t => window.renderAt(t), t); return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'); };

if (args.sheet || args.strip) {
  const page = await openPage(), out = args.out || 'out/check/sheet.jpg'; mkdirSync(dirname(out), { recursive: true });
  let ts;
  if (args.strip) { const [a, b] = nums(args.strip); ts = []; for (let i = Math.round(a * FPS); i <= Math.round(b * FPS); i++) ts.push(i / FPS); }
  else ts = nums(args.sheet);
  const { url, ms } = await page.evaluate(([ts, c, w, crop]) => window.renderSheet(ts, c, w, crop), [ts, +(args.cols || (args.strip ? 6 : 3)), +(args.w || (args.strip ? 320 : 640)), args.crop ? nums(args.crop) : null]);
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`${out}  (${ts.length} frames)  ms/frame: ${ms.join(' ')}`);
} else if (args.frames) {
  const probe = await openPage(), dur = await probe.evaluate(() => DUR); await probe.close();
  const [a, b] = args.range ? nums(args.range) : [0, dur], workers = +(args.workers || 4);
  if (args.fresh) rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  const first = Math.round(a * FPS), last = Math.min(Math.round(dur * FPS) - 1, Math.round(b * FPS) - 1), todo = [];
  for (let i = first; i <= last; i++) { const f = `${FRAMES}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`${todo.length} frames to paint (${last - first + 1 - todo.length} already done), ${workers} workers`);
  let next = 0, done = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < todo.length) {
      const i = todo[next++], f = `${FRAMES}/f${String(i).padStart(5, '0')}.jpg`;
      writeFileSync(f + '.tmp', await frameAt(page, i / FPS)); renameSync(f + '.tmp', f);
      if (++done % 48 === 0 || done === todo.length) { const el = (Date.now() - start) / 1000; console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`); }
    }
  }));
} else {
  console.log('nothing to do: see the usage notes at the top of render.mjs');
}
await browser.close();
