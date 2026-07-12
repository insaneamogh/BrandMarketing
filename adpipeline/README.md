# AdPipeline — 4-Agent Autonomous Marketing System

A demo-grade but production-shaped agentic pipeline for CPG marketing, targeting
Colgate-Palmolive's **Hill's Pet Nutrition** and **Palmolive / skin-health**
portfolios (deliberately **not** oral care).

Three RAG-grounded analyst agents produce a findings brief → a human approves or
rejects → an approved brief flows to a creative agent (slash-command skills) that
diagnoses a product URL and generates ad-asset bundles → a placement pass recommends
where/how to post. Rejection feedback loops back into the analysts' next run.

## The loop

```
Screening (3 analysts + brief)  →  Approval (human)  →  Creative (URL + skill)  →  Placement
        ▲                                  │ reject
        └───────── feedback ───────────────┘
```

- **Agent 1 — Strategist** (gpt-4o): 3 grounded strategies from market intel + brand guidelines.
- **Agent 2 — Sales & Distribution** (gpt-4o): where selling, laggards, CPL/CVR, risks.
- **Agent 3 — Performance Monitor** (gpt-4o-mini): campaign alerts + scale rec. *Math precomputed in code, never by the LLM.*
- **Brief merge** (gpt-4o-mini): 4-sentence executive summary + combined body → `Brief(status=pending)`.
- **Agent 4 — Creative** (gpt-4o + gpt-image-1): URL diagnosis → skill execution (copy + images) → placement pass.

Every analyst claim carries a `[src: filename]` citation from the ChromaDB RAG store.

## Stack

Python 3.11+, FastAPI, ChromaDB (persistent local), OpenAI (`gpt-4o`, `gpt-4o-mini`,
`gpt-image-1`, `text-embedding-3-small`), Gemini (`gemini-2.0-flash` w/ `google_search`
grounding), SQLite via SQLAlchemy, React + Vite. No LangGraph/LangChain — plain async
Python + a simple orchestrator.

## Setup

```bash
cd adpipeline
cp .env.example .env        # add OPENAI_API_KEY (+ GOOGLE_API_KEY for Gemini enrichment)

# backend
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python seed_cache.py        # placeholder cache images for DEMO_MODE image fallback
./run.sh                    # uvicorn on :8000  (ingests the 9 corpus docs on first boot)

# frontend (new terminal)
cd ../frontend
npm install
npm run dev                 # Vite on :5173, proxies API to :8000
```

Open http://localhost:5173.

## Environment

```
OPENAI_API_KEY=            # required (text + embeddings + images)
GOOGLE_API_KEY=            # optional (Gemini search grounding)
DEMO_MODE=true             # image gen falls back to /cache on any API failure or cap
MAX_IMAGE_CALLS_PER_RUN=6  # hard cap on gpt-image-1 calls per creative run
```

## Demo script (< 5 min, < $1 per full run)

1. **Screening** — pick *Hill's Youthful Vitality*, keep the objective, **Run screening**.
   Three agent cards fill; every claim shows source chips (`hills_regional_sales.md`, …).
2. **Approval** — read the 4-sentence exec summary. **Reject** with feedback, e.g.
   *"Too NA-centric — prioritize India quick-commerce, cut vet-referral emphasis."*
   Re-run screening: the banner shows the consumed feedback and the analysts visibly shift.
3. Re-run and **Approve** (green `APPROVED` stamp).
4. **Creative** — choose `/amazon`, paste a real hillspet.com URL, **Run**. See the
   `ProductProfile` card, then the compliant asset grid (main image = pure white bg,
   no text overlay). Click any asset to reveal its prompt.
5. **Placement** — **Run placement pass**: asset → platform → format → budget% table,
   grounded in `channel_metrics.md`. Footer notes the projections feed Agent 3 next cycle.
6. Point at the sidebar **Run cost** ($X.XX) — logged per LLM/image call in SQLite.

## Guardrails

- Every image call gated by `MAX_IMAGE_CALLS_PER_RUN`; `DEMO_MODE` serves `/cache` on any failure.
- All agent outputs validated by Pydantic; one retry with the JSON Schema on parse/validation failure.
- Every LLM/image call logged (model, tokens, latency, cost) to SQLite → `GET /cost` and the UI readout.
- Analysts answer **only** from retrieved chunks; banned-claim guidelines enforced in strategist + copy.

## RAG corpus (`backend/rag/corpus/`)

9 mock docs grounded in Colgate's public numbers: Hill's regional sales, skin-health
diagnostics, Palmolive channels, channel CPL/CVR metrics, campaign history, Hill's &
Palmolive brand guidelines (with banned claims), APAC distributor notes, competitor
snapshot. Ingested (chunk ~300 tokens → embed → Chroma) once at startup if empty.

## API

```
POST /runs                   {product, objective} -> 3 agent outputs + brief
GET  /briefs/{id}
POST /briefs/{id}/decision   {action: approve|reject, feedback?}
POST /creative               {brief_id, url, skill} -> ProductProfile + assets + copy
POST /placement              {creative_id} -> placement plan
GET  /assets/{id}            serve generated/cached image
GET  /cost                   cost readout by model
GET  /health
```

## Notes

- Amazon blocks scraping — demo URL diagnosis with `hillspet.com` / `palmolive.com`
  pages, or pass `manual:<pasted text>` as the URL for the manual-entry fallback.
- `/bundle` produces a 6-frame storyboard + a ready-to-run Veo prompt only — **no video
  API is called** (cost control).
