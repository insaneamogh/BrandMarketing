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

# Verified against the LIVE product pages (July 2026) - names, claims and
# ingredients below are quoted from the pages, not invented. Source URLs live
# in rag/corpus/product_catalog.md.
_FALLBACKS = {
    "hills": ProductProfile(
        name="Hill's Science Diet Adult 7+ Senior Vitality Chicken & Rice Recipe",
        category="Senior dog nutrition (dry kibble, adult 7+)",
        key_claims=["Improves everyday ability to get up & go",
                    "Proprietary blend supports brain health, interaction, energy and vitality",
                    "Easy-to-digest ingredients for healthy digestion",
                    "Promotes a healthy coat with Vitamin E and Omega-6 fatty acids"],
        pack_description="Tall gusseted kibble bag, warm cream/white field with Hill's "
                         "red-orange logo band across the top, 'Adult 7+ Senior Vitality' "
                         "lettering, photo of an alert senior golden retriever and a small "
                         "chicken-and-rice ingredient inset near the base; 12.5 lb size cue",
        brand_colors=["#FFFFFF", "#E4002B", "#F4A300"],
        price_tier="premium",
    ),
    "hills_rx": ProductProfile(
        name="Hill's Prescription Diet k/d Kidney Care with Chicken",
        category="Veterinary therapeutic dog food (prescription, kidney support, dry)",
        key_claims=["Clinical nutrition shown to help add years and enhance quality of life",
                    "ActivBiome+ Kidney Defense supports kidney health",
                    "Enhanced Appetite Trigger (E.A.T.) stimulates food intake",
                    "Reduced phosphorus and sodium with added omega-3 fatty acids"],
        pack_description="White clinical kibble bag with Hill's red-orange top band, large "
                         "'Prescription Diet' wordmark, teal 'k/d' letters, small dog photo "
                         "and 'Kidney Care' descriptor - pharmaceutical, vet-office look; "
                         "8.5 lb size cue",
        brand_colors=["#FFFFFF", "#E4002B", "#1C3B6E"],
        price_tier="prestige",
    ),
    "palmolive": ProductProfile(
        name="Palmolive Luminous Oils Frangipani & Coconut Shower Gel",
        category="Personal care - moisturizing shower gel / body wash",
        key_claims=["Enriched with natural coconut oil and frangipani",
                    "Feels like a summer holiday - indulgent tropical fragrance",
                    "Cleanses and conditions for soft, smooth, glowing skin"],
        pack_description="Curved translucent amber-gold 400ml bottle with a black flip cap, "
                         "Palmolive green leaf logo up top, 'Luminous Oils' script, white "
                         "frangipani flower and halved-coconut artwork on the label, "
                         "golden oil-drop visual running down the bottle",
        brand_colors=["#0A7D3E", "#E8B04B", "#FFF6E6"],
        price_tier="mass-premium",
    ),
    "eltamd": ProductProfile(
        name="EltaMD UV Clear Broad-Spectrum SPF 46",
        category="Dermatologist-recommended facial sunscreen (acne-prone skin)",
        key_claims=["9.0% transparent zinc oxide broad-spectrum SPF 46",
                    "5% niacinamide helps visibly improve skin tone and discoloration",
                    "Oil-free, non-comedogenic - calms and protects acne-prone skin",
                    "Lightweight, hypoallergenic and fragrance-free"],
        pack_description="Slim white cylindrical 1.7 oz airless pump bottle with a flat white "
                         "cap, clean black EltaMD wordmark, thin teal 'UV Clear' accent band "
                         "and 'Broad-Spectrum SPF 46' in small grey type - clinical, "
                         "derm-office aesthetic",
        brand_colors=["#FFFFFF", "#000000", "#2AA8A0"],
        price_tier="prestige",
    ),
    "filorga": ProductProfile(
        name="Filorga NCEF-Reverse Multi-Correction Cream",
        category="Premium French anti-aging skincare (face cream)",
        key_claims=["Ultra-concentrated in NCEF, the polyrevitalizing complex inspired by aesthetic medicine",
                    "Hyaluronic acid + collagen + vitamins A, H and E act on wrinkles, firmness and radiance",
                    "Ultra-comfortable shea-enriched texture with a matte finish (1.69 fl oz jar)"],
        pack_description="Heavy squat glass jar with matte white body, glossy black screw lid, "
                         "'FILORGA' in black caps and 'NCEF-REVERSE' in gold lettering with a "
                         "thin gold ring accent - French-pharmacy prestige look, 50ml/1.69 oz",
        brand_colors=["#FFFFFF", "#000000", "#C9A24B"],
        price_tier="prestige",
    ),
    # neutral profile for ANY pasted URL outside the 5 demo products ("Other")
    # - prevents a wrong-brand canned profile from bleeding into the renders
    "generic": ProductProfile(
        name="Product from pasted URL",
        category="Consumer product",
        key_claims=["Details extracted from the product page"],
        pack_description="Physical retail packaging exactly as shown on the product page - "
                         "render only what the page and its images actually show",
        brand_colors=["#FFFFFF", "#333333"],
        price_tier="mass-premium",
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
    if any(k in t for k in ("hill", "science diet", "vitality", "senior", "kibble",
                            "dog", "cat", "pet")):
        return "hills"
    return "generic"     # unknown product (the "Other" paste-any-URL flow)


def _slug_name(url: str) -> str:
    """Human-ish product name from a URL slug - last-resort naming for 'Other'."""
    slug = re.sub(r"[?#].*$", "", url).rstrip("/").rsplit("/", 1)[-1]
    words = re.sub(r"[-_+]+", " ", slug).strip()
    return words.title() if 2 < len(words) < 80 else "Product from pasted URL"


def _fallback(hint: str) -> ProductProfile:
    fam = _guess_family(hint)
    prof = _FALLBACKS[fam]
    if fam == "generic" and "http" in hint:
        prof = prof.model_copy(update={"name": _slug_name(hint)})
    return prof


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
