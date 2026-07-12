"""SQLAlchemy models: Run, Brief, Decision, Asset, Feedback, LLMCall."""
import datetime as dt

from sqlalchemy import (
    Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from config import DB_URL

Base = declarative_base()
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _now():
    return dt.datetime.utcnow()


class Run(Base):
    __tablename__ = "runs"
    id = Column(Integer, primary_key=True)
    product = Column(String, nullable=False)
    objective = Column(Text, nullable=False)
    status = Column(String, default="running")   # running|complete|error
    created_at = Column(DateTime, default=_now)
    strategist_json = Column(Text)               # raw agent outputs (JSON strings)
    sales_json = Column(Text)
    monitor_json = Column(Text)
    briefs = relationship("Brief", back_populates="run")


class Brief(Base):
    __tablename__ = "briefs"
    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("runs.id"))
    status = Column(String, default="pending")   # pending|approved|rejected
    executive_summary = Column(Text)
    body_json = Column(Text)                     # merged brief JSON
    created_at = Column(DateTime, default=_now)
    run = relationship("Run", back_populates="briefs")


class Decision(Base):
    __tablename__ = "decisions"
    id = Column(Integer, primary_key=True)
    brief_id = Column(Integer, ForeignKey("briefs.id"))
    action = Column(String)                       # approve|reject
    feedback = Column(Text)
    created_at = Column(DateTime, default=_now)


class Feedback(Base):
    """Rejection feedback queued to inject into the next run's analyst prompts."""
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True)
    product = Column(String)
    text = Column(Text)
    consumed = Column(Integer, default=0)         # 0=pending, 1=used in a run
    created_at = Column(DateTime, default=_now)


class Creative(Base):
    __tablename__ = "creatives"
    id = Column(Integer, primary_key=True)
    brief_id = Column(Integer, ForeignKey("briefs.id"))
    url = Column(String)
    skill = Column(String)
    profile_json = Column(Text)                   # ProductProfile
    copy_json = Column(Text)                      # copy blocks
    placement_json = Column(Text)                 # placement plan
    created_at = Column(DateTime, default=_now)
    assets = relationship("Asset", back_populates="creative")


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    creative_id = Column(Integer, ForeignKey("creatives.id"))
    kind = Column(String)                         # packshot|lifestyle|infographic|...
    prompt = Column(Text)
    aspect = Column(String)
    path = Column(String)                         # file path under cache/ or generated/
    from_cache = Column(Integer, default=0)
    creative = relationship("Creative", back_populates="assets")


class LLMCall(Base):
    """One row per LLM/image call for the cost readout."""
    __tablename__ = "llm_calls"
    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, nullable=True)
    model = Column(String)
    task = Column(String)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    latency_ms = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    created_at = Column(DateTime, default=_now)


def init_db():
    Base.metadata.create_all(engine)
