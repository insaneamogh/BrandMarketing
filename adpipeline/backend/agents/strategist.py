"""Agent 1 — Marketing Strategist (gpt-4o). Retrieves market_intel + brand_guidelines."""
from agents.common import (
    GROUNDING_RULE, call_validated, feedback_block, format_context,
)
from llm.router import pick_model
from rag import store
from schemas import StrategistOutput


def run(product: str, objective: str, human_feedback: str = "") -> tuple[StrategistOutput, list]:
    query = f"{product} marketing strategy {objective} positioning competitors growth"
    chunks = store.retrieve_many(["market_intel", "brand_guidelines"], query, k=4)
    ctx = format_context(chunks)

    system = (
        GROUNDING_RULE + " Respect BANNED CLAIMS in any brand guidelines context; "
        "never propose an angle that would require a banned claim."
    )
    user = (
        f"PRODUCT: {product}\nOBJECTIVE: {objective}\n"
        f"{feedback_block(human_feedback)}\n"
        f"## CONTEXT\n{ctx}\n\n"
        "Produce exactly 3 distinct strategies. JSON schema:\n"
        '{"strategies": [{"angle": str, "insight": str, "target_segment": str, '
        '"recommended_channel": str, "sources": [filename, ...]}]}\n'
        "Each strategy must be grounded in and cite the context filenames."
    )
    out = call_validated(pick_model("strategist"), system, user, "strategist", StrategistOutput)
    return out, chunks
