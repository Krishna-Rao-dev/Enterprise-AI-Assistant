"""
PostgreSQL via SQLAlchemy async.

Tables:
  users          — user profile + groups (source of truth for ACL)
  repo_access    — which groups can access which repo
  audit_log      — every query + sources returned (immutable append)
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, JSON,
    ForeignKey, UniqueConstraint, Index, text
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import PG_DSN

engine = create_async_engine(PG_DSN, echo=False, pool_pre_ping=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


# ── Models ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    user_id        = Column(String(64), primary_key=True)
    name           = Column(String(128), nullable=False)
    email          = Column(String(256), nullable=False, unique=True)
    title          = Column(String(128))
    department     = Column(String(64))
    employment_type = Column(String(32))
    location       = Column(String(64))
    manager_id     = Column(String(64), ForeignKey("users.user_id"), nullable=True)
    groups         = Column(JSON, nullable=False)   # list[str]
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime, default=datetime.utcnow)


class RepoAccess(Base):
    """Which groups can query a repo's documentation."""
    __tablename__ = "repo_access"
    __table_args__ = (UniqueConstraint("repo", "group_name"),)
    id         = Column(String(64), primary_key=True)   # uuid
    repo       = Column(String(128), nullable=False, index=True)
    group_name = Column(String(64), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id          = Column(String(64), primary_key=True)   # uuid
    user_id     = Column(String(64), nullable=False, index=True)
    thread_id   = Column(String(64), index=True)
    question    = Column(Text, nullable=False)
    sources     = Column(JSON)          # list of doc_id
    answer_hash = Column(String(64))    # sha256 of answer (no PII stored)
    latency_ms  = Column(String(16))
    created_at  = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_audit_created", "created_at"),)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as s:
        yield s


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_user(session: AsyncSession, user_id: str) -> Optional[User]:
    result = await session.get(User, user_id)
    return result


async def get_repo_groups(session: AsyncSession, repo: str) -> List[str]:
    """Return all groups that have access to this repo."""
    result = await session.execute(
        text("SELECT group_name FROM repo_access WHERE repo = :repo"),
        {"repo": repo}
    )
    return [row[0] for row in result.fetchall()]


async def insert_audit(session: AsyncSession, **kwargs):
    import uuid, hashlib
    log = AuditLog(
        id=str(uuid.uuid4()),
        answer_hash=hashlib.sha256(kwargs.pop("answer", "").encode()).hexdigest(),
        **kwargs
    )
    session.add(log)
    await session.commit()


async def seed_users_from_json(session: AsyncSession, path: str = "users.json"):
    """One-time seed: load users.json into the users table."""
    import json, uuid
    with open(path) as f:
        users = json.load(f)
    for u in users:
        existing = await session.get(User, u["user_id"])
        if existing:
            continue
        session.add(User(**{k: v for k, v in u.items() if k != "password"}))
    await session.commit()

## https://github.com/krishna345542-collab/test-repo
