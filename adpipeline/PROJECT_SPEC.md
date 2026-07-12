# AdPipeline — Project Spec (hand-off)

A demo-grade but production-shaped agentic pipeline for CPG marketing, targeting
Colgate-Palmolive's **Hill's Pet Nutrition** and **Palmolive / skin-health**
portfolios (deliberately **not** oral care).

Three RAG-grounded analyst agents produce a findings brief → a human approves or
rejects → an approved brief flows to a creative agent (slash-command skills) that
diagnoses a product URL and generates ad-asset bundles → a placement pass recommends
where/how to post. Rejection feedback loops into the analysts' next run. Every
generated asset lands on a persistent **Asset Library** shelf, priced, with repeats
served from cache at $0.00.

```
Pipeline (this run):  01 Overview → 02 Strategist → 03 Sales → 04 Monitor → 05 Approval → 06 Creative Studio
Below the divider   :  ▤ Asset Library  (persistent shelf, outlives every run)
        ▲ reject-feedback ──────────────────────────────────────┘  loop
```

## Stack

Python 3.11, FastAPI, ChromaDB (persistent), OpenAI (`gpt-4o`, `gpt-4o-mini`,
image model via `IMAGE_MODEL`, `text-embedding-3-small`), Gemini (`gemini-2.0-flash`
+ `google_search` grounding), SQLite/SQLAlchemy (Postgres-swappable), React + Vite.
No LangGraph/LangChain — plain async Python + a simple orchestrator.

## Agents

| # | Agent | Model | Output |
|---|-------|-------|--------|
| 1 | Strategist | gpt-4o | 3 cited strategies (angle, insight, segment, channel, sources) |
| 2 | Sales & Distribution | gpt-4o | where_selling, lagging, CPL/CVR by channel, key_risks |
| 3 | Performance Monitor | gpt-4o-mini | summary, alerts, scale_recommendation — **math precomputed in code** |
| — | Brief merge | gpt-4o-mini | 4-sentence exec summary + combined body → `Brief(status=pending)` |
| 4 | Creative | gpt-4o + image model | URL diagnosis → skill execution (copy + images) → placement pass |

Grounding rule: analysts answer **only** from retrieved Chroma chunks; every claim
cites `[src: filename]`. Banned-claim guidelines enforced in strategist + copy.

## Creative skills (`backend/skills/registry.py`)

`/product-shoot` · `/amazon` (listing-compliant main image: pure white bg, ~85%
frame, no text overlay) · `/meta` (4:5 + 9:16 + hook overlays) · `/bundle` (all +
6-frame storyboard + Veo prompt — **no video API called**).

Each `image_spec` carries `kind` + `aspect`; the router assigns a **quality tier**
per kind (`config.QUALITY_BY_KIND`): hero/compliance → `high`, lifestyle/infographic
→ `medium`, storyboard stills → `low`. Tier maps to per-image cost
(`config.IMAGE_TIERS`, ~gpt-image-1 1024² pricing).

## Prompt-hash caching (the visible cost-discipline story)

- Cache key = `sha256(prompt | aspect | quality)` (`creative.prompt_hash`).
- Before generating, `orchestrator._cache_lookup(hash)` checks for a prior
  **real** asset (origin `generated`/`variant`, file present on disk). Hit ⇒ reuse
  the file at **$0.00**, `origin="cache_hit"`, and record `saved_usd = tier cost`.
- Miss ⇒ generate at the tier, write to `DATA_DIR/assets/<hash>.png`, log the cost.
- Over `MAX_IMAGE_CALLS_PER_RUN`, or on any API failure in `DEMO_MODE`, serve a
  placeholder from `/cache` (`origin="fallback"`, $0, **not** counted as a saving).

The system never pays twice for the same prompt. (Caching only shows real hits when
API keys are present — offline everything is a placeholder fallback, honestly $0.)

## Asset Library

`Asset` rows carry: `prompt_hash`, `quality`, `aspect`, `brand`, `skill`, `run_id`,
`origin`, `from_cache`, `cache_hit`, `cost_usd`, `path`. `creative_id` is nullable
(library-origin rows from Reuse/Variant).

Screen (sidebar, below a divider, outside the numbered pipeline):
- **4 stats:** assets stored · total image spend · cache hits · dollars saved.
- **Filters:** brand chips · skill chips · "Cache hits" toggle.
- **Grid:** each asset shows ID, run, skill, brand, quality tier + **exact cost**;
  cache hits badged green `CACHE HIT · $0.00`.
- **Per-asset actions:** **Reuse** (duplicate into the shelf at $0) · **Variant**
  (re-render the stored prompt through the cache).

## API

```
POST /runs                      {product, objective} -> 3 agent outputs + brief
GET  /briefs/{id}
POST /briefs/{id}/decision      {action: approve|reject, feedback?}
POST /creative                  {brief_id, url, skill} -> profile + assets + copy
POST /placement                 {creative_id} -> placement plan
GET  /assets/{id}               serve image (reads from the Volume, never static)
GET  /cost                      cost readout by model
GET  /library?brand=&skill=&cache_only=
GET  /library/stats             assets_stored, image_spend_usd, cache_hits, dollars_saved_usd
POST /assets/{id}/reuse         duplicate onto the shelf ($0)
POST /assets/{id}/variant       re-render the stored prompt (cache-aware)
GET  /health
```

## Persistence & deploy (Railway)

**Railway's container filesystem is ephemeral — every deploy/restart/crash wipes it.**
So a single writable location must survive redeploys.

- **`DATA_DIR`** (env) is that location. Add a Railway **Volume**, mount at `/data`,
  set `DATA_DIR=/data`. Everything persistent lives under it — set in `config.py`,
  never hardcoded elsewhere:
  - `DATA_DIR/adpipeline.db` — SQLite
  - `DATA_DIR/chroma` — Chroma index (no re-embed / re-cost on cold start)
  - `DATA_DIR/assets` — generated + reused image blobs
- Images served via `GET /assets/{id}` reading from the Volume — **never** static
  from the frontend, and **never** base64'd into the DB.
- **Bind `$PORT`:** `uvicorn main:app --host 0.0.0.0 --port $PORT` (`Procfile` /
  `nixpacks.toml` do this). Hardcoding 8000 = failed healthcheck.
- **Single service:** FastAPI serves `frontend/dist` (built in `nixpacks.toml`).
  One URL, no CORS. Split later if desired.
- **Env vars (dashboard, never commit `.env`):** `OPENAI_API_KEY`, `GOOGLE_API_KEY`,
  `DATA_DIR`, `MAX_IMAGE_CALLS_PER_RUN`, `DEMO_MODE`, optional `IMAGE_MODEL` /
  `GEMINI_MODEL` / `DATABASE_URL`.
- **Cost guard:** set a Railway usage alert; `MAX_IMAGE_CALLS_PER_RUN` caps spend
  per run so a retry loop can't run away.
- **Cold starts:** warm the URL before a demo, or run locally and show the Railway
  URL as the "it ships" proof point.

**Scaling answer (build A, say B):** for production, move metadata to Railway
Postgres (`DATABASE_URL`) and blobs to Cloudflare R2 / S3, storing only the URL in
the DB. `config.py` already reads `DATABASE_URL`; the blob layer is the remaining
swap.

## Guardrails

- Every image call gated by `MAX_IMAGE_CALLS_PER_RUN`; `DEMO_MODE` serves `/cache`.
- All agent outputs Pydantic-validated; one retry with the JSON Schema on failure.
- Every LLM/image call logged (model, tokens, latency, cost) to SQLite → `/cost`.

## Build order (already implemented)

1. Scaffold (FastAPI + SQLite + React shell) · 2. LLM clients + router · 3. RAG +
3 analysts + cited brief · 4. Approval + reject-feedback loop · 5. URL diagnosis +
skills + `/amazon` + cache fallback · 6. Remaining skills + placement · 7. Glass UI ·
8. Asset Library + prompt-hash caching + quality tiers + Railway persistence.
