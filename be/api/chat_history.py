"""
Chat History API — session CRUD and message retrieval
All data stored in Supabase (zero VPS storage)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from models.models import User
from utils.auth import get_current_user, supabase_admin

router = APIRouter(
    prefix="/api/chatbot",
    tags=["chatbot-history"],
)


# ── Schemas ──────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    created_at: str


# ── Endpoints ────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(current_user: User = Depends(get_current_user)):
    """List all chat sessions for the current user, most recent first."""
    try:
        result = supabase_admin.table("chat_sessions") \
            .select("id, title, created_at, updated_at") \
            .eq("user_id", str(current_user.id)) \
            .order("updated_at", desc=True) \
            .limit(50) \
            .execute()
        return {"sessions": result.data or []}
    except Exception as e:
        print(f"Error fetching sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat sessions")


@router.post("/sessions")
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new chat session."""
    try:
        result = supabase_admin.table("chat_sessions").insert({
            "user_id": str(current_user.id),
            "title": body.title or "New Chat",
        }).execute()
        return {"session": result.data[0] if result.data else None}
    except Exception as e:
        print(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create session")


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get all messages for a specific session."""
    try:
        # Verify session belongs to user
        session = supabase_admin.table("chat_sessions") \
            .select("id") \
            .eq("id", session_id) \
            .eq("user_id", str(current_user.id)) \
            .single() \
            .execute()

        if not session.data:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get messages
        messages = supabase_admin.table("chat_messages") \
            .select("id, role, content, attachment_name, attachment_type, created_at") \
            .eq("session_id", session_id) \
            .order("created_at", desc=False) \
            .execute()

        return {"messages": messages.data or []}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a chat session and all its messages."""
    try:
        # Delete messages first (cascade should handle this, but be safe)
        supabase_admin.table("chat_messages") \
            .delete() \
            .eq("session_id", session_id) \
            .execute()

        # Delete session
        supabase_admin.table("chat_sessions") \
            .delete() \
            .eq("id", session_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()

        return {"status": "deleted"}
    except Exception as e:
        print(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete session")


@router.patch("/sessions/{session_id}")
async def update_session_title(
    session_id: str,
    body: SessionCreate,
    current_user: User = Depends(get_current_user),
):
    """Update a session's title."""
    try:
        result = supabase_admin.table("chat_sessions") \
            .update({"title": body.title}) \
            .eq("id", session_id) \
            .eq("user_id", str(current_user.id)) \
            .execute()
        return {"session": result.data[0] if result.data else None}
    except Exception as e:
        print(f"Error updating session: {e}")
        raise HTTPException(status_code=500, detail="Failed to update session")
