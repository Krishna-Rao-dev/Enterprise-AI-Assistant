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
    Column, String, Text, Boolean, Date, DateTime, Integer, JSON,
    ForeignKey, UniqueConstraint, Index, text, select, update
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
    action      = Column(JSON)
    outcome     = Column(String(32))
    created_at  = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_audit_created", "created_at"),)


class PendingAction(Base):
    __tablename__ = "pending_actions"
    approval_id = Column(String(64), primary_key=True)
    thread_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.user_id"), nullable=False, index=True)
    action = Column(String(64), nullable=False)
    arguments = Column(JSON, nullable=False)
    status = Column(String(16), nullable=False, default="pending", index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    user_id = Column(String(64), ForeignKey("users.user_id"), primary_key=True)
    annual_days = Column(Integer, nullable=False, default=20)
    used_days = Column(Integer, nullable=False, default=0)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    request_id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.user_id"), nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="submitted")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as s:
        yield s


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action JSON")
        )
        await conn.execute(
            text("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS outcome VARCHAR(32)")
        )


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


async def get_repo_access_map(session: AsyncSession) -> dict[str, set[str]]:
    result = await session.execute(select(RepoAccess.repo, RepoAccess.group_name))
    access: dict[str, set[str]] = {}
    for repo, group_name in result:
        access.setdefault(repo, set()).add(group_name)
    return access


async def sync_repo_access_from_index(repo_access: dict[str, set[str]]) -> None:
    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(RepoAccess.id).limit(1))
        if existing.scalar_one_or_none() is not None:
            return
        import uuid

        for repo, groups in repo_access.items():
            for group_name in sorted(groups):
                session.add(
                    RepoAccess(
                        id=str(uuid.uuid4()),
                        repo=repo,
                        group_name=group_name,
                    )
                )
        await session.commit()


async def create_pending_action(
    approval_id: str,
    thread_id: str,
    user_id: str,
    action: str,
    arguments: dict,
    expires_at: datetime,
) -> None:
    async with AsyncSessionLocal() as session:
        if await session.get(PendingAction, approval_id) is None:
            session.add(PendingAction(
                approval_id=approval_id,
                thread_id=thread_id,
                user_id=user_id,
                action=action,
                arguments=arguments,
                status="pending",
                expires_at=expires_at,
            ))
            await session.commit()


async def get_pending_action(
    approval_id: str, user_id: str, thread_id: str
) -> Optional[PendingAction]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(PendingAction).where(
                PendingAction.approval_id == approval_id,
                PendingAction.user_id == user_id,
                PendingAction.thread_id == thread_id,
            )
        )
        return result.scalar_one_or_none()


async def has_pending_action(user_id: str, thread_id: str) -> bool:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(PendingAction.approval_id).where(
                PendingAction.user_id == user_id,
                PendingAction.thread_id == thread_id,
                PendingAction.status.in_(
                    ("pending", "approved", "resuming", "executing")
                ),
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None


async def claim_pending_action(
    approval_id: str,
    user_id: str,
    thread_id: str,
    status: str,
    arguments: dict,
    allow_expired: bool = False,
) -> bool:
    async with AsyncSessionLocal() as session:
        criteria = [
            PendingAction.approval_id == approval_id,
            PendingAction.user_id == user_id,
            PendingAction.thread_id == thread_id,
            PendingAction.status == "pending",
        ]
        if not allow_expired:
            criteria.append(PendingAction.expires_at > datetime.utcnow())
        result = await session.execute(
            update(PendingAction)
            .where(*criteria)
            .values(status=status, arguments=arguments)
        )
        await session.commit()
        return result.rowcount == 1


async def set_pending_action_status(approval_id: str, status: str) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            update(PendingAction)
            .where(
                PendingAction.approval_id == approval_id,
                PendingAction.status.in_(("pending", "approved", "resuming", "executing")),
            )
            .values(status=status)
        )
        if result.rowcount != 1:
            current = await session.get(PendingAction, approval_id)
            if current is None or current.status != status:
                raise RuntimeError(f"Pending action {approval_id} is not active")
        await session.commit()


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
    import json
    with open(path) as f:
        users = json.load(f)
    for u in users:
        existing = await session.get(User, u["user_id"])
        if existing:
            continue
        session.add(User(**{k: v for k, v in u.items() if k != "password"}))
    await session.commit()
    for user in users:
        if await session.get(LeaveBalance, user["user_id"]) is None:
            annual_days = 0 if user.get("employment_type") == "contractor" else 20
            session.add(LeaveBalance(
                user_id=user["user_id"],
                annual_days=annual_days,
                used_days=0,
            ))
    await session.commit()

## https://github.com/krishna345542-collab/test-repo
