#!/usr/bin/env python3
"""soundtrack.py: the music and sound effects for the squishy video, synthesized from scratch with numpy and scipy.

Every sound is placed at a time read from src/cues.js, the same cues the picture uses, so hops, squeezes and the pop
land on their frames. Writes a 44.1 kHz stereo WAV.

    python3 audio/soundtrack.py [--out out/soundtrack.wav]
"""
import argparse
import json
import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
_txt = (ROOT / 'src' / 'cues.js').read_text()
CUES = json.loads(_txt[_txt.index('{'): _txt.rindex('}') + 1])
DUR, BEAT = CUES['duration'], 60 / CUES['bpm']
BAR = 4 * BEAT
N = int(round(DUR * SR))
rng = np.random.default_rng(11)
music = np.zeros((2, N))
sfx = np.zeros((2, N))


# ---------------------------------------------------------------- helpers
def mtof(m):
    return 440.0 * 2.0 ** ((m - 69) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


def phase(f):
    """Phase of a tone whose frequency may change sample by sample (sweeps, vibrato)."""
    return 2 * np.pi * np.cumsum(f) / SR


def fade(y, a=.002, r=.01):
    n = len(y)
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[n - nr:] *= np.linspace(1, 0, nr)
    return y * e


def place(buf, t0, sig, gain=1.0, pan=0.0):
    """Mix a sound into a stereo buffer at time t0 (equal-power pan, -1 left … 1 right)."""
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    i0 = int(round(t0 * SR))
    s0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(sig.shape[1] - s0, N - i0)
    if n > 0:
        buf[:, i0:i0 + n] += gain * sig[:, s0:s0 + n]


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(.99, hi / (SR / 2))], 'band')
    return signal.lfilter(b, a, x)


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, min(.99, fc / (SR / 2)))
    return signal.lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def sweep_noise(d, f0, f1, q=1.5):
    """Noise through a band-pass whose centre glides from f0 to f1: whooshes and swishes."""
    n = int(d * SR)
    x = rng.standard_normal(n)
    y = np.zeros(n)
    zi = None
    for s in range(0, n, 256):
        fc = f0 * (f1 / f0) ** (s / n)
        lo, hi = max(30, fc / (1 + 1 / q)), min(SR / 2 * .98, fc * (1 + 1 / q))
        b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band')
        if zi is None:
            zi = np.zeros(max(len(a), len(b)) - 1)
        y[s:s + 256], zi = signal.lfilter(b, a, x[s:s + 256], zi=zi)
    return y


# ---------------------------------------------------------------- instruments
def kalimba(f, d=1.3, bright=1.0):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2)
    y += .28 * bright * np.sin(2 * np.pi * 2.0 * f * t + .3) * np.exp(-t * 7)
    y += .12 * bright * np.sin(2 * np.pi * 5.43 * f * t) * np.exp(-t * 16)
    k = int(.004 * SR)
    y[:k] += rng.standard_normal(k) * np.linspace(1, 0, k) * .12
    return fade(y, .0015, .02)


def musicbox(f, d=1.8):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.4) + .35 * np.sin(2 * np.pi * 3.0 * f * t) * np.exp(-t * 6)
    y += .18 * np.sin(2 * np.pi * 4.16 * f * t) * np.exp(-t * 9)
    return fade(y, .001, .02)


def bell(f, d=2.0, idx=2.5, ratio=3.5, decay=2.4):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t + idx * np.exp(-t * 5) * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t * decay)
    return fade(y, .001, .03)


def pluck(f, d=1.4, g=.995, tone=.5):
    """Karplus-Strong string: a burst of noise circulating in a delay line with a gentle low-pass."""
    n = int(d * SR)
    P = max(2, int(round(SR / f - .5)))
    z = np.zeros(n + 1)
    x = signal.lfilter([tone], [1, -(1 - tone)], rng.uniform(-1, 1, P))
    z[1:P + 1] = x[:min(P, n)]
    for s0 in range(P, n, P):
        s1 = min(n, s0 + P)
        z[1 + s0:1 + s1] = .5 * g * (z[1 + s0 - P:1 + s1 - P] + z[s0 - P:s1 - P])
    return fade(z[1:], .002, .03)


def strum(midis, t0, buf, gain=.5, up=False, pan=0.0, tone=.45, d=1.2):
    notes = list(reversed(midis)) if up else list(midis)
    for i, m in enumerate(notes):
        place(buf, t0 + i * .011, pluck(mtof(m), d, tone=tone), gain * (.8 if up else 1), pan + (i - 1.5) * .12)


def bass(f, d=.5):
    t = tt(d)
    y = (np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t) + .1 * np.sin(6 * np.pi * f * t)) * np.exp(-t * 3.2)
    return fade(y, .005, .03)


def pad(midis, d, att=.5, rel=.8, cutoff=1800):
    t = tt(d)
    y = np.zeros_like(t)
    for m in midis:
        for det in (-.1, 0, .09):
            y += signal.sawtooth(2 * np.pi * mtof(m) * 2 ** (det / 12) * t + rng.uniform(0, 2 * np.pi))
    y = lowpass(y, cutoff) / (3 * len(midis))
    e = np.minimum(1, t / att) * np.minimum(1, (d - t) / rel)
    return y * np.clip(e, 0, 1)


def kick(d=.32):
    t = tt(d)
    return fade(np.sin(phase(45 + 95 * np.exp(-t * 30))) * np.exp(-t * 9), .002, .02)


def shaker(d=.08):
    t = tt(d)
    return highpass(rng.standard_normal(len(t)), 6000) * np.exp(-t / .016) * np.minimum(1, t / .004) * .35


def clap(d=.3):
    t = tt(d)
    e = sum(np.where(t >= o, np.exp(-(t - o) / .006), 0) for o in (0, .011, .022)) + .5 * np.where(t >= .022, np.exp(-(t - .022) / .06), 0)
    return bandpass(rng.standard_normal(len(t)), 900, 3200) * e * .5


def tom(f=160, d=.3):
    t = tt(d)
    return fade(np.sin(phase(f * (1 + .5 * np.exp(-t * 20)))) * np.exp(-t * 11), .002, .02)


# ---------------------------------------------------------------- sound effects
def boing(f0=330, d=.55, depth=.35):
    t = tt(d)
    f = f0 * (1 + depth * np.exp(-t * 8) * np.sin(2 * np.pi * 13 * t) + .3 * np.exp(-t * 25))
    ph = phase(f)
    y = (np.sin(ph) + .3 * np.sin(2 * ph) + .15 * np.sin(3 * ph)) * np.exp(-t * 5.5)
    return fade(y, .003, .03)


def squish(f0=240, d=.26):
    t = tt(d)
    tone = np.sin(phase(f0 * (1.4 - .7 * t / d))) * np.exp(-t * 14) * .8
    wet = bandpass(rng.standard_normal(len(t)), 250, 1400) * np.exp(-t * 17) * .9
    blip = np.sin(phase(900 - 500 * t / d)) * np.exp(-t * 30) * .3
    return fade(tone + wet + blip, .004, .02)


def giggle(f0=820, n=5):
    out = np.zeros(int((n * .085 + .2) * SR))
    for k in range(n):
        d = .065
        t = tt(d)
        ph = phase(f0 * (1 - .05 * k) * (1 + .25 * np.sin(np.pi * t / d)))
        y = (np.sin(ph) + .35 * np.sin(2 * ph)) * np.sin(np.pi * t / d) ** 1.5
        i0 = int(k * .085 * SR)
        out[i0:i0 + len(y)] += y
    return bandpass(out, 500, 3500)


def creak(d=.45, rate0=35, rate1=85, fc=900):
    """Rubber stretching: stick-slip clicks that speed up, ringing through two resonances."""
    n = int(d * SR)
    x = np.zeros(n)
    t = 0.0
    while True:
        r = rate0 + (rate1 - rate0) * t / d
        t += (1 / r) * (1 + .3 * rng.uniform(-1, 1))
        if t >= d:
            break
        x[int(t * SR)] = rng.uniform(.6, 1)
    b, a = signal.iirpeak(fc / (SR / 2), 12)
    y = signal.lfilter(b, a, x)
    b, a = signal.iirpeak(fc * 2.3 / (SR / 2), 10)
    y += .6 * signal.lfilter(b, a, x)
    i = np.arange(n)
    return y * np.minimum(1, i / (.03 * SR)) * np.minimum(1, (n - i) / (.05 * SR)) * 4


def thump(f=58, d=.25):
    t = tt(d)
    return fade(np.sin(phase(f * (1 + .6 * np.exp(-t * 25)))) * np.exp(-t * 14), .003, .02)


def heartbeat(gain=1.0):
    out = np.zeros(int(.5 * SR))
    lub, dub = thump(60), thump(50, .22) * .7
    out[:len(lub)] += lub
    out[int(.17 * SR):int(.17 * SR) + len(dub)] += dub
    return out * gain


def pop_big():
    t = tt(1.2)
    body = np.sin(phase(38 + 170 * np.exp(-t * 9))) * np.exp(-t * 7)
    crack = highpass(rng.standard_normal(len(t)), 800) * np.exp(-t * 55)
    cork = np.sin(phase(180 + 750 * np.exp(-t * 18))) * np.exp(-t * 20) * .7
    return fade(body + .9 * crack + cork, .0005, .05)


def pings(d, count, f_lo, f_hi, early=1.6, dec=40, gain=.25):
    """A spray of tiny high pings: glitter bursting, falling, sparkling."""
    out = np.zeros((2, int((d + .4) * SR)))
    for _ in range(count):
        t0 = rng.uniform(0, 1) ** early * d
        f = rng.uniform(f_lo, f_hi)
        t = tt(.18)
        y = np.sin(2 * np.pi * f * t) * np.exp(-t * dec) * (1 - .6 * t0 / d)
        a = (rng.uniform(-.8, .8) + 1) * np.pi / 4
        i0 = int(t0 * SR)
        out[0, i0:i0 + len(y)] += y * np.cos(a) * gain
        out[1, i0:i0 + len(y)] += y * np.sin(a) * gain
    return out


def slide(f0=900, f1=180, d=.7):
    t = tt(d)
    y = np.sin(phase(f0 * (f1 / f0) ** (t / d) * (1 + .02 * np.sin(2 * np.pi * 6 * t))))
    y += .08 * bandpass(rng.standard_normal(len(t)), 800, 3000)
    return fade(y * np.minimum(1, t / .03), .01, .12)


def whoosh(d=.6, f0=300, f1=2500, gain=1.0):
    t = tt(d)
    return sweep_noise(d, f0, f1) * np.sin(np.pi * t / d) ** 1.5 * gain


def ratchet(d=.5):
    out = np.zeros(int((d + .05) * SR))
    t = 0.0
    while t < d:
        k = int(t * SR)
        c = highpass(rng.standard_normal(int(.012 * SR)), 1200) * np.exp(-np.arange(int(.012 * SR)) / (.002 * SR))
        out[k:k + len(c)] += c * .6
        t += .08 - .05 * t / d
    return out


def bonk(f=700):
    t = tt(.2)
    y = (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.1 * t)) * np.exp(-t * 35)
    return fade(y + .3 * highpass(rng.standard_normal(len(t)), 2000) * np.exp(-t * 200), .0005, .01)


def tweet(f=2600):
    t = tt(.09)
    return fade(np.sin(phase(f * (1 + .25 * np.sin(np.pi * t / .09)))) * np.sin(np.pi * t / .09), .002, .005)


def sniffle():
    out = np.zeros(int(.3 * SR))
    for k, o in enumerate((0, .11)):
        t = tt(.075)
        y = bandpass(rng.standard_normal(len(t)), 1500, 4500) * (t / .075) ** 1.5 * (1 - .3 * k)
        out[int(o * SR):int(o * SR) + len(y)] += y
    return out


def wail(f0=430, d=.9):
    """A small, cartoon "waah": a buzzy voice through an "ah" vowel, sliding down with a wobble."""
    t = tt(d)
    f = f0 * (1 - .28 * t / d) * (1 + .04 * np.sin(2 * np.pi * 6 * t))
    src = signal.sawtooth(phase(f))
    y = bandpass(src, 650, 950) + .6 * bandpass(src, 1100, 1400) + .2 * bandpass(src, 2400, 2800)
    return y * np.minimum(1, t / .06) * np.minimum(1, (d - t) / .25)


def kiss():
    t = tt(.35)
    smack = highpass(rng.standard_normal(len(t)), 1500) * np.exp(-t * 90) * .6
    f = 520 + 380 * np.exp(-t * 12)
    tone = np.sin(phase(f)) * np.exp(-t * 9) * np.minimum(1, t / .01) * .6
    vowel = bandpass(signal.sawtooth(phase(f * .5)), 500, 1400) * np.exp(-t * 7) * .3
    return fade(smack + tone + vowel, .0005, .03)


def rain(d):
    n = int(d * SR)
    out = np.zeros((2, n))
    for c in range(2):
        out[c] = bandpass(rng.standard_normal(n), 400, 5000) * .12
        for _ in range(int(d * 40)):   # drops on the glass
            k = rng.integers(0, n - 800)
            out[c, k:k + 800] += highpass(rng.standard_normal(800), 2500) * np.exp(-np.arange(800) / 90) * rng.uniform(.05, .2)
    return out


def rattle(d=.7):
    out = np.zeros(int((d + .05) * SR))
    for _ in range(90):
        k = int(rng.uniform(0, 1) ** 1.4 * d * SR)
        c = highpass(rng.standard_normal(200), 3000) * np.exp(-np.arange(200) / 30)
        out[k:k + 200] += c * rng.uniform(.1, .35)
    return out


def arp(t0, midis, step, buf, voice=bell, gain=.3, pan=0.0, **kw):
    for i, m in enumerate(midis):
        place(buf, t0 + i * step, voice(mtof(m), **kw), gain, pan)


# ---------------------------------------------------------------- the music
CH = {'F': [53, 57, 60, 65], 'C': [52, 55, 60, 64], 'Dm': [50, 53, 57, 62], 'Bb': [50, 53, 58, 62], 'Am': [52, 57, 60, 64],
      'Gm': [50, 55, 58, 62], 'A': [52, 57, 61, 64]}
ROOTS = {'F': 41, 'C': 48, 'Dm': 50, 'Bb': 46, 'Am': 45, 'Gm': 43, 'A': 45}
PAD = {'F': [53, 60, 65, 69], 'C': [52, 55, 60, 67], 'Dm': [50, 57, 62, 65], 'Bb': [50, 58, 62, 65], 'Am': [52, 57, 64, 69],
       'Gm': [50, 55, 62, 67], 'A': [52, 57, 61, 64], 'Bbmaj7': [46, 53, 57, 62], 'Fmaj7': [53, 57, 64, 69]}
STRUM = [(0, 1.0, False), (1, .8, False), (1.5, .6, True), (2.5, .6, True), (3, .8, False), (3.5, .6, True)]   # (beat, gain, upstroke)

PLAY_MEL = [(0, 72, .5), (.5, 77, .5), (1, 81, .5), (1.5, 79, .5), (2, 77, .5), (2.5, 81, .5), (3, 84, 1),
            (4, 86, .5), (4.5, 84, .5), (5, 81, .5), (5.5, 77, .5), (6, 74, .5), (6.5, 77, .5), (7, 81, 1),
            (8, 82, .5), (8.5, 81, .5), (9, 79, .5), (9.5, 77, .5), (10, 79, .5), (10.5, 81, .5), (11, 79, 1),
            (12, 72, .5), (12.5, 77, .5), (13, 81, .5), (13.5, 79, .5), (14, 77, 1)]
SAD_MEL = [(0, 81, 1), (1, 77, 1), (2, 74, 1.5), (3.5, 76, .5), (4, 77, 1), (5, 74, 1), (6, 70, 2),
           (8, 79, 1), (9, 77, .5), (9.5, 76, .5), (10, 73, 1), (11, 76, 1)]
PARTY_MEL = [(0, 84, .5), (.5, 81, .5), (1, 84, .5), (1.5, 86, .5), (2, 84, .5), (2.5, 81, .5), (3, 77, 1),
             (4, 79, .5), (4.5, 84, .5), (5, 88, .5), (5.5, 86, .5), (6, 84, .5), (6.5, 79, .5), (7, 76, 1),
             (8, 77, .5), (8.5, 81, .5), (9, 86, .5), (9.5, 84, .5), (10, 81, .5), (10.5, 77, .5), (11, 74, 1),
             (12, 74, .5), (12.5, 77, .5), (13, 82, .5), (13.5, 81, .5), (14, 79, .5), (14.5, 81, .5), (15, 84, 1)]
LOVE_MEL = [(0, 81, 1), (1, 79, .5), (1.5, 77, .5), (2, 84, 1.5), (3.5, 81, .5),
            (4, 88, 1), (5, 84, .5), (5.5, 81, .5), (6, 76, 1.5), (7.5, 79, .5),
            (8, 77, .5), (8.5, 81, .5), (9, 86, 1), (10, 84, .5), (10.5, 82, .5), (11, 79, 1),
            (12, 81, 2), (14, 77, 2.5)]


def band(buf, t0, bars, mel, drums=True, full=False, mel_gain=.42, sparkle=False):
    """A bouncy band: ukulele strums, bass, kalimba tune, and (optionally) kick, clap and shaker."""
    for b, ch in enumerate(bars):
        halves = ch.split('|')
        for beat, g, up in STRUM:
            c = halves[0] if beat < 2 or len(halves) == 1 else halves[1]
            strum(CH[c], t0 + b * BAR + beat * BEAT, buf, .22 * g, up)
        for beat in (0, 1.5, 2, 3.5) if full else (0, 2):
            c = halves[0] if beat < 2 or len(halves) == 1 else halves[1]
            place(buf, t0 + b * BAR + beat * BEAT, bass(mtof(ROOTS[c] + (12 if full and beat in (1.5, 3.5) else 0)), .55), .5)
        if drums:
            for beat in range(4):
                bt = t0 + b * BAR + beat * BEAT
                if full or beat % 2 == 0:
                    place(buf, bt, kick(), .55)
                if beat % 2 == 1 and (full or b > 0):
                    place(buf, bt, clap(), .45)
                for e in (0, .5) if not full else (0, .25, .5, .75):
                    place(buf, bt + e * BEAT, shaker(), .5 if e in (0, .5) else .3, .3)
    for beat, m, ln in mel:
        place(buf, t0 + beat * BEAT, kalimba(mtof(m), max(.9, ln * BEAT * 2)), mel_gain, 0)
        if sparkle:
            place(buf, t0 + beat * BEAT, bell(mtof(m + 12), 1.0, idx=1.2, decay=4), mel_gain * .22, .25)


def compose():
    S = CUES['sections']
    # PLAY: three bars, then the fourth is cut off by a tape-stop when the hands arrive
    pb = np.zeros((2, N))
    band(pb, S['play'], ['F', 'Dm', 'Bb|C', 'F'], PLAY_MEL)
    stop, ln = CUES['squeeze']['stop'], .5
    i0, n = int(stop * SR), int(ln * SR)
    music[:, :i0] += pb[:, :i0]
    tau = np.arange(n) / SR
    src = stop + tau - tau ** 2 / (2 * ln)             # playback slows to a halt
    for c in range(2):
        music[c, i0:i0 + n] += np.interp(src * SR, np.arange(N), pb[c]) * (1 - tau / ln) ** .5
    # SQUEEZE: no music; a low drone of dread under the squeeze
    t0, t1 = CUES['squeeze']['handsIn'][0], CUES['squeeze']['pop']
    d = t1 - t0
    t = tt(d)
    drone = (np.sin(2 * np.pi * 55 * t) + .6 * np.sin(2 * np.pi * 82.4 * t) + .3 * np.sin(2 * np.pi * 110.3 * t)) * (1 + .3 * np.sin(2 * np.pi * 5 * t))
    place(music, t0, drone * (t / d) ** 1.5 * .22)
    # SAD: a slow music box in D minor, a soft pad, a lonely bass
    s = S['sad']
    for b, ch in enumerate(['Dm', 'Bb', 'Gm|A']):
        for k, c in enumerate(ch.split('|')):
            span = BAR / len(ch.split('|'))
            place(music, s + b * BAR + k * span, pad(PAD[c], span + .6, att=.4, rel=.6, cutoff=1200), .28)
            place(music, s + b * BAR + k * span, pluck(mtof(ROOTS[c]), 2.2, g=.997, tone=.3), .35)
        for beat in range(4):
            c = ch.split('|')[0 if beat < 2 or '|' not in ch else 1]
            place(music, s + b * BAR + beat * BEAT, pluck(mtof(CH[c][beat % 4] + 12), 1.2, tone=.3), .1, .2)
    for beat, m, ln in SAD_MEL:
        place(music, s + beat * BEAT, musicbox(mtof(m), 2.0), .3, 0)
    # MAGIC: the pad warms from Bbmaj7 to C to F; a harp glissando when the glitter lifts
    m0 = CUES['magic']
    place(music, 19.8, pad(PAD['Bbmaj7'], 2.4, att=1.0, rel=.6, cutoff=2200), .35)
    place(music, 21.6, pad(PAD['C'], 2.6, att=.3, rel=.6, cutoff=2600), .35)
    place(music, 24.0, pad(PAD['Fmaj7'], 2.6, att=.1, rel=.5, cutoff=3200), .38)
    harp = [53, 57, 60, 62, 65, 69, 72, 74, 77, 81, 84, 86, 89]
    arp(m0['lift'], harp, .055, music, voice=pluck, gain=.3, d=1.6, tone=.6)
    for i in range(16):   # a rising arpeggio while the glitter flows home
        place(music, 21.6 + i * BEAT / 4, kalimba(mtof([72, 76, 79, 84][i % 4] + 12 * (i // 8)), .9), .22, .1)
    for i in range(8):    # and bright F major bells once they're whole again
        place(music, 24.0 + i * BEAT / 2, bell(mtof([77, 81, 84, 89][i % 4]), 1.2, idx=1.5, decay=3.5), .12, -.2 + .4 * (i % 2))
    for beat in range(4):
        place(music, 24.0 + beat * BEAT, shaker(), .3)
        place(music, 24.0 + beat * BEAT + BEAT / 2, shaker(), .2)
    for k, o in enumerate((0, .1, .2, .3)):   # a little tom fill into the party
        place(music, 26.0 + o, tom(220 - 30 * k), .5, -.3 + .2 * k)
    # PARTY: the full band
    band(music, S['party'], ['F', 'C', 'Dm', 'Bb|C'], PARTY_MEL, full=True, mel_gain=.45, sparkle=True)
    # LOVE: softer: ukulele picking, pad, the tune, and a last chord
    L = S['love']
    for b, ch in enumerate(['F', 'Am', 'Bb|C', 'F']):
        halves = ch.split('|')
        for e in range(8):
            c = halves[0] if e < 4 or len(halves) == 1 else halves[1]
            place(music, L + b * BAR + e * BEAT / 2, pluck(mtof(CH[c][[0, 2, 1, 3, 2, 1, 3, 2][e]] + 12), 1.0, tone=.4), .16, -.2 + .4 * (e % 2))
        for k, c in enumerate(halves):
            span = BAR / len(halves)
            place(music, L + b * BAR + k * span, pad(PAD[c], span + .5, att=.3, rel=.5, cutoff=1600), .22)
            place(music, L + b * BAR + k * span, bass(mtof(ROOTS[c]), span * .9), .4)
    for beat, m, ln in LOVE_MEL:
        place(music, L + beat * BEAT, kalimba(mtof(m), max(1.0, ln * BEAT * 2.2)), .38, 0)
    final = CUES['love']['sparkle']
    for i, m in enumerate([65, 69, 72, 77, 81, 84, 89]):
        place(music, final + i * .03, bell(mtof(m), 2.5, idx=1.0, decay=1.4), .12, -.3 + .1 * i)


# ---------------------------------------------------------------- the sound effects
def effects():
    P, Q, S, M, Y, L = CUES['play'], CUES['squeeze'], CUES['sad'], CUES['magic'], CUES['party'], CUES['love']
    BAO, MOCHI = -.35, .35
    place(sfx, P['iris'][0], whoosh(.8, 300, 2400, .5))
    for a, b in P['hopsBao']:
        place(sfx, a, boing(523, .45, .25), .3, BAO); place(sfx, b, squish(300, .18), .25, BAO)
    for a, b in P['hopsMochi']:
        place(sfx, a, boing(659, .45, .25), .3, MOCHI); place(sfx, b, squish(340, .18), .25, MOCHI)
    place(sfx, P['windup'], ratchet(.55), .4, MOCHI)
    for t, pan in ((P['bump'], 0), (P['bumpBack'], .1)):
        place(sfx, t, squish(220, .3), .7, pan); place(sfx, t, bonk(640), .4, pan)
    place(sfx, P['bump'] + .06, bell(mtof(96), .4, idx=1, decay=10), .15, BAO)
    place(sfx, P['bumpBack'] + .06, bell(mtof(98), .4, idx=1, decay=10), .15, MOCHI)
    for i, t in enumerate(P['giggles']):
        pans = [BAO, MOCHI, 0][i]
        place(sfx, t, giggle(900 if i == 0 else 1050 if i == 1 else 960, 5), .45, pans)
        if i == 2:
            place(sfx, t + .05, giggle(1100, 4), .35, MOCHI)
    # the squeeze
    place(sfx, Q['stop'] + .12, bell(mtof(93), .5, idx=1.2, decay=8), .16, BAO)
    place(sfx, Q['stop'] + .18, bell(mtof(95), .5, idx=1.2, decay=8), .16, MOCHI)
    a, b = Q['handsIn']
    place(sfx, a, whoosh(b - a + .1, 250, 1500, .5), 1, -.7); place(sfx, a, whoosh(b - a + .1, 260, 1600, .5), 1, .7)
    t0, t1 = 7.9, Q['pop']
    d = t1 - t0
    t = tt(d)
    f = 68 * (1 + .08 * np.sin(2 * np.pi * 3.3 * t) + .05 * np.sin(2 * np.pi * 7.1 * t))
    grumble = lowpass(signal.sawtooth(phase(f)) + .5 * signal.sawtooth(phase(f * 1.5)), 500) * (.3 + .7 * t / d) * np.minimum(1, t / .3)
    place(sfx, t0, grumble, .16)                       # the kid's big feelings
    place(sfx, Q['push'][0], creak(.4, 30, 50, 700), .25)
    for i, tp in enumerate(Q['presses']):
        place(sfx, tp, creak(.45, 35 + 10 * i, 70 + 20 * i, 800 + 150 * i), .35 + .1 * i)
        place(sfx, tp, heartbeat(.6 + .2 * i), 1)
        place(sfx, tp, squish(200 - 20 * i, .25), .35)
    a, b = Q['tremble']
    place(sfx, a, creak(b - a, 90, 160, 1300), .55)
    for k in range(3):
        place(sfx, a + k * .13, thump(64, .15), .9)
    place(sfx, Q['pop'], pop_big(), 1.0)
    place(sfx, Q['pop'], pings(1.3, 140, 2500, 8000, early=1.8, dec=35, gain=.3), 1)
    place(sfx, Q['pop'] + .15, slide(950, 170, .75), .3)
    for k, tw in enumerate((10.75, 10.95, 11.2)):
        place(sfx, tw, tweet(2600 + 200 * k), .12, -.2 + .2 * k)
    a, b = Q['handsOut']
    place(sfx, a, whoosh(b - a, 1200, 250, .35), 1)
    # sad
    rn = rain(9.6)
    ramp = np.clip(np.minimum((np.arange(rn.shape[1]) / SR) / 1.0, (9.6 - np.arange(rn.shape[1]) / SR) / 1.2), 0, 1)
    place(sfx, 11.3, rn * ramp, .8)
    place(sfx, S['cry'], wail(430, 1.0), .22, BAO)
    place(sfx, S['cry'] + 1.2, wail(400, .8), .16, BAO)
    for i, t in enumerate(S['sniffles']):
        place(sfx, t, sniffle(), .35, BAO if i % 2 == 0 else MOCHI)
    a, b = S['scoot']
    for k in range(4):
        place(sfx, a + .1 + k * (b - a) / 4, squish(300, .16), .2, MOCHI - .1 * k)
    # magic
    for t, m, pan in ((M['glints'][0], 93, MOCHI + .2), (M['glints'][1], 96, BAO - .2)):
        place(sfx, t, bell(mtof(m), 2.0, idx=2, decay=2), .35, pan)
    place(sfx, M['lift'], pings(1.3, 90, 3000, 9000, early=.9, dec=30, gain=.18), 1)
    tinks = [72, 74, 77, 79, 81, 84, 86, 89, 91, 93]
    a, b = M['stream']
    for k in range(20):
        place(sfx, a + k * (b - a) / 20, bell(mtof(tinks[k % 10] + 12 * (k // 10)), .6, idx=1, decay=7), .12, -.4 + .8 * (k % 2))
    for t, pan in ((M['bandaid'], MOCHI), (M['patch'], BAO)):
        place(sfx, t - .15, pings(.4, 20, 4000, 9000, early=1, dec=40, gain=.2), 1)
        place(sfx, t, bonk(520), .3, pan); place(sfx, t, squish(420, .16), .3, pan)
    for t, f0, pan in ((M['boings'][0], 330, BAO), (M['boings'][1], 392, MOCHI)):
        place(sfx, t, boing(f0, .9, .5), .55, pan)
    arp(M['starstruck'], [84, 88, 91, 96, 100], .045, sfx, gain=.2, idx=1.5, decay=3)
    place(sfx, M['starstruck'] + .5, giggle(1000, 4), .35, BAO); place(sfx, M['starstruck'] + .6, giggle(1150, 4), .3, MOCHI)
    a, b = M['wipe']
    place(sfx, a, whoosh(b - a + .1, 400, 4000, .8), 1)
    # party
    place(sfx, CUES['sections']['party'], squish(500, .15), .4)
    place(sfx, CUES['sections']['party'], rattle(.8), .5)
    for a, b in Y['hopsBao']:
        place(sfx, a, boing(523, .4, .25), .3, BAO); place(sfx, b, squish(320, .15), .22, BAO)
    for a, b in Y['hopsMochi']:
        place(sfx, a, boing(659, .4, .25), .3, MOCHI); place(sfx, b, squish(360, .15), .22, MOCHI)
    a, b = Y['flip']
    place(sfx, a, slide(420, 1400, b - a), .3, BAO)
    place(sfx, b, boing(392, .6, .4), .45, BAO)
    arp(b + .05, [89, 93, 96, 101], .04, sfx, gain=.18, idx=1.2, decay=4)
    a, b = Y['stackOn']
    place(sfx, a, boing(587, .5, .35), .4, MOCHI)
    place(sfx, b, squish(260, .3), .6, BAO + .1); place(sfx, b + .05, bell(mtof(96), .4, idx=1, decay=10), .15, BAO)
    for tb in Y['stackBounce']:
        place(sfx, tb, squish(300, .2), .4, BAO); place(sfx, tb + .06, boing(700, .35, .2), .2, BAO)
    a, b = Y['stackOff']
    place(sfx, a, boing(659, .5, .35), .4); place(sfx, b, squish(340, .2), .35, MOCHI)
    # love
    for (a, b), pan in [(p, BAO) for p in L['scootBao']] + [(p, MOCHI) for p in L['scootMochi']]:
        place(sfx, a, boing(784, .3, .15), .18, pan)
    place(sfx, L['hug'], squish(260, .35), .45)
    arp(L['hug'] + .05, [77, 81, 84, 89], .06, sfx, gain=.14, idx=1.0, decay=2)
    a, b = L['heart']
    arp(a, [72, 77, 81, 84, 89, 93, 96], (b - a) / 7, sfx, gain=.1, idx=1.2, decay=3)
    a, b = L['write']
    letters = [77, 79, 81, 84, 86, 89, 91, 93, 96, 98, 101]
    for k, m in enumerate(letters):
        place(sfx, a + k * (b - a) / len(letters), bell(mtof(m), .7, idx=1, decay=6), .1, -.5 + k / len(letters))
    place(sfx, L['loveEyes'], heartbeat(.6), 1); place(sfx, L['loveEyes'] + .6, heartbeat(.5), 1)
    place(sfx, L['kiss'], kiss(), .5, BAO); place(sfx, L['kiss'] + .07, kiss(), .45, MOCHI)
    arp(L['kiss'] + .15, [84, 88, 91, 96], .08, sfx, gain=.12, idx=1, decay=3)
    a, b = L['iris']
    place(sfx, a, whoosh(b - a + .2, 2500, 500, .35), 1)
    place(sfx, L['bounce'], boing(587, .4, .25), .25, BAO); place(sfx, L['bounce'] + .1, boing(698, .4, .25), .25, MOCHI)
    a, b = L['shut']
    place(sfx, a, whoosh(b - a, 1800, 300, .4), 1)
    place(sfx, L['sparkle'], pings(.5, 30, 4000, 10000, early=1, dec=25, gain=.18), 1)


# ---------------------------------------------------------------- mix and write
def compress(x, thr=-26.0, ratio=2.5, win=.05):
    """Evens out the quiet and loud stretches so the rain can be heard on a phone and the party doesn't shout."""
    k = int(win * SR)
    env = np.sqrt(np.convolve(np.mean(x ** 2, axis=0), np.ones(k) / k, mode='same') + 1e-12)
    g = 10 ** (-np.maximum(0, 20 * np.log10(env) - thr) * (1 - 1 / ratio) / 20)
    return x * np.convolve(g, np.ones(k) / k, mode='same')


def reverb(x, d=1.8):
    n = int(d * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for c in range(2):
        ir = lowpass(rng.standard_normal(n), 5000) * np.exp(-t * 3.4)
        ir[:int(.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        out[c] = signal.fftconvolve(x[c], ir)[:x.shape[1]]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(ROOT / 'out' / 'soundtrack.wav'))
    out = Path(ap.parse_args().out)
    compose()
    effects()
    mix = .8 * music + 1.0 * sfx
    mix += .28 * reverb(.9 * music + .5 * sfx)
    mix = compress(mix)
    mix *= 10 ** (-16 / 20) / np.sqrt(np.mean(mix ** 2))  # about -16 dBFS RMS: loud enough for a phone speaker
    mix = .98 * np.tanh(mix / .98)                       # a soft ceiling: the pop saturates instead of clipping
    i = np.arange(N) / SR
    mix *= np.clip(np.minimum(i / .01, (DUR - i) / .35), 0, 1)
    out.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(mix, -1, 1) * 32000).astype('<i2').T.copy()
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'wrote {out}  ({DUR:.1f} s, peak {np.max(np.abs(mix)):.2f})')


if __name__ == '__main__':
    main()
