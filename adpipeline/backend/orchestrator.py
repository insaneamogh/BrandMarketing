"""Orchestrator for the staged handoff pipeline. Plain async Python, no graph
framework - the state machine is the Campaign.status column:

  POST /campaigns          -> Agent 1 (research)      -> research_pending
  decision approve         -> hand research to Agent 2 -> research_approved
  POST .../plan            -> Agent 2 (plan)          -> plan_pending
  decision approve         -> hand plan to Agent 3    -> plan_approved
  POST .../creative        -> Agent 3 (copy+images)   -> (creative rows)
  POST /placement          -> placements + expected metrics w/ probability
  POST .../publish         -> published

A rejected stage stores feedback (per campaign+stage) that is injected into
that stage's re-run prompt and only marked consumed after a SUCCESSFUL re-run.
"""
import asyncio
import hashlib
import json
from pathlib import Path

from sqlalchemy import func

from agents import creative as creative_agent
from agents import planner, researcher
from config import ASSETS_DIR, SEEDANCE_COST_PER_VIDEO
from llm import cost, video_client
from models import (
    Asset, Campaign, Creative, Feedback, LLMCall, SessionLocal, StageDecision,
)
from schemas import (
    AssetOut, CampaignResponse, CreativeResponse, PlanOutput, ProductProfile,
    ResearchOutput,
)
import url_diagnosis

REF_DIR = ASSETS_DIR / "references"          # uploaded reference images
REF_DIR.mkdir(parents=True, exist_ok=True)

_STAGES = ("research", "plan")


# ---------------- feedback (per campaign + stage) ----------------
def _pending_feedback(db, campaign_id: int, stage: str):
    """Unconsumed rejection feedback rows for this stage. Marked consumed only
    AFTER a successful re-run, so a failed run never eats the human's feedback."""
    rows = (db.query(Feedback)
            .filter(Feedback.campaign_id == campaign_id,
                    Feedback.stage == stage, Feedback.consumed == 0)
            .all())
    return rows, " | ".join(r.text for r in rows)


# ---------------- campaign envelope ----------------
def _campaign_response(db, c: Campaign, used_feedback: str = None) -> dict:
    return CampaignResponse(
        id=c.id, product=c.product, objective=c.objective, status=c.status,
        mode=c.mode or "chain",
        research=(ResearchOutput.model_validate_json(c.research_json)
                  if c.research_json else None),
        plan=(PlanOutput.model_validate_json(c.plan_json)
              if c.plan_json else None),
        used_feedback=used_feedback or None,
        cost_usd=_campaign_cost(db, c.id),
    ).model_dump()


# ---------------- stage 1: research (Agent 1) ----------------
async def start_campaign(product: str, objective: str) -> dict:
    db = SessionLocal()
    try:
        c = Campaign(product=product, objective=objective, status="research_pending")
        db.add(c)
        db.commit()
        db.refresh(c)
        return await _run_research(db, c)
    finally:
        db.close()


async def rerun_research(campaign_id: int) -> dict:
    db = SessionLocal()
    try:
        c = db.get(Campaign, campaign_id)
        if not c:
            raise ValueError("campaign not found")
        if c.status == "published":
            raise ValueError("campaign already published")
        return await _run_research(db, c)
    finally:
        db.close()


async def _run_research(db, c: Campaign) -> dict:
    token = cost.current_campaign_id.set(c.id)
    try:
        fb_rows, feedback = _pending_feedback(db, c.id, "research")
        research, _ = await asyncio.to_thread(
            researcher.run, c.product, c.objective, feedback)
        c.research_json = research.model_dump_json()
        c.plan_json = None                       # stale plan dies with new research
        # solo campaigns have no gates, so there is nothing "pending"
        c.status = "solo_research" if (c.mode or "chain") == "solo" else "research_pending"
        for r in fb_rows:
            r.consumed = 1
        db.commit()
        return _campaign_response(db, c, feedback)
    finally:
        cost.current_campaign_id.reset(token)


# ---------------- stage 2: plan (Agent 2) ----------------
async def run_plan(campaign_id: int) -> dict:
    db = SessionLocal()
    try:
        c = db.get(Campaign, campaign_id)
        if not c:
            raise ValueError("campaign not found")
        if not c.research_json:
            raise ValueError("no research to plan from")
        if c.status not in ("research_approved", "plan_pending", "plan_rejected"):
            raise ValueError(
                f"plan requires approved research (campaign is {c.status})")
        token = cost.current_campaign_id.set(c.id)
        try:
            fb_rows, feedback = _pending_feedback(db, c.id, "plan")
            plan, _ = await asyncio.to_thread(
                planner.run, c.product, c.objective, c.research_json, feedback)
            c.plan_json = plan.model_dump_json()
            c.status = "plan_pending"
            for r in fb_rows:
                r.consumed = 1
            db.commit()
            return _campaign_response(db, c, feedback)
        finally:
            cost.current_campaign_id.reset(token)
    finally:
        db.close()


# ---------------- solo mode (standalone agents, no gates) ----------------
async def solo_research(product: str, objective: str) -> dict:
    """Agent 1 standalone - same researcher, no downstream handoff required."""
    db = SessionLocal()
    try:
        c = Campaign(product=product, objective=objective,
                     status="solo_research", mode="solo")
        db.add(c)
        db.commit()
        db.refresh(c)
        return await _run_research(db, c)
    finally:
        db.close()


async def solo_plan(product: str = None, objective: str = None,
                    campaign_id: int = None) -> dict:
    """Agent 2 standalone. Without a campaign_id it plans from scratch (grounded
    directly in the corpus). With one, any research already on that solo campaign
    becomes optional context - but it is never required."""
    db = SessionLocal()
    try:
        if campaign_id:
            c = db.get(Campaign, campaign_id)
            if not c:
                raise ValueError("campaign not found")
            if (c.mode or "chain") != "solo":
                raise ValueError("solo plan requires a solo campaign - use the chained flow instead")
        else:
            if not product or not objective:
                raise ValueError("product and objective are required to start a solo plan")
            c = Campaign(product=product, objective=objective,
                         status="solo_plan", mode="solo")
            db.add(c)
            db.commit()
            db.refresh(c)
        token = cost.current_campaign_id.set(c.id)
        try:
            plan, _ = await asyncio.to_thread(
                planner.run, c.product, c.objective, c.research_json, "")
            c.plan_json = plan.model_dump_json()
            c.status = "solo_plan"
            db.commit()
            return _campaign_response(db, c)
        finally:
            cost.current_campaign_id.reset(token)
    finally:
        db.close()


async def solo_creative(url: str, skill: str, product: str = None,
                        objective: str = None, campaign_id: int = None,
                        reference_id: str = None, prompt_tweak: str = None) -> dict:
    """Agent 3 standalone - 'just generate an ad'. No plan required: the objective
    (or the product profile alone) is the brief."""
    return await _drain(solo_creative_stream(
        url, skill, product, objective, campaign_id, reference_id, prompt_tweak))


async def solo_creative_stream(url: str, skill: str, product: str = None,
                               objective: str = None, campaign_id: int = None,
                               reference_id: str = None, prompt_tweak: str = None):
    """Solo-mode draft stage as an event stream (no gates)."""
    db = SessionLocal()
    try:
        if campaign_id:
            c = db.get(Campaign, campaign_id)
            if not c:
                raise ValueError("campaign not found")
            if (c.mode or "chain") != "solo":
                raise ValueError("solo creative requires a solo campaign - use the chained flow instead")
        else:
            c = Campaign(product=product or "Standalone creative",
                         objective=objective or "Standalone ad generation",
                         status="solo_creative", mode="solo")
            db.add(c)
            db.commit()
            db.refresh(c)
        async for ev in _generate_creative_events(db, c, url, skill,
                                                  reference_id, prompt_tweak):
            yield ev
    finally:
        db.close()


# ---------------- human gates ----------------
def decide(campaign_id: int, stage: str, action: str, feedback: str = None) -> dict:
    if stage not in _STAGES:
        raise ValueError(f"stage must be one of {_STAGES}")
    if action not in ("approve", "reject"):
        raise ValueError("action must be approve|reject")
    db = SessionLocal()
    try:
        c = db.get(Campaign, campaign_id)
        if not c:
            raise ValueError("campaign not found")
        if (c.mode or "chain") == "solo":
            raise ValueError("solo campaigns have no approval gates")
        if stage == "research" and not c.research_json:
            raise ValueError("nothing to decide: research has not run")
        if stage == "plan" and not c.plan_json:
            raise ValueError("nothing to decide: plan has not run")
        if action == "reject" and not (feedback or "").strip():
            raise ValueError("reject requires feedback")

        db.add(StageDecision(campaign_id=campaign_id, stage=stage,
                             action=action, feedback=feedback))
        if action == "approve":
            c.status = f"{stage}_approved"
        else:
            c.status = f"{stage}_rejected"
            db.add(Feedback(campaign_id=campaign_id, stage=stage, text=feedback))
        db.commit()
        return {"campaign_id": campaign_id, "stage": stage, "status": c.status}
    finally:
        db.close()


# ---------------- stage 3: creative (Agent 3) ----------------
# The draft and render stages are async EVENT GENERATORS so the API can stream
# progress over SSE (the user watches prompts and images land one by one).
# The plain JSON endpoints drain the same generators - one code path.

async def _drain(gen) -> dict:
    """Consume an event generator to completion; return the done payload."""
    final = None
    async for ev in gen:
        if ev.get("type") == "done":
            final = ev.get("data")
    if final is None:
        raise ValueError("stream ended without a result")
    return final


async def run_creative(campaign_id: int, url: str, skill: str,
                       reference_id: str = None, prompt_tweak: str = None) -> dict:
    return await _drain(run_creative_stream(
        campaign_id, url, skill, reference_id, prompt_tweak))


async def run_creative_stream(campaign_id: int, url: str, skill: str,
                              reference_id: str = None, prompt_tweak: str = None):
    """Chain-mode draft stage as an event stream (gated on an approved plan)."""
    db = SessionLocal()
    try:
        c = db.get(Campaign, campaign_id)
        if not c:
            raise ValueError("campaign not found")
        # chain mode is gated on an approved plan; solo campaigns run any time
        if (c.mode or "chain") != "solo" and c.status not in ("plan_approved", "published"):
            raise ValueError(
                f"creative requires an approved plan (campaign is {c.status})")
        async for ev in _generate_creative_events(db, c, url, skill,
                                                  reference_id, prompt_tweak):
            yield ev
    finally:
        db.close()


async def _generate_creative_events(db, c: Campaign, url: str, skill: str,
                                    reference_id: str = None,
                                    prompt_tweak: str = None):
    """Shared Agent 3 DRAFT stage: deterministic URL scrape -> profile, copy
    blocks, and per-asset image prompts compiled through the asset-specific
    builders (all on the free tier). NO image model is called here - the human
    approves the drafted prompts (and picks n per prompt) first, then the
    render stage spends the image budget.

    Yields: status / profile / copy / prompt events, then done with the full
    CreativeResponse."""
    plan = PlanOutput.model_validate_json(c.plan_json) if c.plan_json else None
    plan_summary = plan.plan_summary if plan else (c.objective or "Standalone ad generation")
    campaign_angle = plan.campaign_angle if plan else ""
    target_segment = plan.target_segment if plan else ""
    channels = plan.recommended_channels if plan else None

    reference_path = None
    if reference_id:
        reference_path = str(REF_DIR / reference_id)
        if not Path(reference_path).exists():
            raise ValueError("reference image not found - upload it first")

    token = cost.current_campaign_id.set(c.id)
    try:
        skill_def = _get_skill(skill)

        yield {"type": "status", "step": "profile",
               "message": "Diagnosing the product URL"}
        profile = await asyncio.to_thread(url_diagnosis.diagnose, url)
        # "Other" / placeholder campaigns take the scraped product's real name
        if c.product in ("Other (paste any product URL)", "Standalone creative",
                         "Other") and profile.name:
            c.product = profile.name
            db.commit()
        yield {"type": "profile", "data": profile.model_dump()}

        yield {"type": "status", "step": "copy",
               "message": "Writing platform copy blocks"}
        copy_blocks = await asyncio.to_thread(
            creative_agent.generate_copy, profile, skill_def,
            plan_summary, campaign_angle)
        yield {"type": "copy", "data": copy_blocks}

        yield {"type": "status", "step": "context",
               "message": "Building the product creative context"}
        context = await asyncio.to_thread(
            creative_agent.build_context, profile, plan_summary,
            campaign_angle, target_segment, channels, c.objective or "")

        specs = skill_def["image_specs"]
        prompts, scenes = [], []
        for i, spec in enumerate(specs):
            label = ("compliance-locked template" if spec.get("locked")
                     else f"{spec.get('builder', 'product_shoot')} builder")
            yield {"type": "status", "step": "prompt",
                   "message": f"Compiling {spec['kind']} prompt ({i + 1}/{len(specs)}, {label})"}
            d = await asyncio.to_thread(
                creative_agent.draft_one, spec, profile, context,
                prompt_tweak or "", scenes)
            if d.get("scene"):
                scenes.append(d["scene"])
            prompts.append(d)
            yield {"type": "prompt", "index": i, "total": len(specs), "data": d}

        creative = Creative(
            campaign_id=c.id, url=url, skill=skill,
            reference_path=reference_path, prompt_tweak=prompt_tweak,
            profile_json=profile.model_dump_json(),
            copy_json=json.dumps(copy_blocks),
            prompts_json=json.dumps(prompts))
        db.add(creative)
        db.commit()
        db.refresh(creative)

        yield {"type": "done", "data": CreativeResponse(
            creative_id=creative.id, campaign_id=c.id, profile=profile,
            assets=[], copy_blocks=copy_blocks, prompts=prompts, rendered=False,
            reference_used=bool(reference_path), prompt_tweak=prompt_tweak,
            cost_usd=_campaign_cost(db, c.id)).model_dump()}
    finally:
        cost.current_campaign_id.reset(token)


async def render_creative(creative_id: int, prompt_edits: list = None) -> dict:
    return await _drain(render_creative_stream(creative_id, prompt_edits))


async def render_creative_stream(creative_id: int, prompt_edits: list = None):
    """Stage 2: the human approved (and possibly edited) the drafted prompts,
    each carrying n=1-4 requested variations. This is the ONLY entry point
    that calls the paid image model. Streams each asset as it lands."""
    db = SessionLocal()
    try:
        creative = db.get(Creative, creative_id)
        if not creative:
            raise ValueError("creative not found")
        c = creative.campaign
        if (c.mode or "chain") != "solo" and c.status not in ("plan_approved", "published"):
            raise ValueError(f"render requires an approved plan (campaign is {c.status})")
        prompts = json.loads(creative.prompts_json or "[]")
        if not prompts:
            raise ValueError("no drafted prompts on this creative - run the draft step first")

        # apply human edits positionally (kinds can repeat, e.g. two lifestyles)
        if prompt_edits:
            if len(prompt_edits) != len(prompts):
                raise ValueError(
                    f"expected {len(prompts)} prompts, got {len(prompt_edits)}")
            for spec, edit in zip(prompts, prompt_edits):
                text = (edit.get("prompt") or "").strip()
                if text:
                    spec["prompt"] = text
                spec["n"] = max(1, min(4, int(edit.get("n") or 1)))
        creative.prompts_json = json.dumps(prompts)
        db.commit()

        profile = ProductProfile.model_validate_json(creative.profile_json)
        reference_png = None
        if creative.reference_path and Path(creative.reference_path).exists():
            reference_png = Path(creative.reference_path).read_bytes()
        ref_hash = (hashlib.sha256(reference_png).hexdigest()[:16]
                    if reference_png else "")

        brand = _brand_key(profile)
        assets_out, calls = [], 0
        token = cost.current_campaign_id.set(creative.campaign_id)
        try:
            for i, spec in enumerate(prompts):
                n = max(1, min(4, int(spec.get("n") or 1)))
                yield {"type": "status", "step": "render",
                       "message": (f"Rendering {spec['kind']} "
                                   f"({i + 1}/{len(prompts)}"
                                   + (f", {n} variations" if n > 1 else "") + ")")}
                recs = await asyncio.to_thread(
                    creative_agent.render_spec, spec, calls,
                    _cache_lookup, reference_png, ref_hash)
                calls += sum(1 for r in recs if r["origin"] == "generated")
                for a in recs:
                    rec = Asset(
                        creative_id=creative.id, campaign_id=creative.campaign_id,
                        brand=brand, skill=creative.skill, kind=a["kind"],
                        prompt=a["prompt"], prompt_hash=a["prompt_hash"],
                        aspect=a["aspect"], quality=a["quality"], path=a["path"],
                        from_cache=1 if a["from_cache"] else 0,
                        cache_hit=1 if a["cache_hit"] else 0,
                        origin=a["origin"], cost_usd=a["cost_usd"])
                    db.add(rec)
                    db.commit()
                    db.refresh(rec)
                    out = _asset_out(rec)
                    assets_out.append(out)
                    yield {"type": "asset", "index": i, "total": len(prompts),
                           "data": out.model_dump()}
        finally:
            cost.current_campaign_id.reset(token)

        yield {"type": "done", "data": CreativeResponse(
            creative_id=creative.id, campaign_id=creative.campaign_id,
            profile=profile, assets=assets_out,
            copy_blocks=json.loads(creative.copy_json or "{}"),
            prompts=prompts, rendered=True,
            reference_used=bool(reference_png),
            prompt_tweak=creative.prompt_tweak,
            cost_usd=_campaign_cost(db, creative.campaign_id)).model_dump()}
    finally:
        db.close()


def _asset_out(rec: Asset) -> AssetOut:
    return AssetOut(
        id=rec.id, kind=rec.kind, prompt=rec.prompt, aspect=rec.aspect,
        url=f"/assets/{rec.id}", from_cache=bool(rec.from_cache),
        cache_hit=bool(rec.cache_hit), cost_usd=round(rec.cost_usd or 0.0, 3))


# ---------------- placement + expected metrics ----------------
async def run_placement(creative_id: int) -> dict:
    db = SessionLocal()
    try:
        creative = db.get(Creative, creative_id)
        if not creative:
            raise ValueError("creative not found")
        profile = ProductProfile.model_validate_json(creative.profile_json)
        plan_json = creative.campaign.plan_json  # None on solo runs without a plan
        angle = PlanOutput.model_validate_json(plan_json).campaign_angle if plan_json else ""
        kinds = [a.kind for a in creative.assets]
        token = cost.current_campaign_id.set(creative.campaign_id)
        try:
            resp = await asyncio.to_thread(
                creative_agent.placement, kinds, profile, angle)
        finally:
            cost.current_campaign_id.reset(token)
        resp.creative_id = creative_id
        creative.placement_json = resp.model_dump_json()
        db.commit()
        return resp.model_dump()
    finally:
        db.close()


# ---------------- publish ----------------
def publish(creative_id: int) -> dict:
    """Approve & Publish. POC: records the publish decision + payload (in
    production this is where the Meta/Amazon Ads API call goes)."""
    import datetime as dt
    db = SessionLocal()
    try:
        creative = db.get(Creative, creative_id)
        if not creative:
            raise ValueError("creative not found")
        if not creative.assets:
            raise ValueError("nothing to publish: generate assets first")
        creative.published = 1
        creative.published_at = dt.datetime.utcnow()
        creative.campaign.status = "published"
        db.add(StageDecision(campaign_id=creative.campaign_id, stage="publish",
                             action="publish", feedback=None))
        placement = json.loads(creative.placement_json or "{}")
        db.commit()
        return {
            "creative_id": creative_id,
            "campaign_id": creative.campaign_id,
            "status": "published",
            "published_at": creative.published_at.isoformat() + "Z",
            "assets": len(creative.assets),
            "channels": sorted({p["platform"] for p in placement.get("placements", [])}),
            "note": "POC publish - recorded in DB; wire the ad-platform API here in production.",
        }
    finally:
        db.close()


# ---------------- video (Seedance, optional + explicit) ----------------
async def run_video(creative_id: int) -> dict:
    """Generate ONE short ad video for a creative from its veo/storyboard prompt.

    Never called automatically by a skill run. If SEEDANCE_API_KEY is missing,
    returns status=disabled with the ready-to-run prompt so the demo still has
    a video story. A finished video is cached on the Creative row - repeat
    clicks cost $0.
    """
    db = SessionLocal()
    try:
        creative = db.get(Creative, creative_id)
        if not creative:
            raise ValueError("creative not found")
        if creative.video_json:                      # already generated - cached
            prior = json.loads(creative.video_json)
            if prior.get("status") == "done":
                return {**prior, "cached": True}

        copy = json.loads(creative.copy_json or "{}")
        prompt = copy.get("veo_prompt") or copy.get("video_prompt")
        if isinstance(prompt, list):
            prompt = " ".join(str(p) for p in prompt)
        if not prompt:
            profile = ProductProfile.model_validate_json(creative.profile_json)
            frames = copy.get("storyboard_6_frames", [])
            frames = " ".join(str(f) for f in frames) if isinstance(frames, list) else str(frames)
            prompt = (f"Cinematic 5-second product commercial for {profile.name} "
                      f"({profile.category}): one continuous slow push-in on the "
                      f"product in a premium real-world setting, warm directional "
                      f"lighting, rich color grade, no on-screen text or logos "
                      f"beyond the pack label. {frames}".strip())

        if not video_client.enabled():
            result = {"status": "disabled", "prompt": prompt,
                      "note": "Set SEEDANCE_API_KEY to render this prompt as video."}
            creative.video_json = json.dumps(result)
            db.commit()
            return result

        token = cost.current_campaign_id.set(creative.campaign_id)
        try:
            mp4 = await asyncio.to_thread(
                video_client.generate_video, prompt, "16:9", "video:bundle")
        except Exception as e:
            result = {"status": "error", "prompt": prompt, "error": str(e)}
            creative.video_json = json.dumps(result)
            db.commit()
            return result
        finally:
            cost.current_campaign_id.reset(token)

        path = ASSETS_DIR / f"video_{creative_id}.mp4"
        path.write_bytes(mp4)
        result = {"status": "done", "url": f"/videos/{creative_id}",
                  "prompt": prompt, "cost_usd": SEEDANCE_COST_PER_VIDEO}
        creative.video_json = json.dumps(result)
        db.commit()
        return result
    finally:
        db.close()


def video_path(creative_id: int) -> str:
    db = SessionLocal()
    try:
        creative = db.get(Creative, creative_id)
        if not creative or not creative.video_json:
            raise ValueError("video not found")
        if json.loads(creative.video_json).get("status") != "done":
            raise ValueError("video not generated")
        return str(ASSETS_DIR / f"video_{creative_id}.mp4")
    finally:
        db.close()


# ---------------- reference images ----------------
def save_reference(data: bytes, filename: str = "") -> dict:
    """Persist an uploaded reference image; returns the token used by /creative."""
    if not data:
        raise ValueError("empty upload")
    if len(data) > 8 * 1024 * 1024:
        raise ValueError("reference image too large (max 8MB)")
    ext = ".png" if not filename.lower().endswith((".jpg", ".jpeg")) else ".jpg"
    name = f"ref_{hashlib.sha256(data).hexdigest()[:16]}{ext}"
    (REF_DIR / name).write_bytes(data)
    return {"reference_id": name, "url": f"/references/{name}"}


def reference_path(reference_id: str) -> str:
    # token format is ref_<hex16>.<ext> - reject anything path-like
    if "/" in reference_id or "\\" in reference_id or ".." in reference_id:
        raise ValueError("invalid reference id")
    p = REF_DIR / reference_id
    if not p.exists():
        raise ValueError("reference not found")
    return str(p)


# ---------------- history ----------------
def campaign_detail(campaign_id: int) -> dict:
    """Full campaign state - used to resume a past campaign from History."""
    db = SessionLocal()
    try:
        c = db.get(Campaign, campaign_id)
        if not c:
            raise ValueError("campaign not found")
        out = _campaign_response(db, c)
        out["creatives"] = []
        for cr in c.creatives:
            placement = json.loads(cr.placement_json) if cr.placement_json else None
            out["creatives"].append({
                "creative_id": cr.id,
                "campaign_id": c.id,
                "url": cr.url,
                "skill": cr.skill,
                "prompt_tweak": cr.prompt_tweak,
                "reference_used": bool(cr.reference_path),
                "published": bool(cr.published),
                "published_at": cr.published_at.isoformat() + "Z" if cr.published_at else None,
                "profile": json.loads(cr.profile_json) if cr.profile_json else None,
                "copy_blocks": json.loads(cr.copy_json) if cr.copy_json else {},
                "prompts": json.loads(cr.prompts_json) if cr.prompts_json else [],
                "rendered": bool(cr.assets),
                "placement": placement,
                "video": json.loads(cr.video_json) if cr.video_json else None,
                "assets": [_asset_out(a).model_dump() for a in cr.assets],
            })
        out["decisions"] = [{
            "stage": d.stage, "action": d.action, "feedback": d.feedback,
            "at": d.created_at.isoformat() + "Z",
        } for d in c.decisions]
        return out
    finally:
        db.close()


def campaign_history() -> dict:
    """The 'what did I previously generate' shelf - newest first."""
    db = SessionLocal()
    try:
        rows = db.query(Campaign).order_by(Campaign.id.desc()).all()
        items = []
        for c in rows:
            n_assets = sum(len(cr.assets) for cr in c.creatives)
            spend = round(sum(a.cost_usd or 0 for cr in c.creatives for a in cr.assets), 3)
            items.append({
                "id": c.id, "product": c.product, "objective": c.objective,
                "status": c.status, "mode": c.mode or "chain",
                "created_at": c.created_at.isoformat() + "Z",
                "creatives": len(c.creatives),
                "assets": n_assets,
                "image_spend_usd": spend,
                "published": any(cr.published for cr in c.creatives),
                "skills": sorted({cr.skill for cr in c.creatives}),
                "cost_usd": _campaign_cost(db, c.id),
            })
        return {"campaigns": items}
    finally:
        db.close()


# ---------------- library ----------------
def _brand_key(profile: ProductProfile) -> str:
    """Same family mapping as agents.creative - used for the library brand filter."""
    t = (profile.name + " " + profile.category).lower()
    if any(k in t for k in ("eltamd", "filorga", "ncef", "pca skin", "sunscreen", "spf", "serum", "anti-aging", "skincare")):
        return "skin_health"
    if any(k in t for k in ("palmolive", "soap", "shower", "body wash", "hand wash")):
        return "palmolive"
    return "hills"


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
        "campaign_id": a.campaign_id, "creative_id": a.creative_id, "prompt": a.prompt,
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
        saved = round(sum(tier_cost(a.quality, a.aspect or "1:1")
                          for a in rows if a.cache_hit), 3)
        return {
            "assets_stored": len(rows),
            "image_spend_usd": spend,
            "cache_hits": hits,
            "dollars_saved_usd": saved,
        }
    finally:
        db.close()


def delete_asset(asset_id: int) -> dict:
    """Delete an asset row. The image file is unlinked only when no other row
    still references it (reuse rows and cache hits share files) and it lives
    under ASSETS_DIR (never the committed /cache placeholders)."""
    db = SessionLocal()
    try:
        a = db.get(Asset, asset_id)
        if not a:
            raise ValueError("asset not found")
        path = a.path
        db.delete(a)
        db.commit()
        file_deleted = False
        others = db.query(Asset).filter(Asset.path == path).count()
        if others == 0 and path:
            p = Path(path)
            try:
                if p.exists() and ASSETS_DIR in p.resolve().parents:
                    p.unlink()
                    file_deleted = True
            except Exception:
                pass          # DB row is gone either way; file cleanup is best-effort
        return {"deleted": asset_id, "file_deleted": file_deleted}
    finally:
        db.close()


def refine_objective(product: str, objective: str) -> dict:
    """Turn a raw note ('sales are down in APAC') into a crisp, campaign-ready
    objective before the pipeline runs. Gemini flash, free tier."""
    from llm import router
    system = (
        "You are a CPG marketing chief of staff. The user typed a rough note as "
        "their campaign objective. Rewrite it into ONE crisp, actionable "
        "campaign objective of at most 160 characters that keeps their exact "
        "intent and adds the missing specificity a marketing team needs: the "
        "goal verb (grow/recover/defend/launch), the market or region if "
        "implied, the audience if implied, and what success looks like. Never "
        "invent numbers or facts the note does not imply. Plain business "
        'English, no buzzwords. Return JSON only: {"objective": str}.'
    )
    user = f"PRODUCT: {product}\nRAW NOTE: {objective}\nRewrite it now."
    data = router.chat_json("refine", system, user, 0.4)
    refined = str(data.get("objective") or "").strip()
    if not refined or len(refined) > 220:
        raise ValueError("could not refine the objective - keep your original")
    return {"objective": refined, "original": objective}


def reuse_asset(asset_id: int) -> dict:
    """Pull an existing asset into a fresh library row (same file, $0, origin=reuse)."""
    db = SessionLocal()
    try:
        src = db.get(Asset, asset_id)
        if not src:
            raise ValueError("asset not found")
        dup = Asset(
            creative_id=None, campaign_id=src.campaign_id, brand=src.brand,
            skill=src.skill, kind=src.kind, prompt=src.prompt,
            prompt_hash=src.prompt_hash, aspect=src.aspect, quality=src.quality,
            path=src.path, from_cache=0, cache_hit=1, origin="reuse", cost_usd=0.0)
        db.add(dup)
        db.commit()
        db.refresh(dup)
        return _asset_dto(dup)
    finally:
        db.close()


async def variant_asset(asset_id: int, prompt: str = None) -> dict:
    """Re-render an asset - optionally with a USER-EDITED prompt (their
    flexibility knob for tweaking a product image).

    Goes through the prompt-hash cache: an identical prompt/quality is a $0 hit;
    a genuine re-render pays the tier cost and is logged.
    """
    db = SessionLocal()
    try:
        src = db.get(Asset, asset_id)
        if not src:
            raise ValueError("asset not found")
        use_prompt = (prompt or "").strip() or src.prompt
        # keep the original creative's reference image, if it had one
        ref_png, ref_hash = None, ""
        if src.creative_id:
            cr = db.get(Creative, src.creative_id)
            if cr and cr.reference_path and Path(cr.reference_path).exists():
                ref_png = Path(cr.reference_path).read_bytes()
                ref_hash = hashlib.sha256(ref_png).hexdigest()[:16]
        token = cost.current_campaign_id.set(src.campaign_id)
        try:
            rec = await asyncio.to_thread(
                creative_agent.render_one, use_prompt, src.aspect, src.kind, 0,
                _cache_lookup, ref_png, ref_hash)
        finally:
            cost.current_campaign_id.reset(token)
        dup = Asset(
            creative_id=src.creative_id, campaign_id=src.campaign_id,
            brand=src.brand, skill=src.skill,
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


def _campaign_cost(db, campaign_id: int) -> float:
    total = (db.query(func.coalesce(func.sum(LLMCall.cost_usd), 0.0))
             .filter(LLMCall.campaign_id == campaign_id).scalar())
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
