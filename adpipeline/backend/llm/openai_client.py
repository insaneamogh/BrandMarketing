"""OpenAI wrapper: chat (json mode), vision, embeddings, image gen. All logged."""
import base64
import json
import time
from typing import List, Optional

from openai import OpenAI

from config import MODEL_EMBED, MODEL_IMAGE, OPENAI_API_KEY
from llm import cost

_client: Optional[OpenAI] = None


def client() -> OpenAI:
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not set")
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def chat_json(model: str, system: str, user: str, task: str,
              temperature: float = 0.3) -> dict:
    """Chat completion in JSON mode. Returns parsed dict. One retry on bad JSON."""
    t0 = time.time()
    resp = client().chat.completions.create(
        model=model,
        temperature=temperature,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    _log(model, task, resp, t0)
    content = resp.choices[0].message.content
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        t0 = time.time()
        resp = client().chat.completions.create(
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
                {"role": "assistant", "content": content},
                {"role": "user", "content": "Return valid JSON only."},
            ],
        )
        _log(model, task + ":retry", resp, t0)
        return json.loads(resp.choices[0].message.content)


def vision_json(model: str, system: str, user: str, image_urls: List[str],
                task: str) -> dict:
    """Vision call over up to 3 image URLs -> JSON."""
    content = [{"type": "text", "text": user}]
    for u in image_urls[:3]:
        content.append({"type": "image_url", "image_url": {"url": u}})
    t0 = time.time()
    resp = client().chat.completions.create(
        model=model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": content},
        ],
    )
    _log(model, task, resp, t0)
    return json.loads(resp.choices[0].message.content)


def embed(texts: List[str]) -> List[List[float]]:
    resp = client().embeddings.create(model=MODEL_EMBED, input=texts)
    tokens = resp.usage.total_tokens if resp.usage else 0
    cost.log_call(MODEL_EMBED, "embed", tokens_in=tokens)
    return [d.embedding for d in resp.data]


def generate_image(prompt: str, aspect: str = "1:1", quality: str = "medium",
                   task: str = "image") -> bytes:
    """Image gen. Returns PNG bytes. Raises on failure (caller handles cache).

    Cost is logged at the requested quality tier; a repeat prompt never reaches
    here (the caller's prompt-hash cache short-circuits it at $0).
    """
    from config import tier_cost
    size = {"1:1": "1024x1024", "4:5": "1024x1280",
            "9:16": "1024x1536", "16:9": "1536x1024"}.get(aspect, "1024x1024")
    resp = client().images.generate(
        model=MODEL_IMAGE, prompt=prompt, size=size, n=1, quality=quality,
    )
    cost.log_image(MODEL_IMAGE, f"{task}:{quality}", cost_usd=tier_cost(quality))
    return base64.b64decode(resp.data[0].b64_json)


def _log(model, task, resp, t0):
    u = resp.usage
    cost.log_call(
        model, task,
        tokens_in=u.prompt_tokens if u else 0,
        tokens_out=u.completion_tokens if u else 0,
        latency_ms=int((time.time() - t0) * 1000),
    )
