"""Central config: env vars + paths."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent          # backend/
ROOT_DIR = BASE_DIR.parent                           # adpipeline/
load_dotenv(ROOT_DIR / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
MAX_IMAGE_CALLS_PER_RUN = int(os.getenv("MAX_IMAGE_CALLS_PER_RUN", "6"))

# ---- Persistence ----------------------------------------------------------
# DATA_DIR is the ONE writable location that must survive redeploys. On Railway
# this is a mounted Volume (e.g. /data). Locally it defaults to adpipeline/data.
# Everything that must persist (SQLite DB, Chroma index, generated images) lives
# under here. Never hardcode container paths anywhere else.
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

CORPUS_DIR = BASE_DIR / "rag" / "corpus"            # read-only, ships in the image
CACHE_DIR = ROOT_DIR / "cache"                       # committed demo placeholders (fallback source)
ASSETS_DIR = DATA_DIR / "assets"                     # generated + reused image blobs
CHROMA_DIR = DATA_DIR / "chroma"                     # persisted embeddings (no re-embed on cold start)
DB_PATH = DATA_DIR / "adpipeline.db"
DB_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")  # swap to Postgres via env (Option B)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# Optionally serve the built React bundle from FastAPI (single-service deploy).
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

# Model routing
MODEL_STRATEGIST = "gpt-4o"
MODEL_SALES = "gpt-4o"
MODEL_MONITOR = "gpt-4o-mini"
MODEL_BRIEF = "gpt-4o-mini"
MODEL_CREATIVE = "gpt-4o"
MODEL_VISION = "gpt-4o"
MODEL_BULK = "gpt-4o-mini"
# Image model is env-overridable so the id can change (gpt-image-1 / newer) in
# the Railway dashboard without a code change.
MODEL_IMAGE = os.getenv("IMAGE_MODEL", "gpt-image-1")
MODEL_EMBED = "text-embedding-3-small"
MODEL_GEMINI = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# Rough cost per 1M tokens (USD) for cost readout
COST_TABLE = {
    "gpt-4o": {"in": 2.50, "out": 10.00},
    "gpt-4o-mini": {"in": 0.15, "out": 0.60},
    "text-embedding-3-small": {"in": 0.02, "out": 0.0},
    "gemini-2.0-flash": {"in": 0.10, "out": 0.40},
    MODEL_IMAGE: {"in": 0.0, "out": 0.0},   # priced per image, tracked separately
}

# Per-image cost by quality tier (USD, ~gpt-image-1 1024² pricing). The router
# assigns a tier per asset kind; caching means a repeat prompt costs $0.00.
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


def tier_cost(quality: str) -> float:
    return IMAGE_TIERS.get(quality, IMAGE_COST)


def quality_for(kind: str) -> str:
    return QUALITY_BY_KIND.get(kind, "medium")
