"""
POST /api/feedback   — thumbs up/down + wrong-answer report
"""

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.db.mongo import save_feedback

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    thread_id:     str
    user_id:       str
    message_index: int       # which assistant message (0-indexed)
    rating:        str       # "up" | "down"
    report:        Optional[str] = None   # wrong-answer free text


@router.post("")
async def submit_feedback(req: FeedbackRequest):
    if req.rating not in ("up", "down"):
        from fastapi import HTTPException
        raise HTTPException(400, "rating must be 'up' or 'down'")
    await save_feedback(
        thread_id=req.thread_id,
        user_id=req.user_id,
        message_index=req.message_index,
        rating=req.rating,
        report=req.report,
    )
    return {"status": "ok"}
