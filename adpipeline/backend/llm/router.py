"""Provider router - the ONE place the cost policy is enforced.

pick_model(task) -> model id (Gemini free tier for all text/vision).
chat_json / vision_json dispatch on the model id prefix:
    gemini-*  -> gemini_client (free)  -> on failure, gpt-4o-mini fallback
    gpt-*     -> openai_client (paid)
embed() dispatches on EMBED_PROVIDER (no silent fallback - the Chroma index is
dimension-locked to one provider; delete DATA_DIR/chroma before switching).
generate_image() dispatches on IMAGE_PROVIDER (openai = the $10 budget,
gemini = free-tier drafts).
Agents stay declarative: they name a task, never a provider.
"""
from typing import List

from config import (
    IMAGE_PROVIDER, EMBED_PROVIDER, MODEL_BULK, MODEL_CREATIVE,
    MODEL_FALLBACK_TEXT, MODEL_STRATEGIST, MODEL_VISION, OPENAI_API_KEY,
)
from llm import gemini_client, openai_client

_MAP = {
    "researcher": MODEL_STRATEGIST,     # Agent 1 - diagnosis needs reasoning
    "planner": MODEL_STRATEGIST,        # Agent 2 - plan building needs reasoning
    "placement": MODEL_CREATIVE,        # Agent 3 - placement + expected metrics
    "vision": MODEL_VISION,             # Agent 3 - URL diagnosis
    "copy": MODEL_BULK,                 # Agent 3 - copy blocks (lite)
    "image_prompts": MODEL_STRATEGIST,  # Agent 3 - prompt compiler needs the
                                        # strong text model, not lite
    "refine": MODEL_STRATEGIST,         # objective sharpener (UI sparkle button)
}


def pick_model(task: str) -> str:
    return _MAP.get(task, MODEL_BULK)


def chat_json(task: str, system: str, user: str,
              temperature: float = 0.3) -> dict:
    """JSON chat routed by task. Gemini free tier first; paid mini as a lifeline
    so a rate-limited demo never dies (~$0.001/fallback call)."""
    model = pick_model(task)
    if model.startswith("gemini"):
        try:
            return gemini_client.chat_json(model, system, user, task, temperature)
        except Exception:
            if not OPENAI_API_KEY:
                raise
            return openai_client.chat_json(
                MODEL_FALLBACK_TEXT, system, user, f"{task}:fallback", temperature)
    return openai_client.chat_json(model, system, user, task, temperature)


def vision_json(task: str, system: str, user: str, image_urls: List[str]) -> dict:
    model = pick_model(task)
    if model.startswith("gemini"):
        try:
            return gemini_client.vision_json(model, system, user, image_urls, task)
        except Exception:
            if not OPENAI_API_KEY:
                raise
            return openai_client.vision_json(
                MODEL_FALLBACK_TEXT, system, user, image_urls, f"{task}:fallback")
    return openai_client.vision_json(model, system, user, image_urls, task)


def embed(texts: List[str]) -> List[List[float]]:
    if EMBED_PROVIDER == "gemini":
        return gemini_client.embed(texts)
    return openai_client.embed(texts)


def generate_image(prompt: str, aspect: str = "1:1", quality: str = "medium",
                   task: str = "image", reference_png: bytes = None) -> bytes:
    """reference_png (optional): a user-uploaded product/reference image the
    generation should stay faithful to (OpenAI images.edit / Gemini img+text)."""
    if IMAGE_PROVIDER == "gemini":
        return gemini_client.generate_image(prompt, aspect, quality, task,
                                            reference_png=reference_png)
    return openai_client.generate_image(prompt, aspect, quality, task,
                                        reference_png=reference_png)


def generate_images(prompt: str, aspect: str = "1:1", quality: str = "medium",
                    task: str = "image", reference_png: bytes = None,
                    n: int = 1) -> List[bytes]:
    """n=1-4 variations. OpenAI gets n in ONE API request; Gemini loops (free)."""
    if IMAGE_PROVIDER == "gemini":
        return gemini_client.generate_images(prompt, aspect, quality, task,
                                             reference_png=reference_png, n=n)
    return openai_client.generate_images(prompt, aspect, quality, task,
                                         reference_png=reference_png, n=n)
