import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.mongo import append_message, get_history, list_threads
from app.db.postgres import (
    AsyncSessionLocal,
    PendingAction,
    claim_pending_action,
    get_pending_action,
    get_repo_access_map,
    get_session,
    get_user,
    has_pending_action,
    insert_audit,
)
from app.rag import graph

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    question: str = Field(min_length=1, max_length=8000)
    thread_id: Optional[str] = Field(default=None, max_length=64)
    repo: Optional[str] = Field(default=None, max_length=128)


class ResumeRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    approval_id: str = Field(min_length=1, max_length=64)
    decision: Literal["approve", "reject"]
    args: Optional[dict[str, Any]] = None


def _sse(event: str, data: Any) -> str:
    if isinstance(data, str):
        body = "\n".join(f"data: {line}" for line in data.splitlines() or [""])
    else:
        body = f"data: {json.dumps(data, separators=(',', ':'))}"
    return f"event: {event}\n{body}\n\n"


async def _get_user_groups(user_id: str, session: AsyncSession) -> set[str]:
    user = await get_user(session, user_id)
    if not user:
        raise HTTPException(status_code=403, detail="Unknown user")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User inactive")
    return set(user.groups)


async def _stream_graph(
    question: str,
    user_id: str,
    thread_id: str,
    groups: set[str],
    history: list[dict],
    repo: Optional[str],
    repo_access: dict[str, set[str]],
    approval_id: Optional[str] = None,
    resume: Optional[dict[str, Any]] = None,
):
    config = {"configurable": {"thread_id": thread_id}}
    if resume is not None:
        from langgraph.types import Command
        input_value: Any = Command(resume=resume)
    else:
        input_value = {
            "question": question,
            "user_id": user_id,
            "groups": groups,
            "repo": repo,
            "repo_access": repo_access,
            "history": history,
            "thread_id": thread_id,
            "approval_id": approval_id or str(uuid.uuid4()),
            "route": graph.RouteDecision(intent="rag"),
            "candidates": [],
            "docs": [],
            "answer": "",
            "sources": [],
            "action_result": None,
        }

    answer = ""
    token_text = ""
    sources: list[dict[str, Any]] = []
    action_result: Optional[dict[str, Any]] = None
    interrupted: Optional[dict[str, Any]] = None
    route = None
    node_labels = {
        "router": "classify",
        "retrieve": "retrieve",
        "rerank": "rerank",
        "generate": "generate",
        "execute_action": "execute action",
    }

    async for namespace, mode, payload in graph.rag_app.astream(
        input_value,
        config=config,
        stream_mode=["messages", "updates"],
        subgraphs=True,
    ):
        if mode == "messages":
            message, metadata = payload
            if metadata.get("langgraph_node") == "generate":
                content = message.content
                if isinstance(content, str) and content:
                    token_text += content
                    yield _sse("token", content), None
            continue

        for node, update in payload.items():
            if not namespace and node == "rag":
                continue
            if node == "__interrupt__":
                interrupt_value = update[0].value
                interrupted = interrupt_value
                yield _sse("interrupt", interrupt_value), None
                continue
            if node in node_labels:
                yield _sse("step", node_labels[node]), None
            if isinstance(update, dict):
                if "route" in update:
                    route = update["route"]
                if "sources" in update:
                    sources = update["sources"]
                    yield _sse("sources", sources), None
                if "answer" in update:
                    answer = update["answer"]
                if "action_result" in update:
                    action_result = update["action_result"]

    if answer and not token_text:
        yield _sse("token", answer), None
    if action_result is not None:
        yield _sse("result", action_result), None
    result = {
        "answer": answer,
        "sources": sources,
        "action_result": action_result,
        "interrupt": interrupted,
        "route": route,
    }
    yield None, result


def _interrupts(result: dict[str, Any]) -> list[Any]:
    if result.get("interrupt"):
        return [result["interrupt"]]
    values = result.get("__interrupt__", ())
    return [item.value for item in values]


def _sources(result: dict[str, Any]) -> list[dict[str, Any]]:
    return result.get("sources", [])


async def _audit(
    session: AsyncSession,
    user_id: str,
    thread_id: str,
    question: str,
    result: dict[str, Any],
    latency_ms: int,
    action_record: Optional[dict[str, Any]] = None,
) -> None:
    interrupted = _interrupts(result)
    action_result = result.get("action_result")
    route = result.get("route")
    await insert_audit(
        session=session,
        user_id=user_id,
        thread_id=thread_id,
        question=question,
        sources=[item["doc_id"] for item in _sources(result)],
        answer=result.get("answer", ""),
        latency_ms=str(latency_ms),
        action=action_record or (
            {"intent": route.intent}
            if route and route.intent != "rag" else None
        ),
        outcome=(
            "awaiting_approval" if interrupted
            else action_result.get("status", "completed") if action_result
            else "completed"
        ),
    )


@router.post("")
async def chat(req: ChatRequest, session: AsyncSession = Depends(get_session)):
    thread_id = req.thread_id or str(uuid.uuid4())
    groups = await _get_user_groups(req.user_id, session)
    if await has_pending_action(req.user_id, thread_id):
        raise HTTPException(
            status_code=409,
            detail="Resolve or dismiss the pending approval before continuing this thread.",
        )
    repo_access = await get_repo_access_map(session)
    history = await get_history(thread_id, req.user_id)
    start = time.perf_counter()
    result = await graph.run_rag(
        question=req.question,
        user_id=req.user_id,
        groups=groups,
        history=history,
        thread_id=thread_id,
        repo=req.repo,
        repo_access=repo_access,
    )
    answer = result.get("answer", "")
    interrupt_values = _interrupts(result)
    if interrupt_values:
        await append_message(thread_id, "human", req.question, req.user_id)
        await append_message(
            thread_id, "assistant", "This action is waiting for your approval.",
            req.user_id,
        )
    else:
        await append_message(thread_id, "human", req.question, req.user_id)
        await append_message(thread_id, "assistant", answer, req.user_id)
    latency_ms = int((time.perf_counter() - start) * 1000)
    await _audit(session, req.user_id, thread_id, req.question, result, latency_ms)
    return {
        "thread_id": thread_id,
        "answer": answer,
        "sources": _sources(result),
        "approval": interrupt_values[0] if interrupt_values else None,
        "action_result": result.get("action_result"),
        "latency_ms": latency_ms,
    }


@router.post("/stream")
async def chat_stream(req: ChatRequest, session: AsyncSession = Depends(get_session)):
    thread_id = req.thread_id or str(uuid.uuid4())
    groups = await _get_user_groups(req.user_id, session)
    if await has_pending_action(req.user_id, thread_id):
        raise HTTPException(
            status_code=409,
            detail="Resolve or dismiss the pending approval before continuing this thread.",
        )
    repo_access = await get_repo_access_map(session)
    history = await get_history(thread_id, req.user_id)

    async def event_gen():
        start = time.perf_counter()
        try:
            await append_message(thread_id, "human", req.question, req.user_id)
            stream = _stream_graph(
                question=req.question,
                user_id=req.user_id,
                thread_id=thread_id,
                groups=groups,
                history=history,
                repo=req.repo,
                repo_access=repo_access,
            )
            result = None
            while True:
                try:
                    event, result = await anext(stream)
                except StopAsyncIteration as stop:
                    raise RuntimeError("Graph stream ended without a final result") from stop
                if event is not None:
                    yield event
                if result is not None:
                    break
            if result["interrupt"]:
                assistant_text = "This action is waiting for your approval."
            else:
                assistant_text = result["answer"]
            await append_message(
                thread_id, "assistant", assistant_text, req.user_id
            )
            await _audit(
                session,
                req.user_id,
                thread_id,
                req.question,
                result,
                int((time.perf_counter() - start) * 1000),
            )
            yield _sse("done", {"thread_id": thread_id})
        except Exception:
            logger.exception("Streaming chat failed for thread %s", thread_id)
            yield _sse("error", {"message": "The request could not be completed."})

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{thread_id}/resume")
async def resume_chat(
    thread_id: str,
    req: ResumeRequest,
    session: AsyncSession = Depends(get_session),
):
    groups = await _get_user_groups(req.user_id, session)
    pending = await get_pending_action(req.approval_id, req.user_id, thread_id)
    if pending is None:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if pending.status != "pending":
        raise HTTPException(status_code=409, detail="Approval request is no longer active")
    expired = pending.expires_at <= datetime.utcnow()
    if expired and req.decision == "approve":
        raise HTTPException(status_code=409, detail="Approval request has expired")

    if req.decision == "approve":
        from app.rag.graph import validate_approved_arguments
        try:
            arguments = validate_approved_arguments(
                pending.action,
                req.args or pending.arguments,
                req.user_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        next_status = "approved"
    else:
        arguments = pending.arguments
        next_status = "resuming"

    claimed = await claim_pending_action(
        req.approval_id,
        req.user_id,
        thread_id,
        next_status,
        arguments,
        allow_expired=expired and req.decision == "reject",
    )
    if not claimed:
        raise HTTPException(status_code=409, detail="Approval request is no longer active")

    async def event_gen():
        start = time.perf_counter()
        try:
            stream = _stream_graph(
                question="",
                user_id=req.user_id,
                thread_id=thread_id,
                groups=groups,
                history=[],
                repo=None,
                repo_access={},
                resume={"decision": req.decision, "args": arguments},
            )
            result = None
            while True:
                try:
                    event, final_result = await anext(stream)
                except StopAsyncIteration as stop:
                    raise RuntimeError("Graph stream ended without a final result") from stop
                if event is not None:
                    yield event
                if final_result is not None:
                    result = final_result
                    break
            answer = result.get("answer", "")
            await append_message(thread_id, "assistant", answer, req.user_id)
            await _audit(
                session,
                req.user_id,
                thread_id,
                f"Approved action: {pending.action}",
                result,
                int((time.perf_counter() - start) * 1000),
                action_record={"tool": pending.action},
            )
            yield _sse("done", {"thread_id": thread_id})
        except Exception:
            logger.exception("Approval resume failed for thread %s", thread_id)
            await _mark_action_failed(req.approval_id)
            yield _sse("error", {"message": "The approved action could not be completed."})

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _mark_action_failed(approval_id: str) -> None:
    from app.db.postgres import set_pending_action_status
    try:
        await set_pending_action_status(approval_id, "failed")
    except RuntimeError:
        logger.exception("Could not update failed approval status %s", approval_id)


@router.get("/history")
async def chat_history(user_id: str, session: AsyncSession = Depends(get_session)):
    await _get_user_groups(user_id, session)
    threads = await list_threads(user_id)
    return {"threads": threads}


@router.get("/{thread_id}/messages")
async def thread_messages(
    thread_id: str,
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    await _get_user_groups(user_id, session)
    messages = await get_history(thread_id, user_id, limit=100)
    if not messages:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"thread_id": thread_id, "messages": messages}


@router.get("/{thread_id}/pending")
async def thread_pending_actions(
    thread_id: str,
    user_id: str,
    session: AsyncSession = Depends(get_session),
):
    await _get_user_groups(user_id, session)
    async with AsyncSessionLocal() as action_session:
        rows = await action_session.execute(
            select(PendingAction).where(
                PendingAction.thread_id == thread_id,
                PendingAction.user_id == user_id,
                PendingAction.status == "pending",
            )
        )
        result = rows.scalars().all()
    return {
        "approvals": [
            {
                "approval_id": item.approval_id,
                "action": item.action,
                "args": item.arguments,
                "expires_at": f"{item.expires_at.isoformat()}Z",
                "status": "expired" if item.expires_at <= datetime.utcnow() else "pending",
            }
            for item in result
        ]
    }
