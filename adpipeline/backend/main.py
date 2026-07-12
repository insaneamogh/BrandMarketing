"""FastAPI app: routes for the 4-agent pipeline."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import orchestrator
from config import DEMO_MODE
from models import (
    Asset, Brief, Creative, Decision, Feedback, SessionLocal, init_db,
)
from rag import ingest
from schemas import (
    CreativeInput, DecisionInput, PlacementInput,
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
    ingest.ingest_if_empty()


@app.get("/health")
def health():
    return {"status": "ok", "demo_mode": DEMO_MODE}


class RunInput(BaseModel):
    product: str
    objective: str


@app.post("/runs")
async def create_run(inp: RunInput):
    return await orchestrator.run_screening(inp.product, inp.objective)


@app.get("/briefs/{brief_id}")
def get_brief(brief_id: int):
    db = SessionLocal()
    try:
        b = db.get(Brief, brief_id)
        if not b:
            raise HTTPException(404, "brief not found")
        return orchestrator.serialize_brief(b)
    finally:
        db.close()


@app.post("/briefs/{brief_id}/decision")
def decide(brief_id: int, inp: DecisionInput):
    db = SessionLocal()
    try:
        b = db.get(Brief, brief_id)
        if not b:
            raise HTTPException(404, "brief not found")
        if inp.action not in ("approve", "reject"):
            raise HTTPException(400, "action must be approve|reject")
        if inp.action == "reject" and not (inp.feedback or "").strip():
            raise HTTPException(400, "reject requires feedback")
        b.status = "approved" if inp.action == "approve" else "rejected"
        db.add(Decision(brief_id=brief_id, action=inp.action, feedback=inp.feedback))
        if inp.action == "reject":
            db.add(Feedback(product=b.run.product, text=inp.feedback))
        db.commit()
        return {"brief_id": brief_id, "status": b.status}
    finally:
        db.close()


@app.post("/creative")
async def creative(inp: CreativeInput):
    return await orchestrator.run_creative(inp.brief_id, inp.url, inp.skill)


@app.post("/placement")
async def placement(inp: PlacementInput):
    return await orchestrator.run_placement(inp.creative_id)


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
