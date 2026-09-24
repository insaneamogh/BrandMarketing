// cues.js: the shared clock. The picture (scenes.js) and the soundtrack (audio/soundtrack.py) both read these times,
// so every hop, squeeze and pop lands on its sound. Keep everything between the outer braces strict JSON (double
// quotes, no trailing commas, no comments): Python parses it.
const CUES = {
  "bpm": 100,
  "duration": 45.6,
  "message": "we're okay!",
  "ground": 880,
  "sections": { "play": 0, "squeeze": 7.2, "sad": 12.0, "magic": 19.2, "party": 26.4, "love": 36.0 },
  "play": {
    "iris": [0.0, 0.8],
    "hopsBao": [[1.2, 1.5], [2.4, 2.7]],
    "hopsMochi": [[1.8, 2.1], [3.0, 3.3]],
    "windup": 3.6,
    "bump": 4.2,
    "bumpBack": 5.4,
    "giggles": [4.85, 5.85, 6.45]
  },
  "squeeze": {
    "stop": 7.2,
    "handsIn": [7.6, 8.2],
    "push": [8.2, 8.6],
    "presses": [8.6, 9.2, 9.8],
    "tremble": [10.0, 10.4],
    "pop": 10.4,
    "handsOut": [11.2, 12.0]
  },
  "sad": {
    "seeSelf": 12.9,
    "tearyBao": 13.4,
    "tearyMochi": 13.7,
    "cry": 14.1,
    "scoot": [15.6, 16.6],
    "sniffles": [14.6, 15.3, 16.0, 17.2, 18.3]
  },
  "magic": {
    "glints": [19.2, 19.9],
    "lift": 20.4,
    "stream": [21.6, 23.2],
    "bandaid": 22.7,
    "patch": 23.2,
    "boings": [23.6, 24.0],
    "starstruck": 25.0,
    "wipe": [26.1, 26.7]
  },
  "party": {
    "hopsBao": [[27.0, 27.36], [28.2, 28.56], [34.8, 35.16], [35.4, 35.76]],
    "hopsMochi": [[27.6, 27.96], [28.8, 29.16], [35.1, 35.46]],
    "flip": [29.4, 30.0],
    "stackOn": [30.6, 31.2],
    "stackBounce": [32.4, 33.0],
    "stackOff": [33.6, 34.2]
  },
  "love": {
    "scootBao": [[36.1, 36.35], [36.6, 36.85]],
    "scootMochi": [[36.35, 36.6], [36.85, 37.1]],
    "hug": 37.2,
    "heart": [37.8, 38.5],
    "write": [38.5, 40.7],
    "loveEyes": 39.8,
    "kiss": 41.6,
    "iris": [42.6, 43.2],
    "bounce": 43.6,
    "shut": [44.5, 45.1],
    "sparkle": 45.1
  }
};
