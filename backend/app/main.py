"""
FastAPI entry point.
Run: uvicorn app.main:app --reload
"""

import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.postgres import (
    create_tables, seed_users_from_json, sync_repo_access_from_index,
)
from app.db.postgres import AsyncSessionLocal, engine
from app.db.mongo import ensure_indexes, get_client
from app.config import ALLOWED_ORIGINS, PG_DSN
from app.rag.graph import close_checkpointer, initialize_checkpointer
from app.rag.retrieval import init_retrieval
from app.routers import chat, feedback


@asynccontextmanager
async def lifespan(app: FastAPI):
    if sys.version_info < (3, 11):
        raise RuntimeError("The backend requires Python 3.11 or newer.")

    # ── startup ──
    await create_tables()
    await ensure_indexes()
    async with AsyncSessionLocal() as session:
        await seed_users_from_json(session)   # idempotent
    repo_access = init_retrieval()
    await sync_repo_access_from_index(repo_access)
    await initialize_checkpointer(PG_DSN)
    try:
        yield
    finally:
        await close_checkpointer()
        get_client().close()
        await engine.dispose()


app = FastAPI(
    title="Enterprise Knowledge Assistant",
    description="Permission-Aware RAG · Hybrid Search · ACL · LangGraph",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(feedback.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
