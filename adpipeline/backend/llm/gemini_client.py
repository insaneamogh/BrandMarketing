"""Gemini wrapper — the FREE-tier workhorse.

Handles: JSON-mode chat, vision (URL diagnosis), embeddings, image gen
(gemini-2.5-flash-image "nano banana"), and google_search grounding.
Every call is logged to SQLite; free-tier rows cost $0.00 but tokens still show
in the /cost readout. 429s (free-tier rate limits) get two backoff retries.
"""
import json
import time
from typing import List

import requests

from config import (
    GOOGLE_API_KEY, EMBED_DIM, MODEL_EMBED_GEMINI, MODEL_GEMINI_SEARCH,
    MODEL_IMAGE_GEMINI,
)
from llm import cost

_client = None


def client():
    global _client
    if _client is None:
        if not GOOGLE_API_KEY:
            raise RuntimeError("GOOGLE_API_KEY not set")
        from google import genai
        _client = genai.Client(api_key=GOOGLE_API_KEY)
    return _client


def _with_retry(fn, retries: int = 2):
    """Free-tier RPM limits surface as 429/RESOURCE_EXHAUSTED. Back off and retry."""
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            msg = str(e)
            transient = "429" in msg or "RESOURCE_EXHAUSTED" in msg or "503" in msg
            if not transient or attempt == retries:
                raise
            time.sleep(3 * (attempt + 1))


def _log(model: str, task: str, resp, t0: float):
    um = getattr(resp, "usage_metadata", None)
    cost.log_call(
        model, task,
        tokens_in=getattr(um, "prompt_token_count", 0) or 0,
        tokens_out=getattr(um, "candidates_token_count", 0) or 0,
        latency_ms=int((time.time() - t0) * 1000),
    )


# ---------- chat (JSON mode) ----------
def chat_json(model: str, system: str, user: str, task: str,
              temperature: float = 0.3) -> dict:
    """JSON-mode chat. Returns parsed dict. One retry on bad JSON."""
    from google.genai import types

    def _call(contents, temp):
        t0 = time.time()
        resp = _with_retry(lambda: client().models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=temp,
                response_mime_type="application/json",
            ),
        ))
        _log(model, task, resp, t0)
        return resp.text or ""

    text = _call(user, temperature)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        text = _call(
            f"{user}\n\nYour previous output was not valid JSON:\n{text}\n\n"
            "Return ONLY a valid JSON object, nothing else.", 0)
        return json.loads(text)


# ---------- vision ----------
def vision_json(model: str, system: str, user: str, image_urls: List[str],
                task: str) -> dict:
    """Vision over up to 3 image URLs -> JSON. Gemini needs inline bytes, so we
    download each URL; unreachable images are skipped rather than failing."""
    from google.genai import types

    parts = [types.Part.from_text(text=user)]
    for u in image_urls[:3]:
        try:
            r = requests.get(u, timeout=8)
            r.raise_for_status()
            mime = r.headers.get("Content-Type", "image/jpeg").split(";")[0]
            if not mime.startswith("image/"):
                mime = "image/jpeg"
            parts.append(types.Part.from_bytes(data=r.content, mime_type=mime))
        except Exception:
            continue

    t0 = time.time()
    resp = _with_retry(lambda: client().models.generate_content(
        model=model,
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2,
            response_mime_type="application/json",
        ),
    ))
    _log(model, task, resp, t0)
    return json.loads(resp.text or "{}")


# ---------- embeddings ----------
def embed(texts: List[str]) -> List[List[float]]:
    """Free-tier embeddings (gemini-embedding-001 @ 768 dims)."""
    from google.genai import types
    t0 = time.time()
    resp = _with_retry(lambda: client().models.embed_content(
        model=MODEL_EMBED_GEMINI,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM),
    ))
    cost.log_call(MODEL_EMBED_GEMINI, "embed",
                  latency_ms=int((time.time() - t0) * 1000))
    return [e.values for e in resp.embeddings]


# ---------- image gen (nano banana, free tier) ----------
def generate_image(prompt: str, aspect: str = "1:1", quality: str = "medium",
                   task: str = "image", reference_png: bytes = None) -> bytes:
    """gemini-2.5-flash-image. Free tier -> logged at $0. Raises on failure
    (caller handles placeholder fallback). reference_png: optional uploaded
    reference the generation should stay faithful to (image+text prompting)."""
    from google.genai import types
    t0 = time.time()
    cfg = types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
    text = prompt
    try:  # aspect via image_config where the SDK supports it
        cfg.image_config = types.ImageConfig(aspect_ratio=aspect)
    except Exception:
        text = f"{prompt} Aspect ratio {aspect}."
    if reference_png:
        contents = [
            types.Part.from_bytes(data=reference_png, mime_type="image/png"),
            types.Part.from_text(
                text=f"Use the attached image as the product reference — keep the "
                     f"product, pack and branding faithful to it. {text}"),
        ]
    else:
        contents = text
    resp = _with_retry(lambda: client().models.generate_content(
        model=MODEL_IMAGE_GEMINI, contents=contents, config=cfg))
    _log(MODEL_IMAGE_GEMINI, f"{task}:{quality}", resp, t0)
    for part in resp.candidates[0].content.parts:
        if getattr(part, "inline_data", None) and part.inline_data.data:
            return part.inline_data.data
    raise RuntimeError("gemini image response contained no image data")


# ---------- google_search grounding ----------
def search_enrich(query: str, task: str = "gemini_search") -> str:
    """Grounded text answer using google_search. Returns text; '' on failure.

    Runs on MODEL_GEMINI_SEARCH (gemini-2.5-flash) — the one task NOT on the
    default text model, because search grounding is tied to this model tier.
    """
    from google.genai import types
    t0 = time.time()
    try:
        resp = _with_retry(lambda: client().models.generate_content(
            model=MODEL_GEMINI_SEARCH,
            contents=query,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.3,
            ),
        ))
    except Exception:
        return ""
    _log(MODEL_GEMINI_SEARCH, task, resp, t0)
    return resp.text or ""
