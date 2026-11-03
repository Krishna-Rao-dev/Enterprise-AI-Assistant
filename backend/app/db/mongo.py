"""
MongoDB via motor (async).

Collections:
  chat_history   — messages per thread_id  (conversational memory)
  feedback       — thumbs up/down + wrong-answer reports
"""

from datetime import datetime
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import MONGO_URI, MONGO_DB

_client: Optional[AsyncIOMotorClient] = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[MONGO_DB]


# ── chat history ─────────────────────────────────────────────────────────────

async def append_message(thread_id: str, role: str, content: str, user_id: str):
    """Append one message to the thread's history."""
    db = get_db()
    await db.chat_history.update_one(
        {"thread_id": thread_id},
        {
            "$setOnInsert": {"user_id": user_id, "created_at": datetime.utcnow()},
            "$push": {
                "messages": {
                    "role": role,           # "human" | "assistant"
                    "content": content,
                    "ts": datetime.utcnow()
                }
            }
        },
        upsert=True
    )


async def get_history(thread_id: str, limit: int = 10) -> List[dict]:
    """Return last `limit` messages for a thread."""
    db = get_db()
    doc = await db.chat_history.find_one({"thread_id": thread_id})
    if not doc:
        return []
    return doc.get("messages", [])[-limit:]


async def list_threads(user_id: str) -> List[dict]:
    """Return all thread stubs for a user (for chat history sidebar)."""
    db = get_db()
    cursor = db.chat_history.find(
        {"user_id": user_id},
        {"_id": 0, "thread_id": 1, "created_at": 1, "messages": {"$slice": 1}}
    ).sort("created_at", -1)
    return await cursor.to_list(length=50)


# ── feedback ─────────────────────────────────────────────────────────────────

async def save_feedback(
    thread_id: str,
    user_id: str,
    message_index: int,
    rating: str,          # "up" | "down"
    report: Optional[str] = None   # wrong-answer free text
):
    db = get_db()
    await db.feedback.insert_one({
        "thread_id": thread_id,
        "user_id": user_id,
        "message_index": message_index,
        "rating": rating,
        "report": report,
        "created_at": datetime.utcnow()
    })
