"""Shared agent helpers: context formatting, citation grounding, validated calls."""
import json
from typing import List, Type

from pydantic import BaseModel, ValidationError

from llm import openai_client

GROUNDING_RULE = (
    "You are a marketing analyst. Answer ONLY from the retrieved context below. "
    "Do not invent facts. Every claim you make MUST cite its source filename in a "
    "`sources` field (or inline as [src: filename]) using ONLY the filenames shown. "
    "If the context does not support a claim, omit it. Return JSON only."
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
        "\n\n## PRIOR HUMAN FEEDBACK (a previous brief was REJECTED). "
        "You MUST address this feedback and change your output accordingly:\n"
        f"{feedback}\n"
    )


def call_validated(model: str, system: str, user: str, task: str,
                   schema: Type[BaseModel], temperature: float = 0.3) -> BaseModel:
    """chat_json + Pydantic validation. One retry with the schema on validation error."""
    data = openai_client.chat_json(model, system, user, task, temperature)
    try:
        return schema.model_validate(data)
    except ValidationError as e:
        fix_user = (
            f"{user}\n\nYour previous JSON failed schema validation with errors:\n{e}\n\n"
            f"Return JSON matching EXACTLY this JSON Schema:\n"
            f"{json.dumps(schema.model_json_schema())}"
        )
        data = openai_client.chat_json(model, system, fix_user, task + ":schema_retry", 0)
        return schema.model_validate(data)
