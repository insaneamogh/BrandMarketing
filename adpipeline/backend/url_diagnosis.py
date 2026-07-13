"""URL diagnosis: deterministic scrape -> OG tags / JSON-LD / images -> vision
-> ProductProfile.

The scrape layer is pure Python (no LLM): it pulls the product name, brand,
description, price and every usable product image from the page BEFORE anything
is sent to a model. The vision model only structures what was actually found.
On any failure (no key, blocked, DEMO_MODE) fall back to a deterministic profile
built from the scraped data, or a canned family profile if the fetch itself
failed. A manual profile can be passed as 'manual:' + pasted text.
"""
import json
import re
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from config import DEMO_MODE
from llm import router
from schemas import ProductProfile

_UA = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# image URLs that are never the product (icons, logos, tracking pixels, sprites)
_IMG_NOISE = re.compile(
    r"(sprite|icon|favicon|logo|placeholder|pixel|badge|flag|arrow|spinner|"
    r"loading|\.svg|\.gif|1x1|blank)", re.I)

_FALLBACKS = {
    "hills": ProductProfile(
        name="Hill's Science Diet Youthful Vitality Adult 7+",
        category="Senior dog/cat nutrition (dry food)",
        key_claims=["Supports energy and vitality in pets 7+",
                    "Promotes healthy brain function and activity",
                    "Supports lustrous coat and healthy skin"],
        pack_description="Cream/white bag with Hill's orange-red branding and a senior pet image",
        brand_colors=["#FFFFFF", "#E4002B", "#F4A300"],
        price_tier="premium",
    ),
    "hills_rx": ProductProfile(
        name="Hill's Prescription Diet k/d Kidney Care",
        category="Veterinary therapeutic dog food (prescription, kidney support)",
        key_claims=["Clinically tested nutrition for kidney support",
                    "Formulated with veterinarians and nutritionists",
                    "Supports appetite and vitality in pets with kidney conditions"],
        pack_description="White clinical bag with Hill's red-orange band, 'Prescription Diet k/d' "
                         "lettering and a small dog photo - pharmaceutical, vet-office look",
        brand_colors=["#FFFFFF", "#E4002B", "#1C3B6E"],
        price_tier="prestige",
    ),
    "palmolive": ProductProfile(
        name="Palmolive Luminous Oils",
        category="Personal care - shower gel / body wash",
        key_claims=["Infused with natural oils", "Indulgent fragrance",
                    "Leaves skin feeling soft and glowing"],
        pack_description="Amber/gold bottle with Palmolive green heritage cue and oil-drop visual",
        brand_colors=["#0A7D3E", "#E8B04B", "#FFF6E6"],
        price_tier="mass-premium",
    ),
    "eltamd": ProductProfile(
        name="EltaMD UV Clear Broad-Spectrum SPF 46",
        category="Dermatologist-recommended facial sunscreen (skincare)",
        key_claims=["Broad-spectrum SPF 46 with transparent zinc oxide",
                    "Oil-free, calms and protects sensitive and acne-prone skin",
                    "Niacinamide supports a clear, even-looking complexion"],
        pack_description="Minimal white cylindrical pump bottle with clean black EltaMD "
                         "wordmark and thin teal 'UV Clear' accent band - clinical, derm-office aesthetic",
        brand_colors=["#FFFFFF", "#000000", "#2AA8A0"],
        price_tier="prestige",
    ),
    "filorga": ProductProfile(
        name="Filorga NCEF-Reverse Supreme Regenerating Cream",
        category="Premium French anti-aging skincare (face cream)",
        key_claims=["NCEF complex inspired by aesthetic-medicine formulations",
                    "Visibly smooths wrinkles and improves firmness",
                    "Restores radiance and skin quality"],
        pack_description="Luxurious glass jar with matte white body, glossy black lid and "
                         "gold NCEF-REVERSE lettering - French-pharmacy prestige look",
        brand_colors=["#FFFFFF", "#000000", "#C9A24B"],
        price_tier="prestige",
    ),
}


def _guess_family(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ("eltamd", "uv clear", "sunscreen", "spf")):
        return "eltamd"
    if any(k in t for k in ("filorga", "ncef", "anti-aging", "anti-ageing")):
        return "filorga"
    if any(k in t for k in ("prescription", "k/d", "kd-", "therapeutic", "kidney")):
        return "hills_rx"
    if any(k in t for k in ("palmolive", "luminous", "soap", "shower", "body wash")):
        return "palmolive"
    return "hills"


def _fallback(hint: str) -> ProductProfile:
    return _FALLBACKS[_guess_family(hint)]


def _iter_ld_products(data):
    """Yield every JSON-LD dict whose @type is (or includes) Product, at any depth
    (top-level, list, or nested inside @graph)."""
    if isinstance(data, list):
        for item in data:
            yield from _iter_ld_products(item)
        return
    if not isinstance(data, dict):
        return
    t = data.get("@type")
    types = t if isinstance(t, list) else [t]
    if "Product" in [str(x) for x in types]:
        yield data
    for key in ("@graph", "mainEntity", "itemListElement"):
        if key in data:
            yield from _iter_ld_products(data[key])


def _ld_images(ld) -> list:
    """JSON-LD image can be a string, list, or ImageObject(s)."""
    img = ld.get("image")
    out = []
    for item in (img if isinstance(img, list) else [img]):
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict):
            u = item.get("url") or item.get("contentUrl")
            if u:
                out.append(u)
    return out


def _good_image(url: str) -> bool:
    return bool(url) and url.startswith("http") and not _IMG_NOISE.search(url)


def scrape(url: str) -> dict:
    """Deterministic product-page extraction. No LLM involved.

    Returns {title, brand, desc, price, currency, ld, images[<=6], h1}. Raises on
    fetch failure so the caller can fall back.
    """
    r = requests.get(url, headers=_UA, timeout=12)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    def meta(*names):
        for n in names:
            tag = (soup.find("meta", property=n)
                   or soup.find("meta", attrs={"name": n})
                   or soup.find("meta", attrs={"itemprop": n}))
            if tag and tag.get("content"):
                return tag["content"].strip()
        return None

    # JSON-LD Product (any depth, incl. @graph)
    ld = {}
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "{}")
        except Exception:
            continue
        for prod in _iter_ld_products(data):
            ld = prod
            break
        if ld:
            break

    title = (ld.get("name") or meta("og:title", "twitter:title")
             or (soup.title.string.strip() if soup.title and soup.title.string else None))
    desc = (ld.get("description") or meta("og:description", "twitter:description", "description"))
    brand = ld.get("brand")
    if isinstance(brand, dict):
        brand = brand.get("name")
    offers = ld.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    price = offers.get("price") if isinstance(offers, dict) else None
    currency = offers.get("priceCurrency") if isinstance(offers, dict) else None
    h1 = soup.h1.get_text(" ", strip=True) if soup.h1 else None

    # images, best sources first: JSON-LD -> og/twitter -> content <img> tags
    images, seen = [], set()

    def add(u):
        if not u:
            return
        u = urljoin(url, u.strip())
        if _good_image(u) and u not in seen:
            seen.add(u)
            images.append(u)

    for u in _ld_images(ld):
        add(u)
    add(meta("og:image", "og:image:secure_url", "twitter:image"))
    link = soup.find("link", rel="image_src")
    if link:
        add(link.get("href"))
    for tag in soup.find_all("img"):
        add(tag.get("src") or tag.get("data-src") or tag.get("data-original"))
        if len(images) >= 6:
            break

    return {"title": title, "brand": brand, "desc": desc, "price": price,
            "currency": currency, "ld": ld, "images": images[:6], "h1": h1}


# kept for backwards compatibility with older callers/tests
_scrape = scrape


def _profile_from_scrape(url: str, scraped: dict) -> ProductProfile:
    """Deterministic profile straight from scraped data - used when the vision
    model is unavailable but the page itself was readable."""
    fam = _FALLBACKS[_guess_family((scraped.get("title") or "") + " " + url)]
    desc = (scraped.get("desc") or "").strip()
    sentences = [x.strip() for x in re.split(r"(?<=[.!?])\s+", desc) if len(x.strip()) > 15]
    return ProductProfile(
        name=scraped.get("title") or scraped.get("h1") or fam.name,
        category=fam.category,
        key_claims=sentences[:3] or fam.key_claims,
        pack_description=(desc[:280] or fam.pack_description),
        brand_colors=fam.brand_colors,
        price_tier=fam.price_tier,
        source_images=scraped.get("images", []),
    )


def diagnose(url: str) -> ProductProfile:
    # manual entry path
    if url.startswith("manual:"):
        text = url[len("manual:"):]
        try:
            return _vision_profile(text, [])
        except Exception:
            return _fallback(text)

    try:
        scraped = scrape(url)
    except Exception:
        return _fallback(url)  # page unreachable: canned family profile

    # everything the deterministic layer found, handed to the model verbatim
    text = json.dumps({
        "url": url,
        "title": scraped["title"],
        "h1": scraped["h1"],
        "brand": scraped["brand"],
        "description": scraped["desc"],
        "price": scraped["price"],
        "currency": scraped["currency"],
        "ld_extra": {k: scraped["ld"].get(k) for k in
                     ("sku", "gtin13", "category", "aggregateRating") if scraped["ld"].get(k)},
    })
    try:
        profile = _vision_profile(text, scraped["images"])
        profile.source_images = scraped["images"]
        return profile
    except Exception:
        if DEMO_MODE:
            # page WAS readable: build the profile deterministically from it
            return _profile_from_scrape(url, scraped)
        raise


def _vision_profile(page_text: str, image_urls: list) -> ProductProfile:
    system = (
        "You are the CREATIVE agent's product analyst in a CPG marketing pipeline. "
        "From scraped page data and product images, extract a faithful, structured "
        "ProductProfile that downstream image prompts will be built from. Describe "
        "only what the page/images actually show - never invent claims the brand "
        "does not make. Return a single JSON object only."
    )
    user = (
        f"PAGE DATA:\n{page_text}\n\n"
        "Return JSON:\n"
        '{"name": str, "category": str, "key_claims": [str], '
        '"pack_description": str, "brand_colors": [hex or name], "price_tier": str}\n'
        "pack_description: concrete visual description of the physical pack "
        "(shape, colors, imagery) so an image model can render it accurately.\n"
        "brand_colors: infer from the pack. price_tier one of: value|mass-premium|premium|prestige."
    )
    if image_urls:
        data = router.vision_json("vision", system, user, image_urls)
    else:
        data = router.chat_json("vision", system, user, 0.2)
    return ProductProfile.model_validate(data)
