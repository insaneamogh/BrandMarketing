"""Agent 3 - Creative. Executes the approved plan: copy + images (+ optional
video via orchestrator), then placement + expected metrics, then publish.

- Copy blocks: gemini-2.5-flash-lite (free), grounded in the approved plan +
  retrieved brand guidelines (respects BANNED CLAIMS).
- Images: gpt-image-1 (the $10 budget) via the router - or Gemini free-tier
  images with IMAGE_PROVIDER=gemini. Supports a user-uploaded REFERENCE IMAGE
  (faithful product rendering) and a user PROMPT TWEAK (art direction appended
  to every image prompt). Gated by MAX_IMAGE_CALLS_PER_RUN; on any failure or
  when the cap is hit, DEMO_MODE serves a cached fallback from /cache.
- Placement + expected metrics: one gemini-2.5-flash call over the asset list +
  channel_metrics chunks. Expected metrics carry a 0-1 probability so the human
  knows what to expect before clicking Approve & Publish.
"""
import hashlib
import json
from pathlib import Path

from agents.common import GROUNDING_RULE, format_context
from config import (
    ASSETS_DIR, CACHE_DIR, DEMO_MODE, MAX_IMAGE_CALLS_PER_RUN,
    quality_for, tier_cost,
)
from llm import router
from rag import store
from schemas import PlacementResponse, ProductProfile
from skills import prompt_builders

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
    "You are AGENT 3 - CREATIVE (copywriter) in a 3-agent CPG marketing pipeline "
    "(1 research -> human gate -> 2 strategy plan -> human gate -> 3 creative -> "
    "publish). You execute the HUMAN-APPROVED plan: the campaign angle is your "
    "creative direction, not a suggestion - every block must ladder up to it.\n\n"
    + GROUNDING_RULE + "\n\n"
    "COPY RULES:\n"
    "- NEVER produce any BANNED CLAIM listed in the brand-guidelines context, "
    "nor a paraphrase that implies one. If a guideline marks a claim as "
    "substantiated for one specific product, use it only for that product and "
    "only verbatim.\n"
    "- Match the brand tone described in the guidelines; lead with benefits that "
    "appear in the product profile's key_claims - every benefit you write must "
    "trace to a key_claim or an approved angle in the guidelines.\n"
    "- Obey the PLATFORM RULES exactly (character limits, overlay word counts, "
    "no-text rules). Count characters before you answer.\n"
    "- Write like a senior CPG copywriter: concrete nouns, active verbs, zero "
    "filler ('elevate', 'unleash', 'discover' are banned as openers). One idea "
    "per line; the first three words carry the benefit.\n"
    "- storyboard_6_frames (when requested): each frame = shot type + subject + "
    "action in under 20 words, building to a product-hero final frame.\n"
    "- veo_prompt (when requested): ONE continuous 5-second shot - subject, "
    "action, setting, lighting, camera move, mood/grade, in that order; no "
    "cuts, no on-screen text, product clearly visible by second 3.\n"
    "- Produce every requested copy-block key; values are strings or arrays of "
    "strings; write tight, specific, non-generic copy."
)

PLACEMENT_SYSTEM = (
    "You are AGENT 3 - CREATIVE (media planner) in a 3-agent CPG marketing "
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
    "met in the first 4 weeks. Be honest: benchmarks transfer imperfectly - "
    "cap at 0.85 unless the context shows the exact channel+region+product "
    "combination; go below 0.5 when extrapolating across regions or categories.\n"
    "- `rationale` says in one sentence WHY that probability (data proximity, "
    "seasonality, competitive pressure)."
)


def _brand_key(profile: ProductProfile) -> str:
    """Map a product profile to its brand-guidelines family (hills|palmolive|skin_health)."""
    t = (profile.name + " " + profile.category).lower()
    if any(k in t for k in ("eltamd", "filorga", "ncef", "pca skin", "sunscreen", "spf", "serum", "anti-aging", "skincare")):
        return "skin_health"
    if any(k in t for k in ("palmolive", "soap", "shower", "body wash", "hand wash")):
        return "palmolive"
    return "hills"


# ---------- copy ----------
def _fallback_copy(profile: ProductProfile, skill: dict) -> dict:
    """Deterministic copy blocks from the profile - DEMO_MODE lifeline so the
    draft stage never hard-fails when the text model/RAG is unreachable."""
    claims = profile.key_claims or [profile.category]
    out = {}
    for key in skill["copy_blocks"]:
        if any(k in key for k in ("bullet", "hook", "frames")):
            out[key] = claims[:3]
        else:
            out[key] = f"{profile.name}: {claims[0]}"
    out["note"] = "offline fallback copy (DEMO_MODE) - set API keys for real copy"
    return out


def generate_copy(profile: ProductProfile, skill: dict, plan_summary: str,
                  campaign_angle: str) -> dict:
    fam = _brand_key(profile)
    try:
        chunks = store.retrieve("brand_guidelines",
                                f"{profile.name} tone banned claims {fam}", k=3)
    except Exception:
        chunks = []  # no embeddings available - draft continues without context
    ctx = format_context(chunks)
    if campaign_angle:
        brief = (
            f"APPROVED PLAN SUMMARY: {plan_summary}\n"
            f"APPROVED CAMPAIGN ANGLE (your creative direction): {campaign_angle}\n"
        )
    else:
        brief = (
            "STANDALONE MODE - NO APPROVED PLAN: this is a solo run. Derive the "
            "creative direction yourself from the product profile and the brand "
            f"guidelines below.\nOBJECTIVE / BRIEF: {plan_summary}\n"
        )
    user = (
        f"PRODUCT PROFILE: {profile.model_dump_json()}\n"
        f"{brief}"
        f"SKILL: {skill['command']} - {skill['description']}\n"
        f"PLATFORM RULES: {skill['platform_rules']}\n"
        f"## BRAND GUIDELINES\n{ctx}\n\n"
        f"Produce these copy blocks as JSON keys: {skill['copy_blocks']}.\n"
        "Values are strings or arrays of strings. Stay on-brand and compliant."
    )
    try:
        return router.chat_json("copy", COPY_SYSTEM, user, 0.6)
    except Exception:
        if not DEMO_MODE:
            raise
        return _fallback_copy(profile, skill)


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

    # 1) prompt-hash cache hit - never pay twice for the same prompt
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


PROMPT_WRITER_SYSTEM = (
    "You are AGENT 3 - CREATIVE (senior art director + prompt engineer) in a "
    "3-agent CPG marketing pipeline. You compile the final image-generation "
    "prompt for ONE advertising asset. A HUMAN reviews and approves your prompt "
    "BEFORE any image model is called - it is the last checkpoint before money "
    "moves, so it must be production-ready, not a sketch.\n\n"
    "You receive: the PRODUCT CREATIVE CONTEXT (product knowledge + approved "
    "campaign brief + brand guidelines), the ASSET JOB (this asset type's "
    "specific communication job and creative direction), and a BASE TEMPLATE "
    "whose constraints are non-negotiable.\n\n"
    "COMPILE RULES:\n"
    "- Write ONE prompt of 120-200 words in concrete visual language: subject "
    "and action first, then scene/environment, composition for the stated "
    "aspect ratio, camera and lens feel, NAMED lighting design, material/"
    "texture behavior, and a color grade anchored to the brand palette.\n"
    "- Execute the ASSET JOB exactly - a product shoot sells desirability, an "
    "infographic answers ONE question, a 4:5 stops the scroll with ONE idea, a "
    "9:16 has vertical momentum, a bundle sells the system. Choose the "
    "framework the ASSET JOB offers that best fits the campaign angle, and "
    "commit to it.\n"
    "- The packaging description in the context is ground truth - describe the "
    "pack faithfully; never contradict or embellish it.\n"
    "- Every HARD CONSTRAINT in the base template survives verbatim in your "
    "prompt (pure white background, no baked-in text, reserved overlay zones, "
    "compliance rules). Restate them explicitly.\n"
    "- Use ONLY approved claims from the context; no invented text, statistics, "
    "badges, awards or certifications; no competitor references; no words or "
    "letters anywhere in the image except the pack's own label.\n"
    "- Never write generic filler ('stunning', 'high quality', '8k') - every "
    "sentence must change what the camera sees.\n"
    'Return a single JSON object only: {"prompt": str}. No markdown, no prose '
    "outside the JSON."
)


def _fill_template(spec: dict, profile: ProductProfile) -> str:
    fields = profile.model_dump()
    fields["brand_colors"] = ", ".join(profile.brand_colors)
    fields["key_claims"] = "; ".join(profile.key_claims)
    return spec["prompt_template"].format(**fields)


def build_context(profile: ProductProfile, plan_summary: str = "",
                  campaign_angle: str = "", target_segment: str = "",
                  channels: list = None, objective: str = "") -> str:
    """The mandatory PRODUCT CREATIVE CONTEXT - built once per creative run
    and fed to every asset-specific prompt compile."""
    fam = _brand_key(profile)
    try:
        chunks = store.retrieve("brand_guidelines",
                                f"{profile.name} tone banned claims visual {fam}", k=3)
    except Exception:
        chunks = []
    return prompt_builders.build_creative_context(
        profile, plan_summary=plan_summary, campaign_angle=campaign_angle,
        target_segment=target_segment, channels=channels,
        guidelines_ctx=format_context(chunks), objective=objective)


def draft_one(spec: dict, profile: ProductProfile, context: str,
              prompt_tweak: str = "") -> dict:
    """Compile ONE asset's final image prompt.

    locked specs (amazon_main) render their compliance template verbatim -
    never LLM-rewritten. Everything else goes through the asset-specific
    builder + the prompt-writer model; deterministic template on any failure.
    The PRODUCT FIDELITY BLOCK is appended in code, never left to the model.
    Returns {kind, aspect, prompt, est_cost_usd, n}.
    """
    base = _fill_template(spec, profile)
    if prompt_tweak:
        base = f"{base} Art direction from the marketing team: {prompt_tweak.strip()}"
    out = {
        "kind": spec["kind"], "aspect": spec["aspect"], "n": 1,
        "est_cost_usd": tier_cost(quality_for(spec["kind"]), spec["aspect"]),
    }

    if spec.get("locked"):
        out["prompt"] = f"{base} {prompt_builders.FIDELITY_BLOCK}"
        return out

    builder = prompt_builders.get_builder(spec.get("builder", "product_shoot"))
    try:
        user = (
            f"{context}\n\n"
            f"ASSET JOB AND CREATIVE DIRECTION:\n{builder}\n\n"
            f"BASE TEMPLATE (its hard constraints are non-negotiable):\n{base}\n\n"
            f"ASPECT RATIO: {spec['aspect']}\n"
            f"ART DIRECTION FROM THE MARKETING TEAM: {prompt_tweak.strip() or 'none'}\n\n"
            "Compile the single production-ready image prompt now."
        )
        data = router.chat_json("image_prompts", PROMPT_WRITER_SYSTEM, user, 0.5)
        text = (data.get("prompt") or "").strip()
        if isinstance(data.get("prompt"), list):
            text = " ".join(str(p) for p in data["prompt"]).strip()
        # too-short output means the model dropped the job/constraints
        out["prompt"] = (f"{text} {prompt_builders.FIDELITY_BLOCK}"
                         if len(text) > 100 else
                         f"{base} {prompt_builders.FIDELITY_BLOCK}")
    except Exception:
        out["prompt"] = f"{base} {prompt_builders.FIDELITY_BLOCK}"
    return out


def draft_prompts(profile: ProductProfile, skill: dict, plan_summary: str,
                  campaign_angle: str, prompt_tweak: str = "",
                  target_segment: str = "", channels: list = None,
                  objective: str = "", on_progress=None) -> list:
    """Stage 1 of image generation: compile every asset's prompt through its
    asset-specific builder. The human approves (and can edit + set n per
    prompt) before any paid render. on_progress(i, total, draft) streams each
    compiled prompt to the caller as it lands."""
    context = build_context(profile, plan_summary, campaign_angle,
                            target_segment, channels, objective)
    specs = skill["image_specs"]
    out = []
    for i, spec in enumerate(specs):
        d = draft_one(spec, profile, context, prompt_tweak)
        out.append(d)
        if on_progress:
            on_progress(i, len(specs), d)
    return out


def render_spec(spec: dict, calls: int, cache_lookup=None,
                reference_png: bytes = None, ref_hash: str = "") -> list:
    """Render ONE approved prompt spec, honoring n (1-4 variations, passed to
    the image API as a single n=k request). Returns a LIST of asset records.

    n == 1 goes through the prompt-hash cache (render_one). n > 1 always
    generates - the user explicitly asked for k distinct variations - and each
    variation counts toward MAX_IMAGE_CALLS_PER_RUN.
    """
    n = max(1, min(4, int(spec.get("n") or 1)))
    prompt, aspect, kind = spec["prompt"], spec["aspect"], spec["kind"]
    if n == 1:
        return [render_one(prompt, aspect, kind, calls,
                           cache_lookup, reference_png, ref_hash)]

    quality = quality_for(kind)
    h = prompt_hash(prompt, aspect, quality, ref_hash)
    base = {"kind": kind, "prompt": prompt, "aspect": aspect,
            "quality": quality, "prompt_hash": h}
    if calls + n > MAX_IMAGE_CALLS_PER_RUN:
        p, _ = _cache_fallback(kind)
        return [{**base, "path": p, "from_cache": True, "cache_hit": False,
                 "origin": "fallback", "cost_usd": 0.0, "saved_usd": 0.0}
                for _ in range(n)]
    try:
        pngs = router.generate_images(prompt, aspect, quality,
                                      task=f"image:{kind}",
                                      reference_png=reference_png, n=n)
        out = []
        for i, png in enumerate(pngs):
            path = GEN_DIR / f"{h[:16]}_{i}.png"
            path.write_bytes(png)
            out.append({**base, "path": str(path), "from_cache": False,
                        "cache_hit": False, "origin": "generated",
                        "cost_usd": tier_cost(quality, aspect), "saved_usd": 0.0})
        return out
    except Exception:
        if not DEMO_MODE:
            raise
        p, _ = _cache_fallback(kind)
        return [{**base, "path": p, "from_cache": True, "cache_hit": False,
                 "origin": "fallback", "cost_usd": 0.0, "saved_usd": 0.0}
                for _ in range(n)]


def generate_assets_from_prompts(prompts: list, cache_lookup=None,
                                 reference_png: bytes = None,
                                 on_progress=None) -> list:
    """Stage 2 of image generation: render HUMAN-APPROVED prompts (each may
    carry n=1-4 variations). This is the only code path that spends image
    budget. on_progress(i, total, records) streams each spec's finished
    variations to the caller."""
    ref_hash = hashlib.sha256(reference_png).hexdigest()[:16] if reference_png else ""
    results, calls = [], 0
    for i, spec in enumerate(prompts):
        recs = render_spec(spec, calls, cache_lookup, reference_png, ref_hash)
        calls += sum(1 for r in recs if r["origin"] == "generated")
        results.extend(recs)
        if on_progress:
            on_progress(i, len(prompts), recs)
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
