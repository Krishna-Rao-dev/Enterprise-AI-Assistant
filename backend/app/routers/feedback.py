"""
POST /api/feedback   — thumbs up/down + wrong-answer report
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.mongo import get_history, save_feedback
from app.db.postgres import get_session, get_user

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    thread_id:     str
    user_id:       str
    message_index: int       # which assistant message (0-indexed)
    rating:        str       # "up" | "down"
    report:        Optional[str] = None   # wrong-answer free text


@router.post("")
async def submit_feedback(
    req: FeedbackRequest,
    session: AsyncSession = Depends(get_session),
):
    if req.rating not in ("up", "down"):
        raise HTTPException(400, "rating must be 'up' or 'down'")
    user = await get_user(session, req.user_id)
    if user is None or not user.is_active:
        raise HTTPException(403, "Unknown or inactive user")
    messages = await get_history(req.thread_id, req.user_id, limit=1000)
    if (
        req.message_index < 0
        or req.message_index >= len(messages)
        or messages[req.message_index].get("role") != "assistant"
    ):
        raise HTTPException(404, "Assistant message was not found")
    await save_feedback(
        thread_id=req.thread_id,
        user_id=req.user_id,
        message_index=req.message_index,
        rating=req.rating,
        report=req.report,
    )
    return {"status": "ok"}
