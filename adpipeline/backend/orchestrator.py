"""Orchestrator: run_screening / run_creative / run_placement + brief merge + cost.

Plain async Python, no graph framework. Analysts run, their outputs merge into a
Brief(status=pending); rejection feedback is pulled from the Feedback table and
injected into the next run's analyst prompts, closing the loop.
"""
import asyncio
import json

from sqlalchemy import func

from agents import creative as creative_agent
from agents import monitor, sales_analyst, strategist
from llm import cost, openai_client
from llm.router import pick_model
from models import (
    Asset, Brief, Creative, Feedback, LLMCall, Run, SessionLocal,
)
from schemas import (
    AssetOut, BriefBody, BriefResponse, CreativeResponse, MonitorOutput,
    PlacementResponse, ProductProfile, RunResponse, SalesOutput, StrategistOutput,
)
import url_diagnosis


# ---------------- screening ----------------
def _pending_feedback(db, product: str) -> str:
    rows = (db.query(Feedback)
            .filter(Feedback.product == product, Feedback.consumed == 0)
            .all())
    if not rows:
        return ""
    text = " | ".join(r.text for r in rows)
    for r in rows:
        r.consumed = 1
    db.commit()
    return text


async def run_screening(product: str, objective: str) -> dict:
    db = SessionLocal()
    run = Run(product=product, objective=objective, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)
    token = cost.current_run_id.set(run.id)
    try:
        feedback = _pending_feedback(db, product)

        # analysts run concurrently (each wraps a blocking OpenAI call in a thread)
        strat_t = asyncio.to_thread(strategist.run, product, objective, feedback)
        sales_t = asyncio.to_thread(sales_analyst.run, product, objective, feedback)
        mon_t = asyncio.to_thread(monitor.run, product, objective, feedback)
        (strat, _), (sales, _), (mon, _) = await asyncio.gather(strat_t, sales_t, mon_t)

        run.strategist_json = strat.model_dump_json()
        run.sales_json = sales.model_dump_json()
        run.monitor_json = mon.model_dump_json()

        summary = _executive_summary(product, objective, strat, sales, mon)
        body = BriefBody(strategist=strat, sales=sales, monitor=mon)
        brief = Brief(run_id=run.id, status="pending",
                      executive_summary=summary, body_json=body.model_dump_json())
        db.add(brief)
        run.status = "complete"
        db.commit()
        db.refresh(brief)

        brief_resp = BriefResponse(
            id=brief.id, run_id=run.id, status="pending",
            executive_summary=summary, body=body)
        return RunResponse(
            run_id=run.id, product=product, objective=objective,
            strategist=strat, sales=sales, monitor=mon, brief=brief_resp,
            used_feedback=feedback or None,
            cost_usd=_run_cost(db, run.id),
        ).model_dump()
    except Exception:
        run.status = "error"
        db.commit()
        raise
    finally:
        cost.current_run_id.reset(token)
        db.close()


def _executive_summary(product, objective, strat: StrategistOutput,
                       sales: SalesOutput, mon: MonitorOutput) -> str:
    system = ("You are a marketing chief of staff. Merge the three analyst outputs into "
              "a crisp 4-sentence executive summary for a human approver. No fluff. "
              "Return JSON {\"summary\": str}.")
    user = (
        f"PRODUCT: {product}\nOBJECTIVE: {objective}\n"
        f"STRATEGIST: {strat.model_dump_json()}\n"
        f"SALES: {sales.model_dump_json()}\n"
        f"MONITOR: {mon.model_dump_json()}\n"
        "Write exactly 4 sentences covering: top angle, where to sell/scale, biggest "
        "risk, and the recommended next action."
    )
    data = openai_client.chat_json(pick_model("brief"), system, user, "brief_summary", 0.4)
    return data.get("summary", "")


# ---------------- creative ----------------
async def run_creative(brief_id: int, url: str, skill: str) -> dict:
    db = SessionLocal()
    try:
        brief = db.get(Brief, brief_id)
        if not brief:
            raise ValueError("brief not found")
        if brief.status != "approved":
            raise ValueError("brief must be approved before creative")
        run = brief.run
        token = cost.current_run_id.set(run.id)
        try:
            skill_def = _get_skill(skill)
            profile = await asyncio.to_thread(url_diagnosis.diagnose, url)

            body = json.loads(brief.body_json)
            approved_angle = (body.get("strategist", {})
                              .get("strategies", [{}])[0].get("angle", ""))

            copy_blocks = await asyncio.to_thread(
                creative_agent.generate_copy, profile, skill_def,
                brief.executive_summary, approved_angle)

            creative = Creative(brief_id=brief_id, url=url, skill=skill,
                                profile_json=profile.model_dump_json(),
                                copy_json=json.dumps(copy_blocks))
            db.add(creative)
            db.commit()
            db.refresh(creative)

            brand = _brand_key(profile)
            asset_rows = await asyncio.to_thread(
                creative_agent.generate_assets, profile, skill_def, creative.id,
                _cache_lookup)

            assets_out = []
            for a in asset_rows:
                rec = Asset(
                    creative_id=creative.id, run_id=run.id, brand=brand, skill=skill,
                    kind=a["kind"], prompt=a["prompt"], prompt_hash=a["prompt_hash"],
                    aspect=a["aspect"], quality=a["quality"], path=a["path"],
                    from_cache=1 if a["from_cache"] else 0,
                    cache_hit=1 if a["cache_hit"] else 0,
                    origin=a["origin"], cost_usd=a["cost_usd"])
                db.add(rec)
                db.commit()
                db.refresh(rec)
                assets_out.append(AssetOut(
                    id=rec.id, kind=rec.kind, prompt=rec.prompt, aspect=rec.aspect,
                    url=f"/assets/{rec.id}", from_cache=bool(rec.from_cache)))

            return CreativeResponse(
                creative_id=creative.id, profile=profile, assets=assets_out,
                copy_blocks=copy_blocks, cost_usd=_run_cost(db, run.id)).model_dump()
        finally:
            cost.current_run_id.reset(token)
    finally:
        db.close()


# ---------------- placement ----------------
async def run_placement(creative_id: int) -> dict:
    db = SessionLocal()
    try:
        creative = db.get(Creative, creative_id)
        if not creative:
            raise ValueError("creative not found")
        profile = ProductProfile.model_validate_json(creative.profile_json)
        kinds = [a.kind for a in creative.assets]
        token = cost.current_run_id.set(creative.brief.run_id)
        try:
            plan = await asyncio.to_thread(creative_agent.placement, kinds, profile)
        finally:
            cost.current_run_id.reset(token)
        plan.creative_id = creative_id
        creative.placement_json = plan.model_dump_json()
        db.commit()
        return plan.model_dump()
    finally:
        db.close()


# ---------------- library ----------------
def _brand_key(profile: ProductProfile) -> str:
    t = (profile.name + profile.category).lower()
    return "palmolive" if any(k in t for k in ("palmolive", "skin", "soap", "shower")) else "hills"


def _cache_lookup(prompt_hash: str):
    """Return the on-disk path of a prior asset with this exact prompt hash, or None."""
    db = SessionLocal()
    try:
        row = (db.query(Asset)
               .filter(Asset.prompt_hash == prompt_hash, Asset.cache_hit == 0,
                       Asset.from_cache == 0)
               .order_by(Asset.id.asc()).first())
        return row.path if row and Path(row.path).exists() else None
    finally:
        db.close()


def _asset_dto(a: Asset) -> dict:
    return {
        "id": a.id, "url": f"/assets/{a.id}", "kind": a.kind, "brand": a.brand,
        "skill": a.skill, "quality": a.quality, "aspect": a.aspect,
        "run_id": a.run_id, "creative_id": a.creative_id, "prompt": a.prompt,
        "from_cache": bool(a.from_cache), "cache_hit": bool(a.cache_hit),
        "origin": a.origin, "cost_usd": round(a.cost_usd or 0.0, 3),
    }


def library_list(brand=None, skill=None, cache_only=False) -> dict:
    db = SessionLocal()
    try:
        q = db.query(Asset)
        if brand:
            q = q.filter(Asset.brand == brand)
        if skill:
            q = q.filter(Asset.skill == skill)
        if cache_only:
            q = q.filter(Asset.cache_hit == 1)
        rows = q.order_by(Asset.id.desc()).all()
        return {"assets": [_asset_dto(a) for a in rows]}
    finally:
        db.close()


def library_stats() -> dict:
    db = SessionLocal()
    try:
        rows = db.query(Asset).all()
        spend = round(sum(a.cost_usd or 0.0 for a in rows), 3)
        hits = sum(1 for a in rows if a.cache_hit)
        # dollars saved = tier cost that a cache hit would otherwise have paid
        from config import tier_cost
        saved = round(sum(tier_cost(a.quality) for a in rows if a.cache_hit), 3)
        return {
            "assets_stored": len(rows),
            "image_spend_usd": spend,
            "cache_hits": hits,
            "dollars_saved_usd": saved,
        }
    finally:
        db.close()


def reuse_asset(asset_id: int) -> dict:
    """Pull an existing asset into a fresh library row (same file, $0, origin=reuse)."""
    db = SessionLocal()
    try:
        src = db.get(Asset, asset_id)
        if not src:
            raise ValueError("asset not found")
        dup = Asset(
            creative_id=None, run_id=src.run_id, brand=src.brand, skill=src.skill,
            kind=src.kind, prompt=src.prompt, prompt_hash=src.prompt_hash,
            aspect=src.aspect, quality=src.quality, path=src.path,
            from_cache=0, cache_hit=1, origin="reuse", cost_usd=0.0)
        db.add(dup)
        db.commit()
        db.refresh(dup)
        return _asset_dto(dup)
    finally:
        db.close()


async def variant_asset(asset_id: int) -> dict:
    """Re-render an asset's prompt against the current brief context.

    Goes through the prompt-hash cache: an identical prompt/quality is a $0 hit;
    a genuine re-render pays the tier cost and is logged.
    """
    db = SessionLocal()
    try:
        src = db.get(Asset, asset_id)
        if not src:
            raise ValueError("asset not found")
        token = cost.current_run_id.set(src.run_id)
        try:
            rec = await asyncio.to_thread(
                creative_agent.render_one, src.prompt, src.aspect, src.kind, 0,
                _cache_lookup)
        finally:
            cost.current_run_id.reset(token)
        dup = Asset(
            creative_id=None, run_id=src.run_id, brand=src.brand, skill=src.skill,
            kind=rec["kind"], prompt=rec["prompt"], prompt_hash=rec["prompt_hash"],
            aspect=rec["aspect"], quality=rec["quality"], path=rec["path"],
            from_cache=1 if rec["from_cache"] else 0,
            cache_hit=1 if rec["cache_hit"] else 0,
            origin="variant", cost_usd=rec["cost_usd"])
        db.add(dup)
        db.commit()
        db.refresh(dup)
        return _asset_dto(dup)
    finally:
        db.close()


# ---------------- helpers ----------------
def _get_skill(skill: str):
    from skills.registry import get_skill
    return get_skill(skill)


def serialize_brief(b: Brief) -> dict:
    body = BriefBody.model_validate_json(b.body_json)
    return BriefResponse(id=b.id, run_id=b.run_id, status=b.status,
                         executive_summary=b.executive_summary, body=body).model_dump()


def _run_cost(db, run_id: int) -> float:
    total = (db.query(func.coalesce(func.sum(LLMCall.cost_usd), 0.0))
             .filter(LLMCall.run_id == run_id).scalar())
    return round(float(total or 0.0), 4)


def cost_summary() -> dict:
    db = SessionLocal()
    try:
        rows = db.query(
            LLMCall.model,
            func.count(LLMCall.id),
            func.sum(LLMCall.tokens_in),
            func.sum(LLMCall.tokens_out),
            func.sum(LLMCall.cost_usd),
        ).group_by(LLMCall.model).all()
        by_model = [{
            "model": m, "calls": c, "tokens_in": int(ti or 0),
            "tokens_out": int(to or 0), "cost_usd": round(float(cu or 0), 4),
        } for m, c, ti, to, cu in rows]
        total = round(sum(x["cost_usd"] for x in by_model), 4)
        return {"total_usd": total, "by_model": by_model}
    finally:
        db.close()
