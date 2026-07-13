"""SQLAlchemy models for the staged handoff pipeline.

Campaign lifecycle (one row per campaign, statuses gate the handoffs):
    research_pending  -> Agent 1 output awaiting the human
    research_approved -> research handed off to Agent 2
    plan_pending      -> Agent 2 output awaiting the human
    plan_approved     -> plan handed off to Agent 3 (creative unlocked)
    published         -> human clicked Approve & Publish on a creative

NOTE: this schema replaced the old Run/Brief flow. If you have an old local
DATA_DIR, delete it (adpipeline/data/) - the POC ships no migrations.
"""
import datetime as dt

from sqlalchemy import (
    Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from config import DB_URL

Base = declarative_base()
# check_same_thread is SQLite-only; passing it to Postgres (Option B) would fail.
_connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}
engine = create_engine(DB_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _now():
    return dt.datetime.utcnow()


class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True)
    product = Column(String, nullable=False)
    objective = Column(Text, nullable=False)
    status = Column(String, default="research_pending")
    mode = Column(String, default="chain")        # chain (gated handoffs) | solo (standalone agents)
    research_json = Column(Text)                  # Agent 1 output (ResearchOutput)
    plan_json = Column(Text)                      # Agent 2 output (PlanOutput)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    decisions = relationship("StageDecision", back_populates="campaign")
    creatives = relationship("Creative", back_populates="campaign")


class StageDecision(Base):
    """Every human approve/reject at a gate - the audit trail of the handoffs."""
    __tablename__ = "stage_decisions"
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    stage = Column(String)                        # research|plan|publish
    action = Column(String)                       # approve|reject|publish
    feedback = Column(Text)
    created_at = Column(DateTime, default=_now)
    campaign = relationship("Campaign", back_populates="decisions")


class Feedback(Base):
    """Rejection feedback queued per campaign+stage, injected into the re-run."""
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer)
    stage = Column(String)                        # research|plan
    text = Column(Text)
    consumed = Column(Integer, default=0)         # 0=pending, 1=used in a run
    created_at = Column(DateTime, default=_now)


class Creative(Base):
    __tablename__ = "creatives"
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    url = Column(String)
    skill = Column(String)
    reference_path = Column(String)               # uploaded reference image (optional)
    prompt_tweak = Column(Text)                   # user art direction appended to prompts
    profile_json = Column(Text)                   # ProductProfile
    prompts_json = Column(Text)                   # drafted image prompts awaiting approval
    copy_json = Column(Text)                      # copy blocks
    placement_json = Column(Text)                 # placement plan + expected metrics
    video_json = Column(Text)                     # Seedance video result / prompt
    published = Column(Integer, default=0)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    campaign = relationship("Campaign", back_populates="creatives")
    assets = relationship("Asset", back_populates="creative")


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    creative_id = Column(Integer, ForeignKey("creatives.id"), nullable=True)  # null = library-origin
    campaign_id = Column(Integer, nullable=True)
    brand = Column(String)                        # hills|palmolive (for library filters)
    skill = Column(String)                        # /amazon /meta ... (for library filters)
    kind = Column(String)                         # packshot|lifestyle|infographic|...
    prompt = Column(Text)
    prompt_hash = Column(String, index=True)      # sha256(prompt|aspect|quality|ref) - cache key
    aspect = Column(String)
    quality = Column(String)                      # low|medium|high
    path = Column(String)                         # file path under ASSETS_DIR or cache/
    from_cache = Column(Integer, default=0)       # served from a placeholder (demo fallback)
    cache_hit = Column(Integer, default=0)        # prompt seen before -> reused, $0
    origin = Column(String, default="generated")  # generated|cache_hit|reuse|variant|fallback
    cost_usd = Column(Float, default=0.0)
    created_at = Column(DateTime, default=_now)
    creative = relationship("Creative", back_populates="assets")


class LLMCall(Base):
    """One row per LLM/image/video call for the cost readout."""
    __tablename__ = "llm_calls"
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, nullable=True)
    model = Column(String)
    task = Column(String)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    latency_ms = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    created_at = Column(DateTime, default=_now)


def init_db():
    Base.metadata.create_all(engine)
    # best-effort micro-migration: add campaigns.mode to DBs created before the
    # solo-agents feature (create_all never alters existing tables).
    try:
        with engine.connect() as conn:
            cols = [row[1] for row in
                    conn.exec_driver_sql("PRAGMA table_info(campaigns)")]
            if cols and "mode" not in cols:
                conn.exec_driver_sql(
                    "ALTER TABLE campaigns ADD COLUMN mode VARCHAR DEFAULT 'chain'")
                conn.commit()
            ccols = [row[1] for row in
                     conn.exec_driver_sql("PRAGMA table_info(creatives)")]
            if ccols and "prompts_json" not in ccols:
                conn.exec_driver_sql(
                    "ALTER TABLE creatives ADD COLUMN prompts_json TEXT")
                conn.commit()
    except Exception:
        pass  # non-SQLite backends: manage the column with a real migration
