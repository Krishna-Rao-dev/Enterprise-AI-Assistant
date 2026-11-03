"""
Hybrid retrieval (BM25 + ChromaDB) with ACL + repo filter, RRF merge, rerank.
Loaded once at startup; chunks list kept in memory for BM25.
"""

from typing import List, Optional
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from sentence_transformers import CrossEncoder

from app.config import CHROMA_DIR, EMB_MODEL, RERANK_MODEL

# ── singletons (populated by init_retrieval) ────────────────────────────────
_vs: Optional[Chroma] = None
_chunks: List[Document] = []
_reranker: Optional[CrossEncoder] = None


def init_retrieval():
    """Call once at FastAPI startup after ingest.py has been run."""
    global _vs, _chunks, _reranker
    emb = HuggingFaceEmbeddings(model_name=EMB_MODEL)
    _vs = Chroma(persist_directory=CHROMA_DIR, embedding_function=emb)
    # Load all docs into memory for BM25 (small corpus, fine for ~10k chunks)
    _chunks = _vs.get()["documents"]  # raw strings
    # Rebuild as Document objects with metadata
    raw = _vs.get(include=["documents", "metadatas"])
    _chunks = [
        Document(page_content=doc, metadata=meta)
        for doc, meta in zip(raw["documents"], raw["metadatas"])
    ]
    _reranker = CrossEncoder(RERANK_MODEL)
    print(f"[retrieval] loaded {len(_chunks)} chunks from ChromaDB")


# ── ACL helpers ──────────────────────────────────────────────────────────────

def _acl_filter(groups: set) -> dict:
    conds = [{f"grp_{g}": True} for g in sorted(groups)]
    return conds[0] if len(conds) == 1 else {"$or": conds}


def _chunk_allowed(chunk: Document, groups: set, repo: Optional[str]) -> bool:
    meta = chunk.metadata
    allowed_groups = set(meta.get("allowed_groups", "").split(","))
    if not groups & allowed_groups:
        return False
    # repo filter: if chunk has a repo tag, user must have access
    chunk_repo = meta.get("repo")
    if chunk_repo and repo and chunk_repo != repo:
        return False
    return True


# ── main retrieval ───────────────────────────────────────────────────────────

def hybrid_search(
    query: str,
    groups: set,
    k: int = 10,
    repo: Optional[str] = None,
) -> List[Document]:
    """
    ACL-filtered hybrid retrieval.
    groups  — set of group names the user belongs to (from DB, not LLM)
    repo    — optional repo slug to scope retrieval further
    """
    if not groups:
        return []   # fail closed

    # ── vector side (Chroma filter) ──
    chroma_filter = _acl_filter(groups)
    if repo:
        # narrow to this repo only (OR no-repo policy docs)
        chroma_filter = {
            "$or": [
                {**chroma_filter, "repo": repo},
                {**chroma_filter, "source_type": "policy"},
            ]
        }
    vec = _vs.as_retriever(search_kwargs={"k": k, "filter": chroma_filter})
    vec_docs = vec.invoke(query)

    # ── BM25 side (in-memory filter) ──
    allowed = [c for c in _chunks if _chunk_allowed(c, groups, repo)]
    bm25_docs = BM25Retriever.from_documents(allowed, k=k).invoke(query) if allowed else []

    # ── RRF merge ──
    scores, by_key = {}, {}
    for docs in (vec_docs, bm25_docs):
        for rank, d in enumerate(docs):
            key = d.page_content
            scores[key] = scores.get(key, 0) + 1 / (60 + rank)
            by_key[key] = d
    return [by_key[k] for k, _ in sorted(scores.items(), key=lambda x: -x[1])]


def rerank(query: str, docs: List[Document], top_n: int = 5) -> List[Document]:
    if not docs:
        return []
    sc = _reranker.predict([(query, d.page_content) for d in docs])
    return [d for d, _ in sorted(zip(docs, sc), key=lambda x: -x[1])[:top_n]]
