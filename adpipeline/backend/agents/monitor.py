"""Agent 3 — Performance Monitor (gpt-4o-mini).

Retrieves campaign_history for citations, but all math is precomputed HERE in code
(never by the LLM) and handed to the model to summarize + prioritize.
In production these numerics would come from live metrics.
"""
from agents.common import (
    GROUNDING_RULE, call_validated, feedback_block, format_context,
)
from llm.router import pick_model
from rag import store
from schemas import MonitorOutput

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
]

BREAKEVEN_ROAS = 1.5
SCALE_ROAS = 3.5


def _which(product: str) -> str:
    p = product.lower()
    if "palmolive" in p or "luminous" in p or "skin" in p:
        return "palmolive"
    return "hills"


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


def run(product: str, objective: str, human_feedback: str = "") -> tuple[MonitorOutput, list]:
    stats = _compute(product)
    chunks = store.retrieve(
        "campaign_history",
        f"{product} campaign performance ROAS CPA learnings scale pause {objective}", k=4)
    ctx = format_context(chunks)

    facts = (
        f"PRECOMPUTED METRICS (authoritative — do not recompute):\n"
        f"- portfolio: {stats['family']}\n"
        f"- total spend: ${stats['total_spend']:,}\n"
        f"- spend-weighted ROAS: {stats['weighted_roas']}x\n"
        f"- below-breakeven (<{BREAKEVEN_ROAS}x ROAS): {stats['underperformers'] or 'none'}\n"
        f"- scale candidates (>= {SCALE_ROAS}x ROAS): "
        f"{[c['name'] for c in stats['scale_candidates']] or 'none'}\n"
        f"- per-campaign: {[{k: c[k] for k in ('name','roas','cpa','ctr','spend')} for c in stats['rows']]}\n"
    )

    system = (
        GROUNDING_RULE +
        " The numeric facts are precomputed and authoritative; base alerts on them. "
        "Use the retrieved context for the qualitative 'learnings' and to cite sources."
    )
    user = (
        f"PRODUCT: {product}\nOBJECTIVE: {objective}\n"
        f"{feedback_block(human_feedback)}\n"
        f"## FACTS\n{facts}\n## CONTEXT\n{ctx}\n\n"
        "JSON schema:\n"
        '{"summary": str, "alerts": [{"campaign": str, "severity": "low|medium|high", '
        '"reason": str, "action": str}], "scale_recommendation": str}\n'
        "Flag below-breakeven campaigns as high severity; name the specific scale "
        "candidate(s) in scale_recommendation."
    )
    out = call_validated(pick_model("monitor"), system, user, "monitor",
                         MonitorOutput, temperature=0.3)
    return out, chunks
