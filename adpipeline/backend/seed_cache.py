"""Generate placeholder cache images so DEMO_MODE image fallback works offline.

Run once: `python seed_cache.py`. Overwrite freely with real pre-generated assets
for a more convincing demo.
"""
from PIL import Image, ImageDraw

from config import CACHE_DIR

KINDS = {
    "packshot": (245, 246, 248), "texture": (232, 176, 75),
    "lifestyle": (210, 226, 210), "flatlay": (238, 232, 224),
    "infographic": (224, 0, 43), "meta_feed": (10, 125, 62),
    "meta_story": (30, 60, 120), "storyboard": (40, 40, 48),
    "placeholder": (200, 200, 205),
}


def _draw(name, rgb):
    img = Image.new("RGB", (1024, 1024), rgb)
    d = ImageDraw.Draw(img)
    label = f"CACHED DEMO ASSET\n{name}"
    d.rectangle([40, 40, 984, 984], outline=(255, 255, 255), width=6)
    d.text((80, 480), label, fill=(255, 255, 255))
    out = CACHE_DIR / f"{name}.png"
    img.save(out)
    return out


def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for name, rgb in KINDS.items():
        print("wrote", _draw(name, rgb))


if __name__ == "__main__":
    main()
