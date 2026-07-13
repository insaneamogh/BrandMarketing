"""Central config: env vars + paths + model/cost routing.

COST POLICY (the whole point of this file):
  - ALL text, vision and embeddings  -> Gemini FREE tier ($0.00)
  - Images ONLY                      -> OpenAI gpt-image-1 (the $10 budget)
  - Video (optional)                 -> Seedance lite t2v (only if key present)
  - Text fallback on Gemini failure  -> gpt-4o-mini (pennies, keeps demos alive)
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent          # backend/
ROOT_DIR = BASE_DIR.parent                           # adpipeline/
load_dotenv(ROOT_DIR / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
SEEDANCE_API_KEY = os.getenv("SEEDANCE_API_KEY", "")
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
MAX_IMAGE_CALLS_PER_RUN = int(os.getenv("MAX_IMAGE_CALLS_PER_RUN", "6"))
MAX_VIDEO_CALLS_PER_CREATIVE = int(os.getenv("MAX_VIDEO_CALLS_PER_CREATIVE", "1"))

# ---- Persistence ----------------------------------------------------------
# DATA_DIR is the ONE writable location that must survive redeploys. On Railway
# this is a mounted Volume (e.g. /data). Locally it defaults to adpipeline/data.
# Everything that must persist (SQLite DB, Chroma index, generated images/video)
# lives under here. Never hardcode container paths anywhere else.
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

CORPUS_DIR = BASE_DIR / "rag" / "corpus"            # read-only, ships in the image
CACHE_DIR = ROOT_DIR / "cache"                       # committed demo placeholders (fallback source)
ASSETS_DIR = DATA_DIR / "assets"                     # generated + reused image/video blobs
CHROMA_DIR = DATA_DIR / "chroma"                     # persisted embeddings (no re-embed on cold start)
DB_PATH = DATA_DIR / "adpipeline.db"
DB_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")  # swap to Postgres via env (Option B)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# Optionally serve the built React bundle from FastAPI (single-service deploy).
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

# ---- Model routing (text = Gemini) ------------------------------------------
# ALL text-in/text-out tasks run on gemini-3.5-flash. The ONE exception is
# google_search grounding, which runs on gemini-2.5-flash (MODEL_GEMINI_SEARCH).
MODEL_GEMINI_FLASH = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
MODEL_GEMINI_LITE = os.getenv("GEMINI_MODEL_LITE", "gemini-3.5-flash")
MODEL_GEMINI_SEARCH = os.getenv("GEMINI_SEARCH_MODEL", "gemini-2.5-flash")

MODEL_STRATEGIST = MODEL_GEMINI_FLASH  # Agent 1 (researcher) + Agent 2 (planner)
MODEL_CREATIVE = MODEL_GEMINI_FLASH    # Agent 3 - placement + expected metrics
MODEL_VISION = MODEL_GEMINI_FLASH      # Agent 3 - URL diagnosis (Gemini vision)
MODEL_BULK = MODEL_GEMINI_LITE         # Agent 3 - copy blocks

# If a Gemini call fails (rate limit / outage) the router falls back here so a
# live demo never dies. gpt-4o-mini text is ~$0.001/call.
MODEL_FALLBACK_TEXT = "gpt-4o-mini"

# ---- Embeddings ------------------------------------------------------------
# Default to Gemini free-tier embeddings so the $10 OpenAI budget is images-only.
# IMPORTANT: the Chroma index is dimension-locked to one provider. If you switch
# EMBED_PROVIDER later, delete DATA_DIR/chroma so it re-ingests cleanly.
EMBED_PROVIDER = os.getenv("EMBED_PROVIDER", "gemini" if GOOGLE_API_KEY else "openai")
MODEL_EMBED_OPENAI = "text-embedding-3-small"
MODEL_EMBED_GEMINI = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = 768                        # gemini output_dimensionality (chroma-friendly)

# ---- Images ----------------------------------------------------------------
# openai (default): gpt-image-2 - best product fidelity + Amazon-compliance for
#   hero shots. Paid from the $10 budget at the tier prices below.
# gemini: gemini-2.5-flash-image ("nano banana") - free tier, good for drafts.
IMAGE_PROVIDER = os.getenv("IMAGE_PROVIDER", "openai")
MODEL_IMAGE = os.getenv("IMAGE_MODEL", "gpt-image-2")
MODEL_IMAGE_GEMINI = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")

# ---- Video (Seedance, optional) --------------------------------------------
# BytePlus ModelArk async t2v API. Only called when SEEDANCE_API_KEY is set and
# the user explicitly clicks "Generate video" on a /bundle creative.
SEEDANCE_BASE_URL = os.getenv(
    "SEEDANCE_BASE_URL", "https://ark.ap-southeast.bytepluses.com/api/v3")
SEEDANCE_MODEL = os.getenv("SEEDANCE_MODEL", "seedance-1-0-lite-t2v-250428")
SEEDANCE_COST_PER_VIDEO = float(os.getenv("SEEDANCE_COST_PER_VIDEO", "0.30"))
SEEDANCE_RESOLUTION = os.getenv("SEEDANCE_RESOLUTION", "720p")
SEEDANCE_DURATION_S = int(os.getenv("SEEDANCE_DURATION_S", "5"))

# ---- Cost table (USD per 1M tokens) for the /cost readout -------------------
# Gemini rows are 0.0: we run on the AI Studio FREE tier. Tokens are still
# logged so the readout can show "N free calls".
COST_TABLE = {
    "gpt-4o": {"in": 2.50, "out": 10.00},
    "gpt-4o-mini": {"in": 0.15, "out": 0.60},
    MODEL_EMBED_OPENAI: {"in": 0.02, "out": 0.0},
    MODEL_GEMINI_FLASH: {"in": 0.0, "out": 0.0},   # free tier
    MODEL_GEMINI_LITE: {"in": 0.0, "out": 0.0},    # free tier
    MODEL_GEMINI_SEARCH: {"in": 0.0, "out": 0.0},  # free tier (search grounding)
    MODEL_EMBED_GEMINI: {"in": 0.0, "out": 0.0},   # free tier
    MODEL_IMAGE: {"in": 0.0, "out": 0.0},          # priced per image, tracked separately
    MODEL_IMAGE_GEMINI: {"in": 0.0, "out": 0.0},   # free tier
    SEEDANCE_MODEL: {"in": 0.0, "out": 0.0},       # priced per video, tracked separately
}

# Per-image cost by quality tier (USD, gpt-image 1024x1024 pricing estimate -
# adjust if gpt-image-2 list prices differ). Portrait/landscape (1024x1536 /
# 1536x1024) bills 1.5x - tier_cost() applies it.
# The router assigns a tier per asset kind; caching means a repeat prompt = $0.00.
IMAGE_TIERS = {"low": 0.011, "medium": 0.042, "high": 0.167}
IMAGE_COST = IMAGE_TIERS["medium"]      # default when tier unknown

# Which quality tier each asset kind renders at. Hero/compliance images go high;
# supporting lifestyle/infographic medium; storyboard stills low.
QUALITY_BY_KIND = {
    "packshot": "high", "amazon_main": "high",
    "lifestyle": "medium", "texture_macro": "medium",
    "infographic": "medium", "meta_feed": "medium", "meta_story": "medium",
    "flatlay": "low", "storyboard": "low",
}


def tier_cost(quality: str, aspect: str = "1:1") -> float:
    """Per-image spend at a quality tier. Non-square gpt-image-1 sizes bill 1.5x.
    Gemini images are free tier -> $0."""
    if IMAGE_PROVIDER == "gemini":
        return 0.0
    base = IMAGE_TIERS.get(quality, IMAGE_COST)
    return round(base * (1.0 if aspect == "1:1" else 1.5), 3)


def quality_for(kind: str) -> str:
    return QUALITY_BY_KIND.get(kind, "medium")
