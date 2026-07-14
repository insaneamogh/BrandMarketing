"""Gemini wrapper - the FREE-tier workhorse.

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
    COST_TABLE, GEMINI_CACHED_INPUT_RATE, GEMINI_MAX_OUTPUT_TOKENS,
    GEMINI_THINKING_BUDGET, GOOGLE_API_KEY, EMBED_DIM, MODEL_EMBED_GEMINI,
    MODEL_GEMINI_SEARCH, MODEL_IMAGE_GEMINI,
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


def _is_daily_cap(msg: str) -> bool:
    """A daily free-tier quota is exhausted (as opposed to a per-minute burst).
    These will NOT recover within a short retry window, so we must fail fast and
    let the router fall back to gpt-4o-mini immediately instead of sleeping."""
    m = msg.lower()
    return ("perday" in m or "per day" in m or "per-day" in m
            or "requests per day" in m or "daily" in m
            or ("quota" in m and "perminute" not in m and "per minute" not in m))


def _with_retry(fn, retries: int = 2):
    """Free-tier PER-MINUTE limits surface as 429/RESOURCE_EXHAUSTED and clear in
    a few seconds - back off and retry those. A DAILY quota cap (or any
    non-transient error) is raised immediately so the caller's gpt-4o-mini
    fallback kicks in without a pointless ~9s wait."""
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            msg = str(e)
            transient = ("503" in msg
                         or (("429" in msg or "RESOURCE_EXHAUSTED" in msg)
                             and not _is_daily_cap(msg)))
            if not transient or attempt == retries:
                raise
            time.sleep(3 * (attempt + 1))


def _paid_cost(model: str, tin: int, tout: int, tcached: int = 0) -> float:
    """Per-call USD at paid-tier rates. Tokens served from Gemini's implicit
    prompt cache bill at GEMINI_CACHED_INPUT_RATE (25%) of the input price."""
    t = COST_TABLE.get(model, {"in": 0.0, "out": 0.0})
    fresh_in = max(0, tin - tcached)
    return ((fresh_in / 1_000_000) * t["in"]
            + (tcached / 1_000_000) * t["in"] * GEMINI_CACHED_INPUT_RATE
            + (tout / 1_000_000) * t["out"])


def _log(model: str, task: str, resp, t0: float):
    um = getattr(resp, "usage_metadata", None)
    tin = getattr(um, "prompt_token_count", 0) or 0
    tout = getattr(um, "candidates_token_count", 0) or 0
    tcached = getattr(um, "cached_content_token_count", 0) or 0
    cost.log_call(
        model, task + (":cached" if tcached else ""),
        tokens_in=tin, tokens_out=tout,
        latency_ms=int((time.time() - t0) * 1000),
        cost_usd=_paid_cost(model, tin, tout, tcached),
    )


def _gen_config(system: str, temp: float):
    """GenerateContentConfig with the latency controls applied:
    - thinking budget 0 (flash models otherwise 'think' for 30-90s before the
      first token on big JSON tasks - the cause of the 2-minute agent calls)
    - max_output_tokens cap so a response can't ramble unbounded."""
    from google.genai import types
    kwargs = dict(
        system_instruction=system,
        temperature=temp,
        response_mime_type="application/json",
        max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
    )
    try:
        kwargs["thinking_config"] = types.ThinkingConfig(
            thinking_budget=GEMINI_THINKING_BUDGET)
    except Exception:
        pass  # SDK without ThinkingConfig - proceed without
    return types.GenerateContentConfig(**kwargs)


def _strip_thinking_kwarg(cfg):
    """Rebuild the config without thinking_config (for models that reject it)."""
    from google.genai import types
    return types.GenerateContentConfig(
        system_instruction=cfg.system_instruction,
        temperature=cfg.temperature,
        response_mime_type="application/json",
        max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
    )


# ---------- chat (JSON mode, streaming-capable) ----------
def chat_json(model: str, system: str, user: str, task: str,
              temperature: float = 0.3, on_delta=None) -> dict:
    """JSON-mode chat. Returns parsed dict. One retry on bad JSON.

    on_delta(text_chunk): when provided, uses generate_content_stream and fires
    for every token chunk as it arrives - this is what feeds the live output
    console in the UI, so the user watches the JSON being written instead of
    staring at a spinner."""

    def _call(contents, temp, stream):
        cfg = _gen_config(system, temp)
        t0 = time.time()

        def _run(config):
            if stream:
                pieces, last = [], None
                for chunk in client().models.generate_content_stream(
                        model=model, contents=contents, config=config):
                    piece = chunk.text or ""
                    if piece:
                        pieces.append(piece)
                        try:
                            on_delta(piece)
                        except Exception:
                            pass  # a UI-side error must never kill the call
                    last = chunk
                _log(model, task, last, t0) if last is not None else None
                return "".join(pieces)
            resp = client().models.generate_content(
                model=model, contents=contents, config=config)
            _log(model, task, resp, t0)
            return resp.text or ""

        try:
            return _with_retry(lambda: _run(cfg))
        except Exception as e:
            # some model ids reject thinking_config - retry once without it
            if "thinking" in str(e).lower():
                return _with_retry(lambda: _run(_strip_thinking_kwarg(cfg)))
            raise

    text = _call(user, temperature, stream=bool(on_delta))
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        text = _call(
            f"{user}\n\nYour previous output was not valid JSON:\n{text}\n\n"
            "Return ONLY a valid JSON object, nothing else.", 0, stream=False)
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
    """Gemini embeddings (gemini-embedding-001 @ 768 dims). Paid tier: input
    tokens are estimated (~4 chars/token) since the embed response carries no
    usage metadata - close enough for the cost readout."""
    from google.genai import types
    t0 = time.time()
    resp = _with_retry(lambda: client().models.embed_content(
        model=MODEL_EMBED_GEMINI,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM),
    ))
    est_tokens = sum(max(1, len(t) // 4) for t in texts)
    cost.log_call(MODEL_EMBED_GEMINI, "embed",
                  tokens_in=est_tokens,
                  latency_ms=int((time.time() - t0) * 1000),
                  cost_usd=_paid_cost(MODEL_EMBED_GEMINI, est_tokens, 0))
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
                text=f"Use the attached image as the product reference - keep the "
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


def generate_images(prompt: str, aspect: str = "1:1", quality: str = "medium",
                    task: str = "image", reference_png: bytes = None,
                    n: int = 1) -> List[bytes]:
    """n-variation parity with the OpenAI client. The Gemini image API has no
    n parameter, so this loops n single requests (free tier, $0 each)."""
    return [generate_image(prompt, aspect, quality, task, reference_png)
            for _ in range(max(1, min(4, n)))]


# ---------- google_search grounding ----------
def search_enrich(query: str, task: str = "gemini_search") -> str:
    """Grounded text answer using google_search. Returns text; '' on failure.

    Runs on MODEL_GEMINI_SEARCH (gemini-2.5-flash) - the one task NOT on the
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
