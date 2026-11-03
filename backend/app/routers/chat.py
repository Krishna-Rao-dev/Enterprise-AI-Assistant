"""
POST /api/chat          — main chat endpoint (SSE stream)
GET  /api/chat/history  — list threads for sidebar
GET  /api/chat/{thread_id}/messages — messages in a thread
"""

import uuid, time, hashlib
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_session, get_user, insert_audit
from app.db.mongo import append_message, get_history, list_threads
from app.rag.graph import run_rag

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    user_id:   str
    question:  str
    thread_id: Optional[str] = None   # None → new thread
    repo:      Optional[str] = None   # scope to a specific repo


async def _get_user_groups(user_id: str, session: AsyncSession) -> set:
    user = await get_user(session, user_id)
    if not user:
        raise HTTPException(status_code=403, detail="Unknown user")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User inactive")
    return set(user.groups)


@router.post("")
async def chat(req: ChatRequest, session: AsyncSession = Depends(get_session)):
    thread_id = req.thread_id or str(uuid.uuid4())
    groups    = await _get_user_groups(req.user_id, session)
    history   = await get_history(thread_id)

    start = time.time()

    # Run RAG graph (sync — wrap in threadpool for production)
    result = run_rag(
        question=req.question,
        user_id=req.user_id,
        groups=groups,
        history=history,
        thread_id=thread_id,
        repo=req.repo,
    )

    answer  = result["answer"]
    docs    = result.get("docs", [])
    sources = [
        {"doc_id": d.metadata["doc_id"],
         "title":  d.metadata.get("title", ""),
         "section": d.metadata.get("section", ""),
         "repo":   d.metadata.get("repo"),
         "version": d.metadata.get("version"),
         "status":  d.metadata.get("status")}
        for d in docs
    ]
    latency_ms = int((time.time() - start) * 1000)

    # Persist conversation to MongoDB
    await append_message(thread_id, "human",     req.question, req.user_id)
    await append_message(thread_id, "assistant", answer,       req.user_id)

    # Audit log to PostgreSQL
    await insert_audit(
        session=session,
        user_id=req.user_id,
        thread_id=thread_id,
        question=req.question,
        sources=[s["doc_id"] for s in sources],
        answer=answer,
        latency_ms=str(latency_ms),
    )

    return {
        "thread_id": thread_id,
        "answer":    answer,
        "sources":   sources,
        "latency_ms": latency_ms,
    }


@router.post("/stream")
async def chat_stream(req: ChatRequest, session: AsyncSession = Depends(get_session)):
    """
    SSE stream: yields events as the graph runs.
    event: step   — node name (retrieve / rerank / generate)
    event: token  — partial answer token
    event: sources
    event: done
    event: error
    """
    thread_id = req.thread_id or str(uuid.uuid4())
    groups    = await _get_user_groups(req.user_id, session)
    history   = await get_history(thread_id)

    async def event_gen():
        try:
            yield f"event: step\ndata: retrieve\n\n"
            from app.rag.retrieval import hybrid_search, rerank
            candidates = hybrid_search(req.question, groups, repo=req.repo)

            yield f"event: step\ndata: rerank\n\n"
            docs = rerank(req.question, candidates)

            yield f"event: step\ndata: generate\n\n"
            from app.rag.chain import chain, fmt_docs, fmt_history
            import json

            sources = [
                {"doc_id": d.metadata["doc_id"],
                 "title":  d.metadata.get("title", ""),
                 "section": d.metadata.get("section", ""),
                 "repo":   d.metadata.get("repo"),
                 "version": d.metadata.get("version"),
                 "status":  d.metadata.get("status")}
                for d in docs
            ]
            yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

            if not docs:
                answer = "I couldn't find anything you have access to on that topic."
                yield f"event: token\ndata: {answer}\n\n"
            else:
                answer_parts = []
                # Stream tokens from Groq
                async for chunk in chain.astream({
                    "context":  fmt_docs(docs),
                    "question": req.question,
                    "history":  fmt_history(history),
                }):
                    answer_parts.append(chunk)
                    yield f"event: token\ndata: {chunk}\n\n"
                answer = "".join(answer_parts)

            # Persist
            await append_message(thread_id, "human",     req.question, req.user_id)
            await append_message(thread_id, "assistant", answer,       req.user_id)
            await insert_audit(
                session=session,
                user_id=req.user_id,
                thread_id=thread_id,
                question=req.question,
                sources=[s["doc_id"] for s in sources],
                answer=answer,
                latency_ms="0",
            )

            yield f"event: done\ndata: {thread_id}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.get("/history")
async def chat_history(user_id: str):
    threads = await list_threads(user_id)
    return {"threads": threads}


@router.get("/{thread_id}/messages")
async def thread_messages(thread_id: str):
    messages = await get_history(thread_id, limit=100)
    return {"thread_id": thread_id, "messages": messages}
