"""Agent 2 - Strategy Planner (gemini-2.5-flash, free tier).

Second agent in the handoff chain. Receives the HUMAN-APPROVED research report
from Agent 1 and turns it into an actionable plan: the campaign angle, concrete
marketing changes grounded in the metrics, and next steps. Once the human
approves, this plan is handed to Agent 3 (Creative) as its brief.

Optionally sharpened by a free-tier Gemini google_search pass.
"""
from agents.common import (
    GROUNDING_RULE, call_validated, feedback_block, format_context,
)
from config import GOOGLE_API_KEY
from llm import gemini_client
from rag import store
from schemas import PlanOutput

SYSTEM = (
    "You are AGENT 2 - STRATEGY PLANNER in a 3-agent CPG marketing pipeline "
    "(1 research -> human gate -> 2 strategy plan -> human gate -> 3 creative "
    "-> publish). You receive Agent 1's research report AFTER a human approved "
    "it - treat that report as established fact and build on it; do not "
    "re-litigate or contradict it. Your plan becomes Agent 3's creative brief "
    "the moment the human approves it, so `campaign_angle` must be executable "
    "by an image/copy generator without further clarification.\n\n"
    + GROUNDING_RULE + "\n\n"
    "PLANNING RULES:\n"
    "- `campaign_angle` is a campaign-ready big idea in under 12 words - "
    "something a creative team could shoot tomorrow, not a category platitude. "
    "It must directly answer the biggest problem or opportunity in the research.\n"
    "- `recommended_channels` may only contain channels whose economics appear "
    "in the context or research (CPL/CVR/distribution reality).\n"
    "- COMPLIANCE: respect any BANNED CLAIMS in the brand-guidelines context; "
    "never propose an angle or change that needs a banned claim to work.\n"
    "- If a LIVE MARKET SIGNAL block is present, use it only to sharpen or "
    "re-rank - cite it as [src: live_search]; internal data always wins.\n\n"
    "EXPLAINABILITY (the reader must see the reasoning, not just the verdict):\n"
    "- `plan_summary` (3-4 sentences) tells the story: which research finding "
    "drives this plan, what the plan does about it, and what success looks "
    "like in numbers. A reader who skipped the research must still follow it.\n"
    "- Every `marketing_change` is a complete argument: `change` names the "
    "lever and the size of the move; `basis_metric` quotes the verbatim number "
    "that justifies it; `expected_impact` states the MECHANISM, not just the "
    "hope - 'because India Meta CPL is $3.10 vs $8.40 in NA, shifting 20% of "
    "NA spend should cut blended CPL ~15%' beats 'improve efficiency'. Changes "
    "must map 1:1 to issues/bright-spots in the research - no generic best "
    "practices.\n"
    "- `next_steps` are 3-6 sequenced, owner-ready actions; each names WHO "
    "(role) does WHAT by WHEN, the first executable this week; later steps "
    "reference the checkpoint that triggers them.\n"
    "- `target_segment` describes a person you could cast in an ad (age, "
    "situation, motivation), not a demographic code."
)


def _live_signal(product: str) -> str:
    """Optional free-tier google_search enrichment. '' on any failure."""
    if not GOOGLE_API_KEY:
        return ""
    return gemini_client.search_enrich(
        f"Recent competitor activity and consumer trends relevant to marketing "
        f"'{product}' (CPG). Give up to 5 short factual bullets.",
        task="gemini_search")


def run(product: str, objective: str, research_json: str = None,
        human_feedback: str = "") -> tuple[PlanOutput, list]:
    """research_json=None -> STANDALONE (solo) run: plan directly from context."""
    query = f"{product} marketing strategy {objective} positioning competitors channels growth"
    # solo runs get campaign history too, since there is no Agent 1 report to lean on
    collections = ["market_intel", "brand_guidelines", "channel_metrics"]
    if not research_json:
        collections.append("campaign_history")
    chunks = store.retrieve_many(collections, query, k=3)
    ctx = format_context(chunks)
    live = _live_signal(product)
    live_block = f"\n## LIVE MARKET SIGNAL (Gemini google_search)\n{live}\n" if live else ""

    if research_json:
        research_block = (
            "## APPROVED RESEARCH REPORT (Agent 1, human-approved - build on this)\n"
            f"{research_json}\n"
        )
    else:
        research_block = (
            "## STANDALONE MODE - NO UPSTREAM RESEARCH\n"
            "This is a solo run: no Agent 1 report exists. Ground every claim "
            "directly in the retrieved context below - do not assume or invent a "
            "prior diagnosis.\n"
        )

    user = (
        f"PRODUCT: {product}\nOBJECTIVE: {objective}\n"
        f"{feedback_block(human_feedback)}\n"
        f"{research_block}\n"
        f"## CONTEXT\n{ctx}\n{live_block}\n"
        "Produce the plan. JSON schema:\n"
        '{"plan_summary": str, "campaign_angle": str, "target_segment": str, '
        '"recommended_channels": [str], '
        '"marketing_changes": [{"change": str, "basis_metric": str, '
        '"expected_impact": str, "sources": [filename]}], '
        '"next_steps": [str]}'
    )
    out = call_validated("planner", SYSTEM, user, PlanOutput)
    return out, chunks
