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

CACHE_DIR = ROOT_DIR / "cache"
CORPUS_DIR = BASE_DIR / "rag" / "corpus"
CHROMA_DIR = BASE_DIR / "rag" / ".chroma"
DB_PATH = BASE_DIR / "adpipeline.db"
DB_URL = f"sqlite:///{DB_PATH}"

# Model routing
MODEL_STRATEGIST = "gpt-4o"
MODEL_SALES = "gpt-4o"
MODEL_MONITOR = "gpt-4o-mini"
MODEL_BRIEF = "gpt-4o-mini"
MODEL_CREATIVE = "gpt-4o"
MODEL_VISION = "gpt-4o"
MODEL_BULK = "gpt-4o-mini"
MODEL_IMAGE = "gpt-image-1"
MODEL_EMBED = "text-embedding-3-small"
MODEL_GEMINI = "gemini-2.0-flash"

# Rough cost per 1M tokens (USD) for cost readout
COST_TABLE = {
    "gpt-4o": {"in": 2.50, "out": 10.00},
    "gpt-4o-mini": {"in": 0.15, "out": 0.60},
    "text-embedding-3-small": {"in": 0.02, "out": 0.0},
    "gemini-2.0-flash": {"in": 0.10, "out": 0.40},
    "gpt-image-1": {"in": 0.0, "out": 0.0},  # priced per image, tracked separately
}
IMAGE_COST = 0.04  # per image, flat estimate
