"""pick_model(task) -> model id. Central routing so agents stay declarative."""
from config import (
    MODEL_BRIEF, MODEL_BULK, MODEL_CREATIVE, MODEL_MONITOR, MODEL_SALES,
    MODEL_STRATEGIST, MODEL_VISION,
)

_MAP = {
    "strategist": MODEL_STRATEGIST,
    "sales": MODEL_SALES,
    "monitor": MODEL_MONITOR,
    "brief": MODEL_BRIEF,
    "creative": MODEL_CREATIVE,
    "placement": MODEL_CREATIVE,
    "vision": MODEL_VISION,
    "copy": MODEL_BULK,
}


def pick_model(task: str) -> str:
    return _MAP.get(task, MODEL_BULK)
