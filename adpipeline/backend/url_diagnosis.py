"""URL diagnosis: fetch -> OG tags / JSON-LD -> images -> vision -> ProductProfile.

Amazon blocks scraping; demo with hillspet.com / palmolive pages. On any failure
(no key, blocked, DEMO_MODE) fall back to a heuristic profile keyed on the product.
A manual profile can be passed by prefixing the url with 'manual:' + pasted text.
"""
import json
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup

from config import DEMO_MODE
from llm import openai_client
from schemas import ProductProfile

_UA = {"User-Agent": "Mozilla/5.0 (compatible; AdPipelineBot/1.0)"}

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
    "palmolive": ProductProfile(
        name="Palmolive Luminous Oils",
        category="Personal care — shower gel / body wash",
        key_claims=["Infused with natural oils", "Indulgent fragrance",
                    "Leaves skin feeling soft and glowing"],
        pack_description="Amber/gold bottle with Palmolive green heritage cue and oil-drop visual",
        brand_colors=["#0A7D3E", "#E8B04B", "#FFF6E6"],
        price_tier="mass-premium",
    ),
}


def _guess_family(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ("palmolive", "luminous", "skin", "soap", "shower")):
        return "palmolive"
    return "hills"


def _fallback(hint: str) -> ProductProfile:
    return _FALLBACKS[_guess_family(hint)]


def _scrape(url: str) -> dict:
    r = requests.get(url, headers=_UA, timeout=8)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    def og(prop):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        return tag.get("content") if tag and tag.get("content") else None

    title = og("og:title") or (soup.title.string if soup.title else None)
    desc = og("og:description")
    images = []
    img = og("og:image")
    if img:
        images.append(img)
    # JSON-LD Product schema
    ld = {}
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "{}")
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for it in items:
            if isinstance(it, dict) and it.get("@type") == "Product":
                ld = it
                break
    for extra in soup.find_all("img", src=True)[:6]:
        src = extra["src"]
        if src.startswith("http") and len(images) < 3:
            images.append(src)
    return {"title": title, "desc": desc, "ld": ld, "images": images[:3]}


def diagnose(url: str) -> ProductProfile:
    # manual entry path
    if url.startswith("manual:"):
        text = url[len("manual:"):]
        try:
            return _vision_profile(text, [])
        except Exception:
            return _fallback(text)

    try:
        scraped = _scrape(url)
    except Exception:
        return _fallback(url)

    text = json.dumps({
        "title": scraped["title"], "desc": scraped["desc"],
        "ld_name": scraped["ld"].get("name"),
        "ld_desc": scraped["ld"].get("description"),
        "url": url,
    })
    try:
        return _vision_profile(text, scraped["images"])
    except Exception:
        if DEMO_MODE:
            return _fallback(text + url)
        raise


def _vision_profile(page_text: str, image_urls: list) -> ProductProfile:
    system = (
        "You are a product analyst. From the page text and product images, extract a "
        "structured ProductProfile. Return JSON only."
    )
    user = (
        f"PAGE DATA:\n{page_text}\n\n"
        "Return JSON:\n"
        '{"name": str, "category": str, "key_claims": [str], '
        '"pack_description": str, "brand_colors": [hex or name], "price_tier": str}\n'
        "brand_colors: infer from the pack. price_tier one of: value|mass-premium|premium|prestige."
    )
    if image_urls:
        data = openai_client.vision_json("gpt-4o", system, user, image_urls, "vision")
    else:
        data = openai_client.chat_json("gpt-4o", system, user, "vision", 0.2)
    return ProductProfile.model_validate(data)
