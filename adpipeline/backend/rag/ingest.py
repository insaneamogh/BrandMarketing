"""Chunk (~300 tokens) + embed + upsert the corpus. Runs at startup.

Each corpus file is tagged with one or more logical collections so agents can
retrieve by group (market_intel, sales, distribution, channel_metrics,
campaign_history, brand_guidelines). Chroma metadata is scalar-only, so a chunk
that belongs to N collections is upserted N times with distinct ids.

The index is fingerprinted against the corpus: if any corpus file (or the
manifest) changes, the whole collection is wiped and re-embedded so the vector
DB never serves stale chunks.
"""
import hashlib
from pathlib import Path

import tiktoken

from config import CHROMA_DIR, CORPUS_DIR
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
    # real public data layered on the mock internal data:
    "industry_ad_benchmarks.md":   (["channel_metrics", "market_intel"], "all", "global"),
    "senior_pet_demographics.md":  (["market_intel", "campaign_history"], "hills", "global"),
    "quick_commerce_india.md":     (["distribution", "channel_metrics", "market_intel"], "palmolive", "india"),
    "therapeutic_pet_market.md":   (["market_intel", "sales", "channel_metrics"], "hills", "global"),
    "skin_health_brand_performance.md": (["market_intel", "sales", "campaign_history"], "skin_health", "global"),
    "brand_guidelines_skinhealth.md":   (["brand_guidelines"], "skin_health", "global"),
    # exact per-product facts quoted from the LIVE product pages (July 2026) -
    # in brand_guidelines so the copywriter/prompt-writer cite exact claims
    "product_catalog.md":          (["brand_guidelines", "market_intel"], "all", "global"),
}

_enc = None  # lazy: tiktoken downloads its BPE file on first use


def _tok_len(text: str) -> int:
    global _enc
    if _enc is None:
        try:
            _enc = tiktoken.get_encoding("cl100k_base")
        except Exception:
            _enc = False  # offline - fall back to a ~4 chars/token estimate
    if _enc:
        return len(_enc.encode(text))
    return max(1, len(text) // 4)


def _chunk(text: str, target_tokens: int = 300):
    """Split on paragraphs, packing to ~target_tokens per chunk."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, cur, cur_tok = [], [], 0
    for p in paras:
        n = _tok_len(p)
        if cur_tok + n > target_tokens and cur:
            chunks.append("\n\n".join(cur))
            cur, cur_tok = [], 0
        cur.append(p)
        cur_tok += n
    if cur:
        chunks.append("\n\n".join(cur))
    return chunks


def corpus_fingerprint() -> str:
    """Hash of the manifest + every corpus file's bytes - detects any change."""
    h = hashlib.sha256()
    for fname in sorted(MANIFEST):
        h.update(fname.encode())
        h.update(repr(MANIFEST[fname]).encode())
        path = Path(CORPUS_DIR) / fname
        if path.exists():
            h.update(path.read_bytes())
    return h.hexdigest()


def ingest():
    ids, docs, metas = [], [], []
    for fname, (collections, product, region) in MANIFEST.items():
        path = Path(CORPUS_DIR) / fname
        if not path.exists():
            continue
        chunks = _chunk(path.read_text(encoding="utf-8"))
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


def ingest_if_stale():
    """(Re-)ingest when the index is empty OR the corpus changed since last ingest."""
    marker = Path(CHROMA_DIR) / "corpus_fingerprint.txt"
    try:
        fp = corpus_fingerprint()
        fresh = (store.count() > 0 and marker.exists()
                 and marker.read_text().strip() == fp)
        if fresh:
            return
        store.reset()
        n = ingest()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(fp)
        print(f"[ingest] embedded {n} chunks (corpus {fp[:12]})")
    except Exception as e:  # no API key etc. - don't block startup
        print(f"[ingest] skipped: {e}")


# kept for backwards compatibility with older callers
ingest_if_empty = ingest_if_stale
