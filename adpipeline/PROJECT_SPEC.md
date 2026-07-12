# AdPipeline — Project Spec (hand-off)

A demo-grade but production-shaped agentic pipeline for CPG marketing, targeting
Colgate-Palmolive's **Hill's Pet Nutrition** and **Palmolive / skin-health**
portfolios (deliberately **not** oral care).

A staged, human-gated handoff chain: Agent 1 (Research & Monitor) diagnoses what's
going wrong → human approves → research hands off to Agent 2 (Strategy Planner),
which turns the metrics into a plan + marketing changes + next steps → human
approves → the plan hands off to Agent 3 (Creative), which generates reference-aware,
prompt-tweakable ad assets, a placement plan with probability-scored expected
metrics, and an Approve & Publish gate. Rejection at any gate re-runs that agent
with the feedback injected. Every generated asset lands on a persistent
**Asset Library** shelf, priced, with repeats served from cache at $0.00; every
campaign is resumable from **History**.

```
Pipeline:  01 Overview → 02 Research (AGT-1) → gate → 03 Plan (AGT-2) → gate → 04 Creative (AGT-3) → Approve & Publish
Below the divider:  ▤ Asset Library · ⟲ History   (persistent shelves, outlive every campaign)
        ▲ reject-feedback re-runs the gated agent ┘        └ published results feed AGT-1 next cycle
```

## Stack

Python 3.11, FastAPI, ChromaDB (persistent), Gemini (all text + vision + embeddings
+ search grounding), OpenAI (images only; mini text lifeline), Seedance lite t2v
(optional video), SQLite/SQLAlchemy (Postgres-swappable), React + Vite. No
LangGraph/LangChain — plain async Python + a simple orchestrator. Provider policy
is centralized in `config.py` + `llm/router.py`; agents name a task, never a provider.

## Model routing (the one rule)

| Workload | Model | Env override |
|---|---|---|
| ALL text-in/text-out (research, plan, copy, placement + expected metrics) and vision (URL diagnosis) | **`gemini-3.5-flash`** (free tier, $0) | `GEMINI_MODEL` / `GEMINI_MODEL_LITE` |
| `google_search` grounding ONLY (Agent 2's live competitor signal) | **`gemini-2.5-flash`** (free tier, $0) | `GEMINI_SEARCH_MODEL` |
| Image generation + reference-image edits | **`gpt-image-2`** (the $10 budget, tiered) | `IMAGE_MODEL` (or `IMAGE_PROVIDER=gemini` → free `gemini-2.5-flash-image` drafts) |
| RAG embeddings | `gemini-embedding-001` @768d ($0) | `GEMINI_EMBED_MODEL` / `EMBED_PROVIDER` |
| Text lifeline when Gemini 429s mid-demo | `gpt-4o-mini` (~$0.001/call) | — |

Search grounding is the single exception to "everything text on 3.5-flash" because
the grounding tool is tied to that model tier (`llm/gemini_client.search_enrich`).
All ids are env-overridable in the Railway dashboard without a code change.

## Agents (the handoff chain)

| # | Agent | Model (cost) | Output → handoff |
|---|-------|--------------|------------------|
| 1 | Research & Monitor | gemini-3.5-flash ($0) — **math precomputed in code** | summary, whats_wrong (severity+evidence+action), lagging, whats_working, scale rec → **human gate → Agent 2** |
| 2 | Strategy Planner | gemini-3.5-flash ($0) + optional google_search on gemini-2.5-flash ($0) | plan_summary, campaign_angle, target segment, metric-grounded marketing_changes, next_steps → **human gate → Agent 3** |
| 3 | Creative | gemini-3.5-flash vision/copy/placement ($0) + gpt-image-2 (tiered, the $10 budget) | URL diagnosis → copy + images (reference-image aware, prompt tweak, per-asset edit+regenerate) → placement + expected metrics w/ 0-1 probability → **Approve & Publish** |
| — | Video (optional) | Seedance lite t2v (~$0.30/5s clip, explicit click only) | one mp4 per /bundle creative, cached |

State machine = `Campaign.status`: research_pending → research_approved →
plan_pending → plan_approved → published (reject at a gate → `<stage>_rejected`,
feedback stored per campaign+stage, consumed only by a successful re-run).

Grounding rule: agents answer **only** from retrieved Chroma chunks; every claim
cites `[src: filename]`; numbers copied verbatim. Banned-claim guidelines enforced
in planner + copy. Gemini failures fall back to gpt-4o-mini so demos never die.
`GET /prompts` exposes each agent's exact system prompt.

## Creative skills (`backend/skills/registry.py`)

`/product-shoot` · `/amazon` (listing-compliant main image: pure white bg, ~85%
frame, no text overlay) · `/meta` (4:5 + 9:16 + hook overlays) · `/bundle` (all +
6-frame storyboard + text-to-video prompt — video renders only via the explicit
`POST /video` Seedance call, never inside the skill).

Each `image_spec` carries `kind` + `aspect`; the router assigns a **quality tier**
per kind (`config.QUALITY_BY_KIND`): hero/compliance → `high`, lifestyle/infographic
→ `medium`, storyboard stills → `low`. Tier maps to per-image cost
(`config.IMAGE_TIERS` — gpt-image 1024² pricing estimates; non-square bills 1.5x
via `config.tier_cost`. Adjust the three tier values if gpt-image-2 list prices
differ).

## Prompt-hash caching (the visible cost-discipline story)

- Cache key = `sha256(prompt | aspect | quality | ref_hash)` (`creative.prompt_hash`)
  — a user-uploaded reference image changes the output, so it is part of the key.
- Before generating, `orchestrator._cache_lookup(hash)` checks for a prior
  **real** asset (origin `generated`/`variant`, file present on disk). Hit ⇒ reuse
  the file at **$0.00**, `origin="cache_hit"`, and record `saved_usd = tier cost`.
- Miss ⇒ generate at the tier, write to `DATA_DIR/assets/<hash>.png`, log the cost.
- Over `MAX_IMAGE_CALLS_PER_RUN`, or on any API failure in `DEMO_MODE`, serve a
  placeholder from `/cache` (`origin="fallback"`, $0, **not** counted as a saving).

The system never pays twice for the same prompt. (Caching only shows real hits when
API keys are present — offline everything is a placeholder fallback, honestly $0.)

## Asset Library

`Asset` rows carry: `prompt_hash`, `quality`, `aspect`, `brand`, `skill`,
`campaign_id`, `origin`, `from_cache`, `cache_hit`, `cost_usd`, `path`.
`creative_id` is nullable (library-origin rows from Reuse/Variant). **Variant**
accepts an optional user-edited prompt — the per-image tweak flexibility.

Screen (sidebar, below a divider, outside the numbered pipeline):
- **4 stats:** assets stored · total image spend · cache hits · dollars saved.
- **Filters:** brand chips · skill chips · "Cache hits" toggle.
- **Grid:** each asset shows ID, campaign, skill, brand, quality tier + **exact
  cost**; cache hits badged green `CACHE HIT · $0.00`.
- **Per-asset actions:** **Reuse** (duplicate into the shelf at $0) · **Variant**
  (re-render the stored prompt through the cache).

## API

```
POST /campaigns                 {product, objective} -> Agent 1 research (research_pending)
GET  /campaigns                 history (everything previously generated)
GET  /campaigns/{id}            full campaign state (resume from History)
POST /campaigns/{id}/research   re-run Agent 1 (consumes rejection feedback)
POST /campaigns/{id}/plan       hand approved research to Agent 2
POST /campaigns/{id}/decision   {stage: research|plan, action: approve|reject, feedback?}
POST /creative                  {campaign_id, url, skill, reference_id?, prompt_tweak?}
POST /solo/research             {product, objective} -> Agent 1 standalone (no gates)
POST /solo/plan                 {product?, objective?, campaign_id?} -> Agent 2 standalone
POST /solo/creative             {url, skill, product?, objective?, campaign_id?, ...} -> just generate an ad
POST /placement                 {creative_id} -> placements + expected metrics w/ probability
POST /publish                   {creative_id} -> Approve & Publish (POC: recorded in DB)
POST /video                     {creative_id} -> Seedance render | prompt (if disabled)
GET  /videos/{creative_id}      serve the rendered mp4
POST /reference                 multipart upload -> {reference_id}
GET  /references/{id}           serve an uploaded reference image
GET  /prompts                   each agent's exact system prompt (read-only)
GET  /skills                    list creative skills
GET  /assets/{id}               serve image (reads from the Volume, never static)
GET  /cost                      cost readout by model
GET  /library?brand=&skill=&cache_only=
GET  /library/stats             assets_stored, image_spend_usd, cache_hits, dollars_saved_usd
POST /assets/{id}/reuse         duplicate onto the shelf ($0)
POST /assets/{id}/variant       {prompt?} re-render, optionally with a user-edited prompt
GET  /health
```

## Persistence & deploy (Railway)

**Railway's container filesystem is ephemeral — every deploy/restart/crash wipes it.**
So a single writable location must survive redeploys.

- **`DATA_DIR`** (env) is that location. Add a Railway **Volume**, mount at `/data`,
  set `DATA_DIR=/data`. Everything persistent lives under it — set in `config.py`,
  never hardcoded elsewhere:
  - `DATA_DIR/adpipeline.db` — SQLite (campaigns, decisions, assets, cost log)
  - `DATA_DIR/chroma` — Chroma index (no re-embed / re-cost on cold start)
  - `DATA_DIR/assets` — generated images, uploaded reference images, Seedance mp4s
- Images/videos served via `GET /assets/{id}` / `GET /videos/{id}` reading from the
  Volume — **never** static from the frontend, and **never** base64'd into the DB.
- **Bind `$PORT`:** `uvicorn main:app --host 0.0.0.0 --port $PORT` (`Procfile` /
  `nixpacks.toml` do this). Hardcoding 8000 = failed healthcheck.
- **Single service:** FastAPI serves `frontend/dist` (built in `nixpacks.toml`).
  One URL, no CORS. Split later if desired.
- **Env vars (dashboard, never commit `.env`):** `GOOGLE_API_KEY` (required — all
  text is Gemini free tier), `OPENAI_API_KEY` (images), `SEEDANCE_API_KEY` (optional
  video), `DATA_DIR`, `MAX_IMAGE_CALLS_PER_RUN`, `DEMO_MODE`, optional
  `IMAGE_PROVIDER` / `IMAGE_MODEL` / `GEMINI_MODEL` / `GEMINI_SEARCH_MODEL` /
  `EMBED_PROVIDER` / `DATABASE_URL` (full list in `.env.example`).
- **Cost guard:** set a Railway usage alert; `MAX_IMAGE_CALLS_PER_RUN` caps spend
  per run so a retry loop can't run away.
- **Cold starts:** warm the URL before a demo, or run locally and show the Railway
  URL as the "it ships" proof point.

**Scaling answer (build A, say B):** for production, move metadata to Railway
Postgres (`DATABASE_URL`) and blobs to Cloudflare R2 / S3, storing only the URL in
the DB. `config.py` already reads `DATABASE_URL`; the blob layer is the remaining
swap.

## Guardrails

- Two human gates before any money is spent on images; a third before publish.
- Every image call gated by `MAX_IMAGE_CALLS_PER_RUN`; `DEMO_MODE` serves `/cache`.
- Video never auto-triggers: explicit `POST /video`, one clip per creative, cached.
- All agent outputs Pydantic-validated; one retry with the JSON Schema on failure.
- Expected-metric probabilities instructed to stay calibrated (capped at 0.85
  unless the context shows the exact channel+region+product combination).
- Every LLM/image/video call logged (model, tokens, latency, cost) to SQLite → `/cost`.
- Gemini 429s: two backoff retries, then the gpt-4o-mini lifeline.

## Build order (already implemented)

1. Scaffold (FastAPI + SQLite + React shell) · 2. LLM clients + provider router
(Gemini free text, OpenAI images, Seedance video) · 3. RAG + grounded agents ·
4. Staged handoff (research → gate → plan → gate → creative) + reject-feedback
re-runs · 5. URL diagnosis + skills + cache fallback · 6. Placement + expected
metrics w/ probability + Approve & Publish · 7. Reference-image upload + prompt
tweak + per-asset edit/regenerate · 8. Glass UI + History + Asset Library +
prompt-hash caching + quality tiers + Railway persistence.
