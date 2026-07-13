"""Shared agent helpers: context formatting, citation grounding, validated calls.

All chat goes through llm.router (Gemini free tier, gpt-4o-mini lifeline) -
agents name a task, never a provider.
"""
import json
from typing import List, Type

from pydantic import BaseModel, ValidationError

from llm import router

GROUNDING_RULE = (
    "GROUNDING RULES (non-negotiable):\n"
    "1. Answer ONLY from the retrieved context blocks below. Never invent facts, "
    "figures, regions, channels, or campaign names that are not in the context.\n"
    "2. Every claim MUST cite its source filename in a `sources` field (or inline "
    "as [src: filename]) using ONLY the filenames shown in the context tags.\n"
    "3. Copy numbers (CPL, CVR, ROAS, %, $) VERBATIM from the context - never "
    "round, estimate, or recompute them.\n"
    "4. If the context does not support a claim, omit the claim entirely.\n"
    "5. Return a single JSON object only - no markdown, no prose outside JSON."
)


def format_context(chunks: List[dict]) -> str:
    """Render retrieved chunks with explicit [src: filename] tags for grounding."""
    if not chunks:
        return "(no context retrieved)"
    blocks = []
    for c in chunks:
        blocks.append(f"[src: {c['source']}] (relevance {c.get('score')})\n{c['text']}")
    return "\n\n---\n\n".join(blocks)


def sources_list(chunks: List[dict]) -> List[str]:
    seen, out = set(), []
    for c in chunks:
        s = c["source"]
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def feedback_block(feedback: str) -> str:
    if not feedback:
        return ""
    return (
        "\n\n## PRIOR HUMAN FEEDBACK (a previous brief was REJECTED)\n"
        "The human approver rejected the last brief for the reason below. This "
        "feedback OVERRIDES your default emphasis - visibly change your output to "
        "address it, and do not repeat the rejected direction:\n"
        f"{feedback}\n"
    )


def call_validated(task: str, system: str, user: str,
                   schema: Type[BaseModel], temperature: float = 0.3) -> BaseModel:
    """router.chat_json + Pydantic validation. One retry with the schema on error."""
    data = router.chat_json(task, system, user, temperature)
    try:
        return schema.model_validate(data)
    except ValidationError as e:
        fix_user = (
            f"{user}\n\nYour previous JSON failed schema validation with errors:\n{e}\n\n"
            f"Return JSON matching EXACTLY this JSON Schema:\n"
            f"{json.dumps(schema.model_json_schema())}"
        )
        data = router.chat_json(task, system, fix_user, 0)
        return schema.model_validate(data)
