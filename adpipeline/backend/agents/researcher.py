"""Agent 1 - Research & Monitor (gemini-2.5-flash, free tier).

First agent in the handoff chain. Watches the portfolio, diagnoses what's going
wrong (and what's working), and produces the research report the human approves
before it is handed off to Agent 2 (Strategy Planner).

All campaign math is precomputed HERE in code (never by the LLM) and handed to
the model as authoritative FACTS. In production these numerics would come from
live ad-platform metrics.
"""
from agents.common import (
    GROUNDING_RULE, call_validated, feedback_block, format_context,
)
from rag import store
from schemas import ResearchOutput

SYSTEM = (
    "You are AGENT 1 - RESEARCH & MONITOR in a 3-agent CPG marketing pipeline "
    "(1 research -> human gate -> 2 strategy plan -> human gate -> 3 creative "
    "-> publish). You are the pipeline's early-warning system: you diagnose "
    "what is going wrong, where the product lags, and what is quietly working. "
    "You cover three portfolios - Hill's pet nutrition (incl. Prescription Diet "
    "therapeutic), Palmolive personal care, and Skin Health (EltaMD, Filorga) - "
    "and the FACTS block tells you which one this run is about; never mix "
    "another portfolio's campaigns into the diagnosis. Your report is read by a "
    "human approver and then handed VERBATIM to the Strategy Planner - every "
    "claim must be decision-grade and cited.\n\n"
    + GROUNDING_RULE + "\n\n"
    "DIAGNOSIS RULES:\n"
    "- All numbers in the FACTS block were computed deterministically in code "
    "and are AUTHORITATIVE - never recompute, adjust, or second-guess them.\n"
    "- OBJECTIVE ALIGNMENT: the stated OBJECTIVE decides what leads the report. "
    "The finding most relevant to the objective is `whats_wrong[0]` (or, if the "
    "objective is opportunity-shaped, `whats_working[0]`). If the data "
    "CONTRADICTS the objective's premise (e.g. the objective assumes a channel "
    "is failing but its numbers are healthy), say so explicitly in the summary "
    "instead of bending the data to fit.\n"
    "- SEVERITY RUBRIC (cite monitoring_playbook.md when it is in context): "
    "'high' = ROAS below the 1.5x breakeven, a stock-out turning paid demand "
    "away, or anything directly blocking the objective; 'medium' = profitable "
    "but thin (1.5-2.5x), visibly deteriorating across flights, or dependence "
    "on one capacity-constrained channel; 'low' = watch items needing one more "
    "data point. Every below-breakeven campaign in FACTS gets a 'high' entry. "
    "Never invent an issue the FACTS or context don't support.\n"
    "- BENCHMARK CALIBRATION: never judge a number naked - position it against "
    "the portfolio's spend-weighted ROAS, the 1.5x/3.5x bars, or the public "
    "benchmarks when industry_ad_benchmarks.md is in context (a 0.9% CTR is "
    "weak on Meta vs the 2.19% median but strong on Amazon vs 0.35-0.70%). "
    "Name the reference you compared against.\n"
    "- COMPETITOR & MARKET RISK: if the context shows a competitor move or "
    "market shift that threatens a channel this portfolio depends on (e.g. a "
    "rival entering the vet channel on Amazon, a category going soft), it "
    "belongs in `whats_wrong` or `lagging` with its citation - monitoring "
    "means watching the outside too.\n"
    "- SHAPE: 2-4 `whats_wrong` ordered by dollars at stake, 2-3 `lagging`, "
    "2-3 `whats_working`. Depth beats coverage - fewer items, fully argued.\n\n"
    "EXPLAINABILITY (a non-marketer must understand every line):\n"
    "- Every `evidence` field follows CAUSE -> NUMBER -> COMPARISON -> "
    "CONSEQUENCE: quote the metric verbatim, name what you compared it against, "
    "then say what it costs or earns in plain dollars.\n"
    "  Quality bar (fictional example): 'The Winter Push flight returned 0.8x "
    "ROAS on $90k spend - every $1 in bought back $0.80, versus the 1.5x "
    "breakeven the playbook requires and the portfolio's 2.9x weighted average. "
    "Roughly $63k of that budget earned nothing.'\n"
    "- Every `action_hint` is executable Monday morning: the lever, the size of "
    "the move, and the first signal to expect (e.g. 'halve the flight's budget "
    "and move it to the 4.2x quick-commerce campaign; expect blended CPA to "
    "drop within two weeks'). 'Optimize', 'review' and 'monitor closely' are "
    "banned verbs.\n"
    "- `reason` fields answer WHY it lags (the mechanism: stock-outs, thin "
    "distributor coverage, price gap, awareness), never just THAT it lags.\n"
    "- `scale_recommendation` names the scale candidate(s) with their ROAS, "
    "says where the freed budget comes from, and why that trade wins - and "
    "respects capacity limits (a clinic-capped channel absorbs budget badly; "
    "scale what FEEDS it instead).\n"
    "- `summary` is 2-3 plain-English sentences a VP could act on without "
    "reading the rest: lead with the single most decisive number, connect it "
    "to the objective, then state the one decision it forces. No jargon "
    "without its number, no markdown formatting inside any value."
)

# Structured mirror of campaign_history.md (source of truth for the math).
CAMPAIGNS = [
    {"name": "Senior Vitality", "product": "hills", "spend": 120000, "ctr": 1.8, "cpa": 22, "roas": 3.1},
    {"name": "Vet Recommended", "product": "hills", "spend": 80000, "ctr": 3.4, "cpa": 16, "roas": 4.6},
    {"name": "Amazon Always-On", "product": "hills", "spend": 95000, "ctr": 0.9, "cpa": 19, "roas": 3.8},
    {"name": "APAC Awareness Push", "product": "hills", "spend": 110000, "ctr": 0.7, "cpa": 61, "roas": 0.9},
    {"name": "Indulgent Ritual", "product": "palmolive", "spend": 40000, "ctr": 2.1, "cpa": 9, "roas": 2.7},
    {"name": "Quick-Commerce Blitz", "product": "palmolive", "spend": 28000, "ctr": 2.8, "cpa": 6, "roas": 4.2},
    {"name": "Derm Glow", "product": "palmolive", "spend": 55000, "ctr": 1.2, "cpa": 34, "roas": 1.4},
    {"name": "7+ Renewal", "product": "hills", "spend": 70000, "ctr": 1.6, "cpa": 24, "roas": 3.0},
    {"name": "Derm Counter Trust", "product": "skin_health", "spend": 60000, "ctr": 1.5, "cpa": 18, "roas": 4.4},
    {"name": "Skinfluencer UGC", "product": "skin_health", "spend": 35000, "ctr": 3.2, "cpa": 21, "roas": 3.4},
    {"name": "Prestige Counter Revival", "product": "skin_health", "spend": 90000, "ctr": 0.8, "cpa": 70, "roas": 0.8},
    {"name": "Tmall Global Reboot", "product": "skin_health", "spend": 65000, "ctr": 1.0, "cpa": 52, "roas": 1.1},
]

BREAKEVEN_ROAS = 1.5
SCALE_ROAS = 3.5


def _which(product: str) -> str:
    """Map a product name to its campaign portfolio family."""
    p = product.lower()
    if any(k in p for k in ("eltamd", "uv clear", "filorga", "ncef", "pca skin", "skin health")):
        return "skin_health"
    if any(k in p for k in ("palmolive", "luminous", "soap", "shower", "body wash")):
        return "palmolive"
    return "hills"  # Youthful Vitality, Prescription Diet, Science Diet, ...


def _compute(product: str) -> dict:
    fam = _which(product)
    rows = [c for c in CAMPAIGNS if c["product"] == fam]
    total_spend = sum(c["spend"] for c in rows)
    w_roas = sum(c["roas"] * c["spend"] for c in rows) / total_spend if total_spend else 0
    underperformers = [c for c in rows if c["roas"] < BREAKEVEN_ROAS]
    scale_candidates = [c for c in rows if c["roas"] >= SCALE_ROAS]
    return {
        "family": fam,
        "rows": rows,
        "total_spend": total_spend,
        "weighted_roas": round(w_roas, 2),
        "underperformers": [c["name"] for c in underperformers],
        "scale_candidates": sorted(scale_candidates, key=lambda c: -c["roas"]),
    }


def run(product: str, objective: str, human_feedback: str = "",
        on_delta=None) -> tuple[ResearchOutput, list]:
    stats = _compute(product)
    query = (f"{product} campaign performance ROAS CPA sales regions channels "
             f"distribution CPL CVR OOS competitors benchmarks {objective}")
    # market_intel included so competitor moves and category shifts are visible
    # to the monitor (a rival entering your channel IS a monitoring finding)
    chunks = store.retrieve_many(
        ["campaign_history", "sales", "distribution", "channel_metrics",
         "market_intel"], query, k=3)
    ctx = format_context(chunks)

    facts = (
        f"PRECOMPUTED METRICS (authoritative - do not recompute):\n"
        f"- portfolio: {stats['family']}\n"
        f"- total spend: ${stats['total_spend']:,}\n"
        f"- spend-weighted ROAS: {stats['weighted_roas']}x\n"
        f"- below-breakeven (<{BREAKEVEN_ROAS}x ROAS): {stats['underperformers'] or 'none'}\n"
        f"- scale candidates (>= {SCALE_ROAS}x ROAS): "
        f"{[c['name'] for c in stats['scale_candidates']] or 'none'}\n"
        f"- per-campaign: {[{k: c[k] for k in ('name','roas','cpa','ctr','spend')} for c in stats['rows']]}\n"
    )

    user = (
        f"PRODUCT: {product}\nOBJECTIVE: {objective}\n"
        f"{feedback_block(human_feedback)}\n"
        f"## FACTS\n{facts}\n## CONTEXT\n{ctx}\n\n"
        "JSON schema:\n"
        '{"summary": str, '
        '"whats_wrong": [{"issue": str, "severity": "low|medium|high", '
        '"evidence": str, "action_hint": str, "sources": [filename]}], '
        '"lagging": [{"where": str, "reason": str, "sources": [filename]}], '
        '"whats_working": [{"item": str, "evidence": str, "sources": [filename]}], '
        '"scale_recommendation": str}'
    )
    out = call_validated("researcher", SYSTEM, user, ResearchOutput,
                         on_delta=on_delta)
    return out, chunks
