"""Pydantic response contracts for every agent + API payloads."""
from typing import List, Optional

from pydantic import BaseModel, Field


# ---- Agent 1: Strategist ----
class Strategy(BaseModel):
    angle: str
    insight: str
    target_segment: str
    recommended_channel: str
    sources: List[str] = Field(default_factory=list)


class StrategistOutput(BaseModel):
    strategies: List[Strategy]


# ---- Agent 2: Sales & Distribution ----
class WhereSelling(BaseModel):
    region: str
    channel: str
    status: str


class Lagging(BaseModel):
    region: str
    reason: str
    sources: List[str] = Field(default_factory=list)


class ChannelMetric(BaseModel):
    channel: str
    region: str
    value: str
    sources: List[str] = Field(default_factory=list)


class SalesOutput(BaseModel):
    where_selling: List[WhereSelling]
    lagging: List[Lagging]
    cpl_by_channel: List[ChannelMetric]
    cvr_by_channel: List[ChannelMetric]
    key_risks: List[str]


# ---- Agent 3: Performance Monitor ----
class Alert(BaseModel):
    campaign: str
    severity: str            # low|medium|high
    reason: str
    action: str


class MonitorOutput(BaseModel):
    summary: str
    alerts: List[Alert]
    scale_recommendation: str


# ---- Combined brief ----
class BriefBody(BaseModel):
    strategist: StrategistOutput
    sales: SalesOutput
    monitor: MonitorOutput


class BriefResponse(BaseModel):
    id: int
    run_id: int
    status: str
    executive_summary: str
    body: BriefBody


class RunResponse(BaseModel):
    run_id: int
    product: str
    objective: str
    strategist: StrategistOutput
    sales: SalesOutput
    monitor: MonitorOutput
    brief: BriefResponse
    used_feedback: Optional[str] = None
    cost_usd: float = 0.0


# ---- Decisions ----
class DecisionInput(BaseModel):
    action: str              # approve|reject
    feedback: Optional[str] = None


# ---- Agent 4: Creative ----
class ProductProfile(BaseModel):
    name: str
    category: str
    key_claims: List[str]
    pack_description: str
    brand_colors: List[str]
    price_tier: str


class AssetOut(BaseModel):
    id: int
    kind: str
    prompt: str
    aspect: str
    url: str                 # /assets/{id}
    from_cache: bool


class CreativeInput(BaseModel):
    brief_id: int
    url: str
    skill: str


class CreativeResponse(BaseModel):
    creative_id: int
    profile: ProductProfile
    assets: List[AssetOut]
    copy_blocks: dict
    cost_usd: float = 0.0


# ---- Placement ----
class Placement(BaseModel):
    asset: str
    platform: str
    format: str
    budget_pct: float
    rationale: str
    projected_metric: str


class PlacementResponse(BaseModel):
    creative_id: int
    placements: List[Placement]


class PlacementInput(BaseModel):
    creative_id: int
