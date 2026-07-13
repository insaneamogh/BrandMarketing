"""FastAPI app: routes for the staged 3-agent handoff pipeline."""
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import orchestrator
from config import (
    DEMO_MODE, FRONTEND_DIST, GOOGLE_API_KEY, IMAGE_PROVIDER, SEEDANCE_API_KEY,
)
from models import Asset, SessionLocal, init_db
from rag import ingest
from schemas import (
    CampaignInput, CreativeInput, PlacementInput, PublishInput,
    SoloCreativeInput, SoloPlanInput, SoloResearchInput,
    StageDecisionInput, VariantInput, VideoInput,
)

app = FastAPI(title="AdPipeline")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()
    ingest.ingest_if_stale()   # re-embeds automatically when corpus files change


@app.get("/health")
def health():
    return {
        "status": "ok",
        "demo_mode": DEMO_MODE,
        "text_provider": "gemini (free tier)" if GOOGLE_API_KEY else "openai fallback only",
        "image_provider": IMAGE_PROVIDER,
        "video_enabled": bool(SEEDANCE_API_KEY),
    }


@app.get("/skills")
def skills():
    from skills.registry import list_skills
    return {"skills": list_skills()}


@app.get("/prompts")
def prompts():
    """Transparency: the exact system prompt each agent runs with."""
    from agents import creative, planner, researcher
    return {
        "agent1_researcher": researcher.SYSTEM,
        "agent2_planner": planner.SYSTEM,
        "agent3_copywriter": creative.COPY_SYSTEM,
        "agent3_media_planner": creative.PLACEMENT_SYSTEM,
    }


# ---------------- campaign lifecycle (the handoff chain) ----------------
@app.post("/campaigns")
async def create_campaign(inp: CampaignInput):
    """Start a campaign: Agent 1 (Research & Monitor) runs immediately."""
    return await orchestrator.start_campaign(inp.product, inp.objective)


@app.get("/campaigns")
def list_campaigns():
    """History - everything previously generated, newest first."""
    return orchestrator.campaign_history()


@app.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: int):
    try:
        return orchestrator.campaign_detail(campaign_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.post("/campaigns/{campaign_id}/research")
async def rerun_research(campaign_id: int):
    """Re-run Agent 1 (consumes any rejection feedback for this stage)."""
    try:
        return await orchestrator.rerun_research(campaign_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/campaigns/{campaign_id}/plan")
async def run_plan(campaign_id: int):
    """Hand the approved research to Agent 2 (Strategy Planner)."""
    try:
        return await orchestrator.run_plan(campaign_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/campaigns/{campaign_id}/decision")
def decide(campaign_id: int, inp: StageDecisionInput):
    """Human gate: approve hands off to the next agent; reject stores feedback."""
    try:
        return orchestrator.decide(campaign_id, inp.stage, inp.action, inp.feedback)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------------- solo mode (standalone agents, no gates) ----------------
@app.post("/solo/research")
async def solo_research(inp: SoloResearchInput):
    """Agent 1 standalone - research a product/objective with no handoff chain."""
    try:
        return await orchestrator.solo_research(inp.product, inp.objective)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/solo/plan")
async def solo_plan(inp: SoloPlanInput):
    """Agent 2 standalone - plan directly from the knowledge base. Optionally pass
    campaign_id of a prior solo run to reuse its research as context."""
    try:
        return await orchestrator.solo_plan(inp.product, inp.objective, inp.campaign_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/solo/creative")
async def solo_creative(inp: SoloCreativeInput):
    """Agent 3 standalone - 'just generate an ad': URL + skill, no approved plan
    required. Optionally continue a prior solo campaign via campaign_id."""
    try:
        return await orchestrator.solo_creative(
            inp.url, inp.skill, inp.product, inp.objective,
            inp.campaign_id, inp.reference_id, inp.prompt_tweak)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/creative")
async def creative(inp: CreativeInput):
    """Agent 3: URL diagnosis -> copy + images (reference image + prompt tweak aware)."""
    try:
        return await orchestrator.run_creative(
            inp.campaign_id, inp.url, inp.skill, inp.reference_id, inp.prompt_tweak)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/placement")
async def placement(inp: PlacementInput):
    """Placement plan + expected metrics with probabilities."""
    try:
        return await orchestrator.run_placement(inp.creative_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.post("/publish")
def publish(inp: PublishInput):
    """Approve & Publish (POC: recorded in DB; ad-platform API goes here)."""
    try:
        return orchestrator.publish(inp.creative_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------------- video (Seedance, optional) ----------------
@app.post("/video")
async def video(inp: VideoInput):
    try:
        return await orchestrator.run_video(inp.creative_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.get("/videos/{creative_id}")
def get_video(creative_id: int):
    try:
        return FileResponse(orchestrator.video_path(creative_id), media_type="video/mp4")
    except ValueError as e:
        raise HTTPException(404, str(e))


# ---------------- reference images ----------------
@app.post("/reference")
async def upload_reference(file: UploadFile = File(...)):
    """Upload a reference image for faithful product renders."""
    try:
        data = await file.read()
        return orchestrator.save_reference(data, file.filename or "")
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/references/{reference_id}")
def get_reference(reference_id: str):
    try:
        return FileResponse(orchestrator.reference_path(reference_id))
    except ValueError as e:
        raise HTTPException(404, str(e))


# ---------------- assets + library ----------------
@app.get("/assets/{asset_id}")
def get_asset(asset_id: int):
    db = SessionLocal()
    try:
        a = db.get(Asset, asset_id)
        if not a:
            raise HTTPException(404, "asset not found")
        return FileResponse(a.path)
    finally:
        db.close()


@app.get("/cost")
def cost():
    return orchestrator.cost_summary()


@app.get("/library")
def library(brand: str | None = None, skill: str | None = None,
            cache_only: bool = False):
    return orchestrator.library_list(brand, skill, cache_only)


@app.get("/library/stats")
def library_stats():
    return orchestrator.library_stats()


@app.post("/assets/{asset_id}/reuse")
def reuse(asset_id: int):
    try:
        return orchestrator.reuse_asset(asset_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.post("/assets/{asset_id}/variant")
async def variant(asset_id: int, inp: VariantInput | None = None):
    """Re-render an asset; pass {"prompt": "..."} to use a user-edited prompt."""
    try:
        return await orchestrator.variant_asset(
            asset_id, inp.prompt if inp else None)
    except ValueError as e:
        raise HTTPException(404, str(e))


# ---------------- Serve built React bundle (single-service deploy) ----------
# Mounted LAST so it never shadows the API routes above. Enabled only when a
# production build exists (frontend/dist), e.g. on Railway.
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="spa")
