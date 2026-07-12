"""Pydantic response contracts for every agent + API payloads (staged pipeline)."""
from typing import List, Optional

from pydantic import BaseModel, Field


# ---- Agent 1: Research & Monitor ----
class Issue(BaseModel):
    issue: str
    severity: str            # low|medium|high
    evidence: str            # cited, verbatim numbers
    action_hint: str
    sources: List[str] = Field(default_factory=list)


class Lagging(BaseModel):
    where: str               # region or channel
    reason: str
    sources: List[str] = Field(default_factory=list)


class Working(BaseModel):
    item: str
    evidence: str
    sources: List[str] = Field(default_factory=list)


class ResearchOutput(BaseModel):
    summary: str
    whats_wrong: List[Issue]
    lagging: List[Lagging]
    whats_working: List[Working]
    scale_recommendation: str


# ---- Agent 2: Strategy Planner ----
class MarketingChange(BaseModel):
    change: str
    basis_metric: str        # the cited number that justifies it
    expected_impact: str
    sources: List[str] = Field(default_factory=list)


class PlanOutput(BaseModel):
    plan_summary: str
    campaign_angle: str      # the creative direction Agent 3 executes
    target_segment: str
    recommended_channels: List[str]
    marketing_changes: List[MarketingChange]
    next_steps: List[str]


# ---- Campaign envelope ----
class CampaignResponse(BaseModel):
    id: int
    product: str
    objective: str
    status: str
    mode: str = "chain"       # chain (gated handoffs) | solo (standalone agents)
    research: Optional[ResearchOutput] = None
    plan: Optional[PlanOutput] = None
    used_feedback: Optional[str] = None
    cost_usd: float = 0.0


class CampaignInput(BaseModel):
    product: str
    objective: str


# ---- Solo mode (standalone agents, no gates) ----
class SoloResearchInput(BaseModel):
    product: str
    objective: str


class SoloPlanInput(BaseModel):
    product: Optional[str] = None      # required unless campaign_id given
    objective: Optional[str] = None
    campaign_id: Optional[int] = None  # reuse an existing solo campaign (its research
                                       # becomes optional context for the plan)


class SoloCreativeInput(BaseModel):
    url: str
    skill: str
    product: Optional[str] = None      # used when no campaign_id (fresh solo run)
    objective: Optional[str] = None    # becomes the creative brief in solo mode
    campaign_id: Optional[int] = None  # reuse an existing solo campaign
    reference_id: Optional[str] = None
    prompt_tweak: Optional[str] = None


class StageDecisionInput(BaseModel):
    stage: str               # research|plan
    action: str              # approve|reject
    feedback: Optional[str] = None


# ---- Agent 3: Creative ----
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
    cache_hit: bool = False
    cost_usd: float = 0.0


class CreativeInput(BaseModel):
    campaign_id: int
    url: str
    skill: str
    reference_id: Optional[str] = None    # token from POST /reference
    prompt_tweak: Optional[str] = None    # user art direction appended to image prompts


class CreativeResponse(BaseModel):
    creative_id: int
    campaign_id: int
    profile: ProductProfile
    assets: List[AssetOut]
    copy_blocks: dict
    reference_used: bool = False
    prompt_tweak: Optional[str] = None
    cost_usd: float = 0.0


# ---- Placement + expected metrics ----
class Placement(BaseModel):
    asset: str
    platform: str
    format: str
    budget_pct: float
    rationale: str
    projected_metric: str


class ExpectedMetric(BaseModel):
    metric: str              # e.g. CTR, CPL, CVR, ROAS
    expected: str            # e.g. "$3.10 CPL" — grounded in context
    probability: float       # 0.0–1.0 confidence the expectation is met
    rationale: str
    sources: List[str] = Field(default_factory=list)


class PlacementResponse(BaseModel):
    creative_id: int
    placements: List[Placement]
    expected_metrics: List[ExpectedMetric] = Field(default_factory=list)


class PlacementInput(BaseModel):
    creative_id: int


# ---- Video (Seedance, optional) ----
class VideoInput(BaseModel):
    creative_id: int


# ---- Publish ----
class PublishInput(BaseModel):
    creative_id: int


# ---- Per-asset regenerate with an edited prompt ----
class VariantInput(BaseModel):
    prompt: Optional[str] = None   # edited prompt; None = re-render stored prompt
