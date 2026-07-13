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
    "- `whats_wrong`: every below-breakeven campaign in FACTS gets an entry with "
    "severity 'high', its evidence quoted verbatim, and a concrete action_hint "
    "(pause, cut spend %, restructure). 'medium' = drifting/declining; 'low' = "
    "watch item. Never invent an issue the FACTS or context don't support.\n"
    "- `lagging`: regions/channels underperforming, each with a concrete cited "
    "reason (stock-outs, distributor coverage, price gap) - never vague.\n"
    "- `whats_working`: efficiency bright spots the planner should double down "
    "on, with their cited numbers.\n"
    "- `scale_recommendation` names the specific scale candidate(s) from FACTS "
    "with their ROAS and says where the freed budget should come from.\n"
    "- `summary` is 2-3 sentences a VP could act on without reading the rest."
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


def run(product: str, objective: str, human_feedback: str = "") -> tuple[ResearchOutput, list]:
    stats = _compute(product)
    query = (f"{product} campaign performance ROAS CPA sales regions channels "
             f"distribution CPL CVR OOS {objective}")
    chunks = store.retrieve_many(
        ["campaign_history", "sales", "distribution", "channel_metrics"], query, k=3)
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
    out = call_validated("researcher", SYSTEM, user, ResearchOutput)
    return out, chunks
