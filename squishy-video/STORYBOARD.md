# Squishy Comeback: storyboard

**Logline:** Two dumpling squishies get squeezed until they pop, but their own glitter sews them back together, and
they bounce back to tell the person who loves them that they're okay.

**World:** One place, the desk in a school therapy room: a peach wall, a window, a feelings-faces poster, a tissue box,
books and a plant. It's painted in watercolour with boiling ink lines, on paper grain.

**Colour arc:** sunny day → grey-blue rain (the break) → violet and gold (the magic) → rainbow (the party) → warm
sunset (the love letter).

**Motif:** The glitter inside them. It sparkles while they play, bursts out when they pop, lies dull on the table
while they cry, then rises, swirls and flows back in to heal them. At the end it rises again as a heart.

**Rhyme:** The film opens with a circle opening onto the two of them bouncing on the desk. It closes with a heart
closing on the same two, now hugging, with a heart patch and a band-aid.

**Cast:**
- **Bao**, the pink dumpling. Gets a heart-shaped patch.
- **Mochi**, the blue dumpling. The prankster. Gets a band-aid.
- **The kid's hands**, in a striped hoodie, with a scribble cloud of big feelings over them. Never a villain: after
  the pop, the hands freeze, sweat and back away.

**Tempo:** 100 BPM (a beat is 0.6 s). Hops, squeezes and cuts land on beats. All times are in `src/cues.js`, which both
the picture and the soundtrack read.

**Text:** One painted line at the very end ("we're okay!"). Everything else is acting.

## Shots

```
PLAY    0.0–7.2   [in: circle iris opens on the pair]
        Sunny desk. Bao hums and hops; Mochi hops on the off-beats. Mochi winds up and hip-bumps Bao. Bao takes it,
        laughs, and bumps back. Both giggle.
        reads: 0.0–1.2  two glittery dumplings on a desk, happy
               1.2–3.4  they bounce to the music, not in unison
               3.4–4.2  Mochi's sly look and wind-up (the eye goes to Mochi)
               4.2–4.8  BUMP; Bao is shoved, then its surprised take
               4.8–7.2  Bao laughs and bumps back; both giggle (held)

SQUEEZE 7.2–12.0  [music tape-stops]
        Both freeze and look out to the sides. Two big kid hands slide in with a scribble cloud of feelings
        overhead. They push the squishies together and squeeze: once, twice, three times, harder each time. Faces
        squeeze shut, sweat flies. A tremble, then POP: a white flash, a starburst, glitter everywhere, the camera
        shakes. The squishies drop flat and torn, with dizzy eyes. The hands freeze, sweat and back away.
        reads: 7.2–7.6   the music stops; they look out to the sides
               7.6–8.6   the hands and the scribble cloud arrive and push them together
               8.6–10.0  three squeezes, each harder
               10.0–10.4 the tremble (anticipation)
               10.4–11.2 POP; glitter rains down
               11.2–12.0 the hands freeze, sweat and back away

SAD     12.0–19.2 [camera pushes in; rain starts; the colour drains to blue]
        Two flat, ripped puddles with dull glitter scattered around them. They come to, look down at themselves,
        tear up and cry under a little rain cloud. Mochi scoots over and leans on Bao.
        reads: 12.0–12.9  they come to, dizzy
               12.9–14.1  they look down at their flat bodies and tear up
               14.1–15.6  crying (held)
               15.6–16.6  Mochi scoots over
               16.6–19.2  leaning on each other, sad (held)

MAGIC   19.2–26.4 [the colour warms to violet and gold; the camera pulls back]
        A glitter flake glints. Mochi sees it. Another glints and Bao sees it. Then all the glitter lifts off the
        table, swirls around them and flows back in. With a burst of sparkles a band-aid seals Mochi's tear and a heart
        patch seals Bao's. BOING, BOING: they spring back to full size, look themselves over, get star eyes, and look at
        each other.
        reads: 19.2–19.9  one glint, then Mochi's look
               19.9–20.4  a second glint, then Bao's look
               20.4–21.6  the glitter rises and swirls
               21.6–23.2  it flows back in; the band-aid, then the patch
               23.6–24.4  BOING, BOING
               24.4–25.5  they look themselves over, then star eyes
               25.5–26.4  they look at each other
        [out: a rainbow brush wipe]

PARTY   26.4–36.0 [rainbow in the window, confetti]
        Alternating hops. Bao does a backflip. Mochi cheers, then jumps onto Bao's head. The stack wobbles, bounces
        twice, and Mochi hops off. They bounce, then turn toward each other.
        reads: 26.7–29.2  happy hops, taking turns
               29.4–30.0  Bao's backflip
               30.6–31.2  Mochi lands on Bao's head
               31.2–33.6  the stack wobbles and bounces
               33.6–34.2  Mochi hops down
               34.2–36.0  they bounce and turn toward each other

LOVE    36.0–45.6 [sunset; the camera pushes in]
        They scoot together and hug. A painted heart draws itself around them and "we're okay!" paints itself in
        above. Heart eyes. They look at the camera and blow a kiss; hearts float out. A heart-shaped iris closes on
        them, holds, then shuts on a final sparkle.
        reads: 36.0–37.2  scoot together
               37.2–38.4  the hug; the heart draws itself
               38.4–41.4  the words paint on; heart eyes (held so it can be read)
               41.4–42.6  the kiss; hearts float to the camera
               42.6–45.6  heart iris, hold, shut, sparkle
```

## Sound

The soundtrack is synthesized in Python: a kalimba and plucked-string tune at 100 BPM that changes with the story
(bouncy F major → silence and heartbeat → a slow minor music box in the rain → a harp glissando and chimes → full party →
warm finale). Sound effects are timed from the same cues: boings, squishes, giggles, rubber creaks, the pop, falling
glitter, sniffles, the ascending tinks of glitter flowing home, a band-aid and a patch "boop", sparkle chimes and a
blown kiss.
