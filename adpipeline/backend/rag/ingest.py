"""Chunk (~300 tokens) + embed + upsert the corpus. Runs once at startup if empty.

Each corpus file is tagged with one or more logical collections so agents can
retrieve by group (market_intel, sales, distribution, channel_metrics,
campaign_history, brand_guidelines). Chroma metadata is scalar-only, so a chunk
that belongs to N collections is upserted N times with distinct ids.
"""
from pathlib import Path

import tiktoken

from config import CORPUS_DIR
from rag import store

# file -> (collections, product, region)
MANIFEST = {
    "hills_regional_sales.md":     (["sales", "distribution", "market_intel"], "hills", "global"),
    "skin_health_diagnostics.md":  (["market_intel", "sales"], "skin_health", "global"),
    "palmolive_channel_data.md":   (["sales", "distribution", "channel_metrics"], "palmolive", "global"),
    "channel_metrics.md":          (["channel_metrics"], "all", "global"),
    "campaign_history.md":         (["campaign_history"], "all", "global"),
    "brand_guidelines_hills.md":   (["brand_guidelines"], "hills", "global"),
    "brand_guidelines_palmolive.md": (["brand_guidelines"], "palmolive", "global"),
    "distributor_notes_apac.md":   (["distribution"], "all", "apac"),
    "competitor_snapshot.md":      (["market_intel"], "all", "global"),
}

_enc = tiktoken.get_encoding("cl100k_base")


def _chunk(text: str, target_tokens: int = 300):
    """Split on paragraphs, packing to ~target_tokens per chunk."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, cur, cur_tok = [], [], 0
    for p in paras:
        n = len(_enc.encode(p))
        if cur_tok + n > target_tokens and cur:
            chunks.append("\n\n".join(cur))
            cur, cur_tok = [], 0
        cur.append(p)
        cur_tok += n
    if cur:
        chunks.append("\n\n".join(cur))
    return chunks


def ingest():
    ids, docs, metas = [], [], []
    for fname, (collections, product, region) in MANIFEST.items():
        path = Path(CORPUS_DIR) / fname
        if not path.exists():
            continue
        chunks = _chunk(path.read_text())
        for coll in collections:
            for i, ch in enumerate(chunks):
                ids.append(f"{fname}:{coll}:{i}")
                docs.append(ch)
                metas.append({
                    "source": fname, "collection": coll,
                    "product": product, "region": region,
                })
    # batch to keep embed calls reasonable
    B = 64
    for i in range(0, len(ids), B):
        store.upsert(ids[i:i + B], docs[i:i + B], metas[i:i + B])
    return len(ids)


def ingest_if_empty():
    try:
        if store.count() == 0:
            n = ingest()
            print(f"[ingest] embedded {n} chunks")
    except Exception as e:  # no API key etc. — don't block startup
        print(f"[ingest] skipped: {e}")
