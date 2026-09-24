# The Squishy Comeback

A 45-second hand-painted cartoon with its own soundtrack. Two dumpling squishies get squeezed until they pop, their
glitter heals them, and they bounce back to say "we're okay!". The finished video is
[`dist/squishy-comeback.mp4`](dist/squishy-comeback.mp4) (720p, with sound).

The story, shot by shot with its timing, is in [STORYBOARD.md](STORYBOARD.md).

## How it's made

| Part | Tech | Files |
|---|---|---|
| Timing | One cue sheet read by both the picture and the sound, so every boing lands on its frame | [`src/cues.js`](src/cues.js) |
| Picture | Canvas 2D, painted frame by frame: tapered brush lines that "boil" 12 times a second, watercolour washes, pigment grain and paper texture | [`src/engine.js`](src/engine.js), [`src/room.js`](src/room.js), [`src/squishy.js`](src/squishy.js), [`src/letters.js`](src/letters.js), [`src/scenes.js`](src/scenes.js) |
| Rendering | Headless Chromium (Playwright) paints the frames in parallel; ffmpeg encodes them | [`render.mjs`](render.mjs), [`studio.html`](studio.html) |
| Sound | Python (numpy, scipy): a synthesized kalimba, plucked ukulele, music box, bells, pads and drums, plus every sound effect | [`audio/soundtrack.py`](audio/soundtrack.py) |

Every frame is a pure function of time, so frames render out of order on several workers. A full render takes under a
minute.

## Run it

You need Node.js, Python 3 with numpy and scipy, and ffmpeg. Playwright can be installed locally with `npm install`,
or used from a global install via `NODE_PATH="$(npm root -g)"`.

```bash
npm install                  # Playwright, which brings its own Chromium
python3 audio/soundtrack.py  # → out/soundtrack.wav
npm run frames               # → out/frames/*.jpg
npm run video                # → out/squishy.mp4 (1080p)
npm run share                # → out/squishy-720p.mp4 (small enough for WhatsApp)
```

Open `studio.html` in a browser to scrub through the film (`studio.html?t=10.4` jumps to the pop). To check a moment
without rendering everything, make a contact sheet:

```bash
node render.mjs --sheet=4.2,10.4,23.6 --out=out/check/sheet.jpg
node render.mjs --strip=10.2:10.8 --out=out/check/pop.jpg      # every frame of the pop
```

## Change the message

The painted words at the end come from `"message"` in [`src/cues.js`](src/cues.js). Lowercase letters, spaces and
`! ' . , ?` are supported. Change it, then run `npm run frames` and `npm run video` again.
