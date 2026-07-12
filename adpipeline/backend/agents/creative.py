"""Agent 3 — Creative. Executes the approved plan: copy + images (+ optional
video via orchestrator), then placement + expected metrics, then publish.

- Copy blocks: gemini-2.5-flash-lite (free), grounded in the approved plan +
  retrieved brand guidelines (respects BANNED CLAIMS).
- Images: gpt-image-1 (the $10 budget) via the router — or Gemini free-tier
  images with IMAGE_PROVIDER=gemini. Supports a user-uploaded REFERENCE IMAGE
  (faithful product rendering) and a user PROMPT TWEAK (art direction appended
  to every image prompt). Gated by MAX_IMAGE_CALLS_PER_RUN; on any failure or
  when the cap is hit, DEMO_MODE serves a cached fallback from /cache.
- Placement + expected metrics: one gemini-2.5-flash call over the asset list +
  channel_metrics chunks. Expected metrics carry a 0-1 probability so the human
  knows what to expect before clicking Approve & Publish.
"""
import hashlib
from pathlib import Path

from agents.common import GROUNDING_RULE, format_context
from config import (
    ASSETS_DIR, CACHE_DIR, DEMO_MODE, MAX_IMAGE_CALLS_PER_RUN,
    quality_for, tier_cost,
)
from llm import router
from rag import store
from schemas import PlacementResponse, ProductProfile

GEN_DIR = ASSETS_DIR                 # persisted under the Railway Volume (DATA_DIR)
GEN_DIR.mkdir(parents=True, exist_ok=True)


def prompt_hash(prompt: str, aspect: str, quality: str, ref_hash: str = "") -> str:
    """Cache key. A reference image changes the output, so it is part of the key."""
    return hashlib.sha256(f"{prompt}|{aspect}|{quality}|{ref_hash}".encode()).hexdigest()

# cache fallback by asset kind -> filename under cache/
_CACHE_MAP = {
    "packshot": "packshot.png", "amazon_main": "packshot.png",
    "texture_macro": "texture.png", "lifestyle": "lifestyle.png",
    "flatlay": "flatlay.png", "infographic": "infographic.png",
    "meta_feed": "meta_feed.png", "meta_story": "meta_story.png",
    "storyboard": "storyboard.png",
}

COPY_SYSTEM = (
    "You are AGENT 3 — CREATIVE (copywriter) in a 3-agent CPG marketing pipeline "
    "(1 research -> human gate -> 2 strategy plan -> human gate -> 3 creative -> "
    "publish). You execute the HUMAN-APPROVED plan: the campaign angle is your "
    "creative direction, not a suggestion — every block must ladder up to it.\n\n"
    + GROUNDING_RULE + "\n\n"
    "COPY RULES:\n"
    "- NEVER produce any BANNED CLAIM listed in the brand-guidelines context, "
    "nor a paraphrase that implies one.\n"
    "- Match the brand tone described in the guidelines; lead with benefits that "
    "appear in the product profile's key_claims.\n"
    "- Obey the PLATFORM RULES exactly (character limits, overlay word counts, "
    "no-text rules).\n"
    "- Produce every requested copy-block key; values are strings or arrays of "
    "strings; write tight, specific, non-generic copy."
)

PLACEMENT_SYSTEM = (
    "You are AGENT 3 — CREATIVE (media planner) in a 3-agent CPG marketing "
    "pipeline. The human is about to click Approve & Publish: you map each "
    "asset to where the channel economics say it will work hardest, and you set "
    "honest expectations for what happens after publish.\n\n"
    + GROUNDING_RULE + "\n\n"
    "PLANNING RULES:\n"
    "- Every asset kind gets exactly one placement row; budget_pct across rows "
    "sums to ~100.\n"
    "- Weight budget toward channels whose cited CPL/CVR justify it; say so in "
    "`rationale` in one sentence.\n"
    "- `projected_metric` quotes a CPL/CVR figure verbatim from the context.\n"
    "EXPECTED METRICS RULES:\n"
    "- 3-5 `expected_metrics` rows (CTR, CPL, CVR, ROAS...), each anchored to a "
    "VERBATIM context figure in `expected`.\n"
    "- `probability` is your calibrated 0.00-1.00 confidence the expectation is "
    "met in the first 4 weeks. Be honest: benchmarks transfer imperfectly — "
    "cap at 0.85 unless the context shows the exact channel+region+product "
    "combination; go below 0.5 when extrapolating across regions or categories.\n"
    "- `rationale` says in one sentence WHY that probability (data proximity, "
    "seasonality, competitive pressure)."
)


def _brand_key(profile: ProductProfile) -> str:
    t = (profile.name + profile.category).lower()
    return "palmolive" if any(k in t for k in ("palmolive", "skin", "soap", "shower")) else "hills"


# ---------- copy ----------
def generate_copy(profile: ProductProfile, skill: dict, plan_summary: str,
                  campaign_angle: str) -> dict:
    fam = _brand_key(profile)
    gl = "palmolive" if fam == "palmolive" else "hills"
    chunks = store.retrieve("brand_guidelines",
                            f"{profile.name} tone banned claims {gl}", k=3)
    ctx = format_context(chunks)
    if campaign_angle:
        brief = (
            f"APPROVED PLAN SUMMARY: {plan_summary}\n"
            f"APPROVED CAMPAIGN ANGLE (your creative direction): {campaign_angle}\n"
        )
    else:
        brief = (
            "STANDALONE MODE — NO APPROVED PLAN: this is a solo run. Derive the "
            "creative direction yourself from the product profile and the brand "
            f"guidelines below.\nOBJECTIVE / BRIEF: {plan_summary}\n"
        )
    user = (
        f"PRODUCT PROFILE: {profile.model_dump_json()}\n"
        f"{brief}"
        f"SKILL: {skill['command']} — {skill['description']}\n"
        f"PLATFORM RULES: {skill['platform_rules']}\n"
        f"## BRAND GUIDELINES\n{ctx}\n\n"
        f"Produce these copy blocks as JSON keys: {skill['copy_blocks']}.\n"
        "Values are strings or arrays of strings. Stay on-brand and compliant."
    )
    return router.chat_json("copy", COPY_SYSTEM, user, 0.6)


# ---------- images ----------
def _cache_fallback(kind: str) -> tuple[str, bool]:
    fname = _CACHE_MAP.get(kind, "placeholder.png")
    src = CACHE_DIR / fname
    if not src.exists():
        src = CACHE_DIR / "placeholder.png"
    return str(src), True


def render_one(prompt: str, aspect: str, kind: str, calls: int,
               cache_lookup=None, reference_png: bytes = None,
               ref_hash: str = "") -> dict:
    """Resolve a single image, prompt-hash cache first.

    Returns a record with cost + provenance. `cache_lookup(hash) -> path|None`
    lets the caller check whether this exact prompt (+reference) was ever paid
    for before; on a hit we reuse the file at $0.00 (the visible caching story).
    """
    quality = quality_for(kind)
    h = prompt_hash(prompt, aspect, quality, ref_hash)
    base = {"kind": kind, "prompt": prompt, "aspect": aspect,
            "quality": quality, "prompt_hash": h}

    # 1) prompt-hash cache hit — never pay twice for the same prompt
    if cache_lookup:
        hit = cache_lookup(h)
        if hit and Path(hit).exists():
            return {**base, "path": hit, "from_cache": False, "cache_hit": True,
                    "origin": "cache_hit", "cost_usd": 0.0,
                    "saved_usd": tier_cost(quality, aspect)}

    # 2) over the per-run cap -> demo placeholder (no spend)
    if calls >= MAX_IMAGE_CALLS_PER_RUN:
        p, _ = _cache_fallback(kind)
        return {**base, "path": p, "from_cache": True, "cache_hit": False,
                "origin": "fallback", "cost_usd": 0.0, "saved_usd": 0.0}

    # 3) real generation (provider chosen by the router / IMAGE_PROVIDER)
    try:
        png = router.generate_image(prompt, aspect, quality,
                                    task=f"image:{kind}",
                                    reference_png=reference_png)
        out = GEN_DIR / f"{h[:16]}.png"
        out.write_bytes(png)
        return {**base, "path": str(out), "from_cache": False, "cache_hit": False,
                "origin": "generated", "cost_usd": tier_cost(quality, aspect),
                "saved_usd": 0.0}
    except Exception:
        if not DEMO_MODE:
            raise
        p, _ = _cache_fallback(kind)
        return {**base, "path": p, "from_cache": True, "cache_hit": False,
                "origin": "fallback", "cost_usd": 0.0, "saved_usd": 0.0}


def generate_assets(profile: ProductProfile, skill: dict,
                    cache_lookup=None, reference_png: bytes = None,
                    prompt_tweak: str = "") -> list:
    """Returns a list of asset records (see render_one).

    prompt_tweak: user art direction appended to EVERY image prompt (their
    flexibility knob). reference_png: uploaded product photo the render must
    stay faithful to.
    """
    fields = profile.model_dump()
    fields["brand_colors"] = ", ".join(profile.brand_colors)
    fields["key_claims"] = "; ".join(profile.key_claims)
    ref_hash = hashlib.sha256(reference_png).hexdigest()[:16] if reference_png else ""

    results, calls = [], 0
    for spec in skill["image_specs"]:
        prompt = spec["prompt_template"].format(**fields)
        if prompt_tweak:
            prompt = f"{prompt} Art direction from the marketing team: {prompt_tweak.strip()}"
        rec = render_one(prompt, spec["aspect"], spec["kind"], calls,
                         cache_lookup, reference_png, ref_hash)
        if rec["origin"] == "generated":
            calls += 1
        results.append(rec)
    return results


# ---------- placement + expected metrics ----------
def placement(asset_kinds: list, profile: ProductProfile,
              campaign_angle: str = "") -> PlacementResponse:
    chunks = store.retrieve("channel_metrics",
                            f"{profile.name} CPL CVR CTR ROAS channel placement budget", k=4)
    ctx = format_context(chunks)
    user = (
        f"PRODUCT: {profile.name} ({profile.category})\n"
        f"APPROVED CAMPAIGN ANGLE: {campaign_angle}\n"
        f"ASSETS (by kind): {asset_kinds}\n"
        f"## CHANNEL METRICS\n{ctx}\n\n"
        "JSON schema:\n"
        '{"placements": [{"asset": kind, "platform": str, "format": str, '
        '"budget_pct": number, "rationale": str, "projected_metric": str}], '
        '"expected_metrics": [{"metric": str, "expected": str, '
        '"probability": number, "rationale": str, "sources": [filename]}]}\n'
        "budget_pct across placements should sum to ~100. probability is 0.00-1.00."
    )
    data = router.chat_json("placement", PLACEMENT_SYSTEM, user, 0.3)
    return PlacementResponse.model_validate({**data, "creative_id": 0})
