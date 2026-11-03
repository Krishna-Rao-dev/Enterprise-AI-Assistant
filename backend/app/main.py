"""
FastAPI entry point.
Run: uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.postgres import create_tables, seed_users_from_json
from app.db.postgres import AsyncSessionLocal
from app.rag.retrieval import init_retrieval
from app.routers import chat, feedback


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── startup ──
    await create_tables()
    async with AsyncSessionLocal() as session:
        await seed_users_from_json(session)   # idempotent
    init_retrieval()                          # loads ChromaDB + reranker
    yield
    # ── shutdown ──
    # (nothing to clean up for now)


app = FastAPI(
    title="Enterprise Knowledge Assistant",
    description="Permission-Aware RAG · Hybrid Search · ACL · LangGraph",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(feedback.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
