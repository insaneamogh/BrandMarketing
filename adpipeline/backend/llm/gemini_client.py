"""Gemini wrapper: chat with google_search grounding for competitor enrichment."""
import time
from typing import Optional

from config import GOOGLE_API_KEY, MODEL_GEMINI
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


def search_enrich(query: str, task: str = "gemini_search") -> str:
    """Grounded text answer using google_search. Returns text; '' on failure."""
    from google.genai import types
    t0 = time.time()
    try:
        resp = client().models.generate_content(
            model=MODEL_GEMINI,
            contents=query,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.3,
            ),
        )
    except Exception:
        return ""
    um = getattr(resp, "usage_metadata", None)
    cost.log_call(
        MODEL_GEMINI, task,
        tokens_in=getattr(um, "prompt_token_count", 0) or 0,
        tokens_out=getattr(um, "candidates_token_count", 0) or 0,
        latency_ms=int((time.time() - t0) * 1000),
    )
    return resp.text or ""
