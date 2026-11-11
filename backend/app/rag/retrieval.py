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
    raw = _vs.get(include=["documents", "metadatas"])
    _chunks = [
        Document(page_content=doc, metadata=meta)
        for doc, meta in zip(raw["documents"], raw["metadatas"])
    ]
    _reranker = CrossEncoder(RERANK_MODEL)
    print(f"[retrieval] loaded {len(_chunks)} chunks from ChromaDB")
    repo_access: dict[str, set[str]] = {}
    for chunk in _chunks:
        repo = chunk.metadata.get("repo")
        if repo:
            repo_access.setdefault(repo, set()).update(
                filter(None, chunk.metadata.get("allowed_groups", "").split(","))
            )
    return repo_access


# ── ACL helpers ──────────────────────────────────────────────────────────────

def _group_filter(groups: set[str]) -> dict:
    clauses = [{f"grp_{group}": True} for group in sorted(groups)]
    return clauses[0] if len(clauses) == 1 else {"$or": clauses}


def _acl_filter(
    groups: set[str],
    repo_access: dict[str, set[str]],
    repo: Optional[str],
) -> dict:
    filters = [
        {"$and": [{"source_type": "policy"}, _group_filter(groups)]}
    ]
    for repo_name, repo_groups in sorted(repo_access.items()):
        if repo and repo_name != repo:
            continue
        allowed_groups = groups & repo_groups
        if allowed_groups:
            filters.append({
                "$and": [{"repo": repo_name}, _group_filter(allowed_groups)]
            })
    return filters[0] if len(filters) == 1 else {"$or": filters}


def _chunk_allowed(
    chunk: Document,
    groups: set[str],
    repo: Optional[str],
    repo_access: dict[str, set[str]],
) -> bool:
    meta = chunk.metadata
    allowed_groups = set(meta.get("allowed_groups", "").split(","))
    if not groups & allowed_groups:
        return False
    chunk_repo = meta.get("repo")
    if chunk_repo:
        if repo and chunk_repo != repo:
            return False
        if not groups & repo_access.get(chunk_repo, set()):
            return False
    return True


# ── main retrieval ───────────────────────────────────────────────────────────

def hybrid_search(
    query: str,
    groups: set[str],
    k: int = 10,
    repo: Optional[str] = None,
    repo_access: Optional[dict[str, set[str]]] = None,
) -> List[Document]:
    """
    ACL-filtered hybrid retrieval.
    groups  — set of group names the user belongs to (from DB, not LLM)
    repo    — optional repo slug to scope retrieval further
    """
    if not groups:
        return []   # fail closed
    repo_access = repo_access or {}

    # ── vector side (Chroma filter) ──
    chroma_filter = _acl_filter(groups, repo_access, repo)
    vec = _vs.as_retriever(search_kwargs={"k": k, "filter": chroma_filter})
    vec_docs = vec.invoke(query)

    # ── BM25 side (in-memory filter) ──
    allowed = [
        c for c in _chunks
        if _chunk_allowed(c, groups, repo, repo_access)
    ]
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
