"""Agent 2 — Sales & Distribution Analyst (gpt-4o).

Retrieves sales/distribution/channel_metrics. Reports where selling, laggards,
CPL/CVR by channel, and key risks — all cited.
"""
from agents.common import (
    GROUNDING_RULE, call_validated, feedback_block, format_context,
)
from llm.router import pick_model
from rag import store
from schemas import SalesOutput


def run(product: str, objective: str, human_feedback: str = "") -> tuple[SalesOutput, list]:
    query = f"{product} sales regions channels distribution CPL CVR OOS quick-commerce {objective}"
    chunks = store.retrieve_many(
        ["sales", "distribution", "channel_metrics"], query, k=4)
    ctx = format_context(chunks)

    system = GROUNDING_RULE
    user = (
        f"PRODUCT: {product}\nOBJECTIVE: {objective}\n"
        f"{feedback_block(human_feedback)}\n"
        f"## CONTEXT\n{ctx}\n\n"
        "Report distribution and channel efficiency. JSON schema:\n"
        '{"where_selling": [{"region": str, "channel": str, "status": str}], '
        '"lagging": [{"region": str, "reason": str, "sources": [filename]}], '
        '"cpl_by_channel": [{"channel": str, "region": str, "value": str, "sources": [filename]}], '
        '"cvr_by_channel": [{"channel": str, "region": str, "value": str, "sources": [filename]}], '
        '"key_risks": [str]}\n'
        "Pull CPL/CVR figures verbatim from channel_metrics.md where present."
    )
    out = call_validated(pick_model("sales"), system, user, "sales", SalesOutput)
    return out, chunks
