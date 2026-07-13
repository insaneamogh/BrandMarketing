"""ChromaDB: persistent local store, one logical collection, metadata-tagged chunks.

We keep a single physical collection and filter by the `collection` metadata field
so retrieve(collection, query, k) maps cleanly to the agent contracts.
"""
from typing import List, Optional

import chromadb

from config import CHROMA_DIR
from llm import router

_client = None
_col = None
COLLECTION = "corpus"


def _get_col():
    global _client, _col
    if _col is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _col = _client.get_or_create_collection(
            COLLECTION, metadata={"hnsw:space": "cosine"})
    return _col


def count() -> int:
    return _get_col().count()


def reset():
    """Drop and recreate the collection (used when the corpus changes)."""
    global _col
    _get_col()  # ensures _client exists
    try:
        _client.delete_collection(COLLECTION)
    except Exception:
        pass
    _col = _client.get_or_create_collection(
        COLLECTION, metadata={"hnsw:space": "cosine"})


def upsert(ids, documents, metadatas):
    embeddings = router.embed(documents)
    _get_col().upsert(
        ids=ids, documents=documents,
        metadatas=metadatas, embeddings=embeddings,
    )


def retrieve(collection: Optional[str], query: str, k: int = 4) -> List[dict]:
    """Return top-k chunks. `collection` filters the metadata group (or None=all).

    Each result: {text, source, collection, product, region, score}.

    RESILIENT: embedding the query needs the embed provider (Gemini free tier by
    default). If that provider is rate-capped, we return [] rather than throw -
    agents are built to handle "(no context retrieved)" and their own text calls
    still fall back to gpt-4o-mini. Cross-provider embed fallback is deliberately
    NOT done: a query vector from a different model lives in a different vector
    space and would return semantically random chunks (worse than no context).
    To make retrieval itself cap-immune, set EMBED_PROVIDER=openai (auto re-
    ingests) so the whole RAG layer never touches the Gemini free tier."""
    try:
        emb = router.embed([query])[0]
    except Exception as e:
        print(f"[retrieve] embedding unavailable, serving no context: {e}")
        return []
    where = {"collection": collection} if collection else None
    res = _get_col().query(
        query_embeddings=[emb], n_results=k, where=where,
        include=["documents", "metadatas", "distances"],
    )
    out = []
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]
    for doc, meta, dist in zip(docs, metas, dists):
        out.append({
            "text": doc,
            "source": meta.get("source"),
            "collection": meta.get("collection"),
            "product": meta.get("product"),
            "region": meta.get("region"),
            "score": round(1 - dist, 3),
        })
    return out


def retrieve_many(collections: List[str], query: str, k: int = 4) -> List[dict]:
    """Retrieve across several logical collections, dedup by source+text."""
    seen = set()
    out = []
    for c in collections:
        for r in retrieve(c, query, k):
            key = (r["source"], r["text"][:60])
            if key not in seen:
                seen.add(key)
                out.append(r)
    return out
