"""Log every LLM/image call to SQLite for the cost readout."""
import contextvars

from config import COST_TABLE, IMAGE_COST
from models import LLMCall, SessionLocal

# current run id, set by orchestrator so calls attribute correctly
current_run_id = contextvars.ContextVar("current_run_id", default=None)


def estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    t = COST_TABLE.get(model, {"in": 0.0, "out": 0.0})
    return (tokens_in / 1_000_000) * t["in"] + (tokens_out / 1_000_000) * t["out"]


def log_call(model, task, tokens_in=0, tokens_out=0, latency_ms=0, cost_usd=None):
    if cost_usd is None:
        cost_usd = estimate_cost(model, tokens_in, tokens_out)
    db = SessionLocal()
    try:
        db.add(LLMCall(
            run_id=current_run_id.get(),
            model=model, task=task,
            tokens_in=tokens_in, tokens_out=tokens_out,
            latency_ms=latency_ms, cost_usd=cost_usd,
        ))
        db.commit()
    finally:
        db.close()
    return cost_usd


def log_image(model, task, n=1, cost_usd=None):
    if cost_usd is None:
        cost_usd = IMAGE_COST * n
    return log_call(model, task, cost_usd=cost_usd)
