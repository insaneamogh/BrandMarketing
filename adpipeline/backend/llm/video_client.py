"""Seedance (BytePlus ModelArk) text-to-video - OPTIONAL, explicitly triggered.

Async task API: create task -> poll -> download mp4. Only ever called when
SEEDANCE_API_KEY is set AND the user clicks "Generate video" on a /bundle
creative - never automatically inside a skill run (cost control). One video
per creative (MAX_VIDEO_CALLS_PER_CREATIVE) and a fixed 5s/720p spec keep the
worst case around SEEDANCE_COST_PER_VIDEO.
"""
import time

import requests

from config import (
    SEEDANCE_API_KEY, SEEDANCE_BASE_URL, SEEDANCE_COST_PER_VIDEO,
    SEEDANCE_DURATION_S, SEEDANCE_MODEL, SEEDANCE_RESOLUTION,
)
from llm import cost

_POLL_S = 5
_TIMEOUT_S = 240


def enabled() -> bool:
    return bool(SEEDANCE_API_KEY)


def _headers():
    return {"Authorization": f"Bearer {SEEDANCE_API_KEY}",
            "Content-Type": "application/json"}


def generate_video(prompt: str, aspect: str = "16:9",
                   task: str = "video") -> bytes:
    """Text-to-video. Returns mp4 bytes. Raises on failure or timeout."""
    if not enabled():
        raise RuntimeError("SEEDANCE_API_KEY not set")
    t0 = time.time()
    text = (f"{prompt} --ratio {aspect} --resolution {SEEDANCE_RESOLUTION} "
            f"--duration {SEEDANCE_DURATION_S} --watermark false")
    r = requests.post(
        f"{SEEDANCE_BASE_URL}/contents/generations/tasks",
        headers=_headers(),
        json={"model": SEEDANCE_MODEL,
              "content": [{"type": "text", "text": text}]},
        timeout=30)
    r.raise_for_status()
    task_id = r.json()["id"]

    video_url = None
    deadline = time.time() + _TIMEOUT_S
    while time.time() < deadline:
        time.sleep(_POLL_S)
        s = requests.get(
            f"{SEEDANCE_BASE_URL}/contents/generations/tasks/{task_id}",
            headers=_headers(), timeout=30)
        s.raise_for_status()
        body = s.json()
        status = body.get("status")
        if status == "succeeded":
            video_url = (body.get("content") or {}).get("video_url")
            break
        if status in ("failed", "cancelled"):
            raise RuntimeError(f"seedance task {status}: {body.get('error')}")
    if not video_url:
        raise TimeoutError("seedance video generation timed out")

    mp4 = requests.get(video_url, timeout=60)
    mp4.raise_for_status()
    cost.log_call(SEEDANCE_MODEL, task,
                  latency_ms=int((time.time() - t0) * 1000),
                  cost_usd=SEEDANCE_COST_PER_VIDEO)
    return mp4.content
