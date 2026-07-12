"""Agent 4 — Creative. Skill execution (copy + images) + placement pass.

- Copy blocks: gpt-4o-mini, grounded in the approved brief + retrieved brand
  guidelines (respects BANNED CLAIMS).
- Images: gpt-image-1, gated by MAX_IMAGE_CALLS_PER_RUN. On any failure or when the
  cap is hit, DEMO_MODE serves a cached fallback from /cache.
- Placement: gpt-4o over the asset list + channel_metrics chunks.
"""
import json
import shutil
from pathlib import Path

from agents.common import GROUNDING_RULE, format_context
from config import CACHE_DIR, DEMO_MODE, MAX_IMAGE_CALLS_PER_RUN
from llm import openai_client
from llm.router import pick_model
from rag import store
from schemas import PlacementResponse, ProductProfile
from skills import registry

GEN_DIR = CACHE_DIR / "generated"
GEN_DIR.mkdir(parents=True, exist_ok=True)

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


def generate_assets(profile: ProductProfile, skill: dict, creative_id: int) -> list:
    """Returns list of dicts: {kind, prompt, aspect, path, from_cache}."""
    fields = profile.model_dump()
    fields["brand_colors"] = ", ".join(profile.brand_colors)
    fields["key_claims"] = "; ".join(profile.key_claims)

    results = []
    calls = 0
    for spec in skill["image_specs"]:
        prompt = spec["prompt_template"].format(**fields)
        kind, aspect = spec["kind"], spec["aspect"]
        over_cap = calls >= MAX_IMAGE_CALLS_PER_RUN
        path, from_cache = None, False
        if not over_cap:
            try:
                png = openai_client.generate_image(prompt, aspect, task=f"image:{kind}")
                out = GEN_DIR / f"c{creative_id}_{kind}_{calls}.png"
                out.write_bytes(png)
                path, from_cache = str(out), False
                calls += 1
            except Exception:
                if not DEMO_MODE:
                    raise
                path, from_cache = _cache_fallback(kind)
        else:
            path, from_cache = _cache_fallback(kind)
        results.append({"kind": kind, "prompt": prompt, "aspect": aspect,
                        "path": path, "from_cache": from_cache})
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
