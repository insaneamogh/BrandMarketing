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
    + GROUNDING_RULE + "\n"
    "CITATION CARRY-THROUGH: the approved research report counts as grounded "
    "input. When a number comes from a research item, cite the SAME source "
    "filenames that research item lists in its own `sources` - never leave a "
    "research-derived claim uncited and never invent a filename for it.\n\n"
    "PLANNING RULES:\n"
    "- `campaign_angle` follows the formula: audience tension + product truth "
    "+ a concrete visual idea, in under 12 words - something a creative team "
    "could shoot tomorrow ('Seven is the new two: breakfast that brings the "
    "zoomies back'), never a category platitude ('Quality nutrition for happy "
    "pets'). It must answer the research's biggest problem or opportunity, and "
    "every word must be compliant with the brand guidelines in context.\n"
    "- BUDGET DISCIPLINE (cite monitoring_playbook.md when in context): "
    "reallocate before requesting new money - moves net to roughly zero unless "
    "the objective authorizes incremental spend; fund scale candidates from "
    "below-breakeven flights first; cap any single cut at ~50% of the source "
    "campaign's budget; never pour budget into a capacity-constrained channel "
    "- fund what FEEDS it instead.\n"
    "- SHAPE: 3-5 `marketing_changes` ordered by expected dollar impact. The "
    "first change must attack the research's #1 problem; at least one change "
    "must protect or scale the research's top bright spot. Each change names "
    "its size in $ or % - a change without a size is an opinion.\n"
    "- `recommended_channels` may only contain channels whose economics appear "
    "in the context or research (CPL/CVR/distribution reality).\n"
    "- COMPLIANCE: respect any BANNED CLAIMS in the brand-guidelines context; "
    "never propose an angle or change that needs a banned claim to work.\n"
    "- If a LIVE MARKET SIGNAL block is present, use it only to sharpen or "
    "re-rank - cite it as [src: live_search]; internal data always wins.\n\n"
    "EXPLAINABILITY (the reader must see the reasoning, not just the verdict):\n"
    "- `plan_summary` (4-5 sentences) tells the whole story: (1) the research "
    "finding that drives the plan, with its number; (2) what the plan does "
    "about it; (3) one alternative direction you considered and why this one "
    "beats it; (4) the success checkpoint - 'in 4 weeks, metric X moves from "
    "A to B', using the verbatim baseline as A. A reader who skipped the "
    "research must still follow every step.\n"
    "- Every `marketing_change` is a complete argument: `change` names the "
    "lever AND the size of the move; `basis_metric` quotes the verbatim number "
    "that justifies it; `expected_impact` states the MECHANISM, not the hope - "
    "'because India Meta CPL is $3.10 vs $8.40 in NA, shifting 20% of NA spend "
    "should cut blended CPL ~15%' beats 'improve efficiency'. Changes map 1:1 "
    "to research issues/bright-spots - no generic best practices.\n"
    "- `next_steps` are 3-6 sequenced, owner-ready actions; each names WHO "
    "(role) does WHAT by WHEN; steps 1-2 are executable this week; later steps "
    "name the checkpoint that triggers them ('if CPA holds under $10 at two "
    "weeks, take the second half of the budget move').\n"
    "- `target_segment` describes a person you could cast in an ad (age, "
    "situation, motivation - 'a 58-year-old whose beagle now hesitates at the "
    "stairs'), never a demographic code. No markdown inside any value.\n\n"
    "STANDALONE MODE: when no research report is present, open `plan_summary` "
    "with a one-sentence mini-diagnosis naming the decisive metric you found "
    "in the retrieved context, then plan from it exactly as above."
)


def _live_signal(product: str, objective: str = "") -> str:
    """Optional free-tier google_search enrichment. '' on any failure."""
    if not GOOGLE_API_KEY:
        return ""
    return gemini_client.search_enrich(
        f"Recent (last 12 months) competitor moves, pricing/channel shifts and "
        f"consumer trends relevant to marketing '{product}' (CPG)"
        + (f" toward this objective: {objective}." if objective else ".")
        + " Give up to 5 short factual bullets, each with a date or timeframe "
          "and the company/source named. Facts only - no advice.",
        task="gemini_search")


def run(product: str, objective: str, research_json: str = None,
        human_feedback: str = "", on_delta=None) -> tuple[PlanOutput, list]:
    """research_json=None -> STANDALONE (solo) run: plan directly from context."""
    import concurrent.futures
    query = f"{product} marketing strategy {objective} positioning competitors channels growth"
    # solo runs get campaign history too, since there is no Agent 1 report to lean on
    collections = ["market_intel", "brand_guidelines", "channel_metrics"]
    if not research_json:
        collections.append("campaign_history")
    # the google_search grounding call adds 10-30s - run it CONCURRENTLY with
    # retrieval instead of serially (was a big chunk of the plan-stage latency)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        live_fut = pool.submit(_live_signal, product, objective)
        chunks = store.retrieve_many(collections, query, k=3)
        try:
            live = live_fut.result(timeout=25)   # never let search stall the plan
        except Exception:
            live = ""
    ctx = format_context(chunks)
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
    out = call_validated("planner", SYSTEM, user, PlanOutput, on_delta=on_delta)
    return out, chunks
