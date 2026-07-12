"""Agent 4 — Creative. Skill execution (copy + images) + placement pass.

- Copy blocks: gpt-4o-mini, grounded in the approved brief + retrieved brand
  guidelines (respects BANNED CLAIMS).
- Images: gpt-image-1, gated by MAX_IMAGE_CALLS_PER_RUN. On any failure or when the
  cap is hit, DEMO_MODE serves a cached fallback from /cache.
- Placement: gpt-4o over the asset list + channel_metrics chunks.
"""
import hashlib
import json
from pathlib import Path

from agents.common import GROUNDING_RULE, format_context
from config import (
    ASSETS_DIR, CACHE_DIR, DEMO_MODE, MAX_IMAGE_CALLS_PER_RUN,
    quality_for, tier_cost,
)
from llm import openai_client
from llm.router import pick_model
from rag import store
from schemas import PlacementResponse, ProductProfile
from skills import registry

GEN_DIR = ASSETS_DIR                 # persisted under the Railway Volume (DATA_DIR)
GEN_DIR.mkdir(parents=True, exist_ok=True)


def prompt_hash(prompt: str, aspect: str, quality: str) -> str:
    return hashlib.sha256(f"{prompt}|{aspect}|{quality}".encode()).hexdigest()

# cache fallback by asset kind -> filename under cache/
_CACHE_MAP = {
    "packshot": "packshot.png", "amazon_main": "packshot.png",
    "texture_macro": "texture.png", "lifestyle": "lifestyle.png",
    "flatlay": "flatlay.png", "infographic": "infographic.png",
    "meta_feed": "meta_feed.png", "meta_story": "meta_story.png",
    "storyboard": "storyboard.png",
}


def _brand_key(profile: ProductProfile) -> str:
    t = (profile.name + profile.category).lower()
    return "palmolive" if any(k in t for k in ("palmolive", "skin", "soap", "shower")) else "hills"


# ---------- copy ----------
def generate_copy(profile: ProductProfile, skill: dict, brief_summary: str,
                  approved_angle: str) -> dict:
    fam = _brand_key(profile)
    gl = "palmolive" if fam == "palmolive" else "hills"
    chunks = store.retrieve("brand_guidelines",
                            f"{profile.name} tone banned claims {gl}", k=3)
    ctx = format_context(chunks)
    system = (
        GROUNDING_RULE +
        " You are a compliant CPG copywriter. NEVER produce any BANNED CLAIM listed in "
        "the brand guidelines context. Match the brand tone. Return JSON only."
    )
    user = (
        f"PRODUCT PROFILE: {profile.model_dump_json()}\n"
        f"APPROVED BRIEF SUMMARY: {brief_summary}\n"
        f"APPROVED ANGLE: {approved_angle}\n"
        f"SKILL: {skill['command']} — {skill['description']}\n"
        f"PLATFORM RULES: {skill['platform_rules']}\n"
        f"## BRAND GUIDELINES\n{ctx}\n\n"
        f"Produce these copy blocks as JSON keys: {skill['copy_blocks']}.\n"
        "Values are strings or arrays of strings. Stay on-brand and compliant."
    )
    return openai_client.chat_json(pick_model("copy"), system, user, "copy", 0.6)


# ---------- images ----------
def _cache_fallback(kind: str) -> tuple[str, bool]:
    fname = _CACHE_MAP.get(kind, "placeholder.png")
    src = CACHE_DIR / fname
    if not src.exists():
        src = CACHE_DIR / "placeholder.png"
    return str(src), True


def render_one(prompt: str, aspect: str, kind: str, calls: int,
               cache_lookup=None) -> dict:
    """Resolve a single image, prompt-hash cache first.

    Returns a record with cost + provenance. `cache_lookup(hash) -> path|None`
    lets the caller check whether this exact prompt was ever paid for before;
    on a hit we reuse the file at $0.00 (the visible caching story).
    """
    quality = quality_for(kind)
    h = prompt_hash(prompt, aspect, quality)
    base = {"kind": kind, "prompt": prompt, "aspect": aspect,
            "quality": quality, "prompt_hash": h}

    # 1) prompt-hash cache hit — never pay twice for the same prompt
    if cache_lookup:
        hit = cache_lookup(h)
        if hit and Path(hit).exists():
            return {**base, "path": hit, "from_cache": False, "cache_hit": True,
                    "origin": "cache_hit", "cost_usd": 0.0,
                    "saved_usd": tier_cost(quality)}

    # 2) over the per-run cap -> demo placeholder (no spend)
    if calls >= MAX_IMAGE_CALLS_PER_RUN:
        p, _ = _cache_fallback(kind)
        return {**base, "path": p, "from_cache": True, "cache_hit": False,
                "origin": "fallback", "cost_usd": 0.0, "saved_usd": 0.0}

    # 3) real generation
    try:
        png = openai_client.generate_image(prompt, aspect, quality, task=f"image:{kind}")
        out = GEN_DIR / f"{h[:16]}.png"
        out.write_bytes(png)
        return {**base, "path": str(out), "from_cache": False, "cache_hit": False,
                "origin": "generated", "cost_usd": tier_cost(quality), "saved_usd": 0.0}
    except Exception:
        if not DEMO_MODE:
            raise
        p, _ = _cache_fallback(kind)
        return {**base, "path": p, "from_cache": True, "cache_hit": False,
                "origin": "fallback", "cost_usd": 0.0, "saved_usd": 0.0}


def generate_assets(profile: ProductProfile, skill: dict, creative_id: int,
                    cache_lookup=None) -> list:
    """Returns a list of asset records (see render_one)."""
    fields = profile.model_dump()
    fields["brand_colors"] = ", ".join(profile.brand_colors)
    fields["key_claims"] = "; ".join(profile.key_claims)

    results, calls = [], 0
    for spec in skill["image_specs"]:
        prompt = spec["prompt_template"].format(**fields)
        rec = render_one(prompt, spec["aspect"], spec["kind"], calls, cache_lookup)
        if rec["origin"] == "generated":
            calls += 1
        results.append(rec)
    return results


# ---------- placement ----------
def placement(asset_kinds: list, profile: ProductProfile) -> PlacementResponse:
    chunks = store.retrieve("channel_metrics",
                            f"{profile.name} CPL CVR channel placement budget", k=4)
    ctx = format_context(chunks)
    system = (
        GROUNDING_RULE +
        " Recommend where each asset should run. Ground budget splits and projected "
        "metrics in the channel_metrics context. Return JSON only."
    )
    user = (
        f"PRODUCT: {profile.name} ({profile.category})\n"
        f"ASSETS (by kind): {asset_kinds}\n"
        f"## CHANNEL METRICS\n{ctx}\n\n"
        "JSON schema:\n"
        '{"placements": [{"asset": kind, "platform": str, "format": str, '
        '"budget_pct": number, "rationale": str, "projected_metric": str}]}\n'
        "budget_pct across placements should sum to ~100. projected_metric should cite "
        "a CPL/CVR figure from context where possible."
    )
    data = openai_client.chat_json(pick_model("placement"), system, user, "placement", 0.3)
    data["creative_id"] = 0  # filled by orchestrator
    return PlacementResponse.model_validate({**data, "creative_id": 0})
