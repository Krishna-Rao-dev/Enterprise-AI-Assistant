"""
LangGraph — RAG graph with conversational memory.

Nodes:  retrieve → rerank → generate
State carries:  question, user_id, groups, repo (optional),
                candidates, docs, answer, history
"""

from typing import TypedDict, List, Optional
from langchain_core.documents import Document
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.rag.retrieval import hybrid_search, rerank as rerank_docs
from app.rag.chain import chain, fmt_docs, fmt_history


class RAGState(TypedDict):
    question:   str
    user_id:    str
    groups:     set          # injected by the API layer, never from LLM
    repo:       Optional[str]
    history:    List[dict]   # [{role, content}] from MongoDB
    candidates: List[Document]
    docs:       List[Document]
    answer:     str


# ── nodes ────────────────────────────────────────────────────────────────────

def retrieve_node(s: RAGState) -> dict:
    return {"candidates": hybrid_search(
        s["question"], s["groups"], repo=s.get("repo")
    )}


def rerank_node(s: RAGState) -> dict:
    return {"docs": rerank_docs(s["question"], s["candidates"])}


def generate_node(s: RAGState) -> dict:
    if not s["docs"]:
        return {"answer": "I couldn't find anything you have access to on that topic."}
    answer = chain.invoke({
        "context":  fmt_docs(s["docs"]),
        "question": s["question"],
        "history":  fmt_history(s.get("history", [])),
    })
    return {"answer": answer}


# ── graph ────────────────────────────────────────────────────────────────────

_checkpointer = MemorySaver()

_g = StateGraph(RAGState)
_g.add_node("retrieve", retrieve_node)
_g.add_node("rerank",   rerank_node)
_g.add_node("generate", generate_node)
_g.add_edge(START,      "retrieve")
_g.add_edge("retrieve", "rerank")
_g.add_edge("rerank",   "generate")
_g.add_edge("generate", END)

rag_app = _g.compile(checkpointer=_checkpointer)


def run_rag(
    question: str,
    user_id: str,
    groups: set,
    history: List[dict],
    thread_id: str,
    repo: Optional[str] = None,
) -> dict:
    """
    Run the RAG graph synchronously.
    Returns the final State dict (access .answer and .docs).
    """
    config = {"configurable": {"thread_id": thread_id}}
    result = rag_app.invoke(
        {
            "question": question,
            "user_id":  user_id,
            "groups":   groups,
            "repo":     repo,
            "history":  history,
            "candidates": [],
            "docs":     [],
            "answer":   "",
        },
        config=config,
    )
    return result
