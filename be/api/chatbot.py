"""
Chatbot API — handles chat completions with session persistence
Files are processed in memory only — zero VPS storage
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import base64
import io

from config.database import get_db
from services.chatbot_service import ChatbotService
from models.models import User
from utils.auth import get_current_user, supabase_admin

router = APIRouter(
    prefix="/api/chatbot",
    tags=["chatbot"],
    responses={404: {"description": "Not found"}},
)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX file."""
    try:
        import zipfile
        import xml.etree.ElementTree as ET

        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            with z.open('word/document.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                paragraphs = root.findall('.//w:p', ns)
                text = ""
                for p in paragraphs:
                    texts = p.findall('.//w:t', ns)
                    line = ''.join(t.text for t in texts if t.text)
                    if line:
                        text += line + "\n"
                return text.strip()
    except Exception as e:
        print(f"Error extracting DOCX text: {e}")
        return ""


def _save_message(session_id: str, role: str, content: str,
                  attachment_name: str = None, attachment_type: str = None):
    """Save a chat message to Supabase. Silently fails if DB is unavailable."""
    try:
        if not supabase_admin or not session_id:
            return
        data = {
            "session_id": session_id,
            "role": role,
            "content": content,
        }
        if attachment_name:
            data["attachment_name"] = attachment_name
        if attachment_type:
            data["attachment_type"] = attachment_type
        supabase_admin.table("chat_messages").insert(data).execute()
    except Exception as e:
        print(f"⚠️ Failed to save message: {e}")


def _auto_title_session(session_id: str, user_id: str, prompt: str):
    """Auto-generate session title from the first user message."""
    try:
        if not supabase_admin or not session_id:
            return
        # Only update if title is still "New Chat"
        session = supabase_admin.table("chat_sessions") \
            .select("title") \
            .eq("id", session_id) \
            .eq("user_id", user_id) \
            .single() \
            .execute()

        if session.data and session.data.get("title") == "New Chat":
            # Use first 50 chars of prompt as title
            title = prompt[:50].strip()
            if len(prompt) > 50:
                title += "..."
            supabase_admin.table("chat_sessions") \
                .update({"title": title, "updated_at": "now()"}) \
                .eq("id", session_id) \
                .execute()
        else:
            # Just update the timestamp
            supabase_admin.table("chat_sessions") \
                .update({"updated_at": "now()"}) \
                .eq("id", session_id) \
                .execute()
    except Exception as e:
        print(f"⚠️ Failed to update session title: {e}")


@router.post("/chat")
async def handle_chat_completion(
    prompt: str = Form(...),
    session_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Handles chat completions with the Otaru bot.
    - Accepts a prompt, optional session_id, and optional file upload.
    - Files are processed in memory only (zero VPS storage).
    - Messages are persisted to Supabase if session_id is provided.
    """
    chatbot_service = ChatbotService(db=db, user=current_user)

    file_content_base64 = None
    file_mime_type = None
    extracted_text = None
    attachment_name = None
    attachment_type = None

    if file:
        allowed_types = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, detail=f"File type {file.content_type} not supported."
            )

        attachment_name = file.filename
        attachment_type = file.content_type
        contents = await file.read()

        if file.content_type.startswith("image/"):
            file_content_base64 = base64.b64encode(contents).decode("utf-8")
            file_mime_type = file.content_type
        elif file.content_type == "application/pdf":
            extracted_text = extract_text_from_pdf(contents)
            if not extracted_text:
                extracted_text = "[PDF uploaded but text could not be extracted.]"
        elif "wordprocessingml" in (file.content_type or ""):
            extracted_text = extract_text_from_docx(contents)
            if not extracted_text:
                extracted_text = "[DOCX uploaded but text could not be extracted.]"

        # File bytes are NOT stored — they get garbage collected after this scope

    # Save user message to DB
    if session_id:
        _save_message(session_id, "user", prompt, attachment_name, attachment_type)
        _auto_title_session(session_id, str(current_user.id), prompt)

    try:
        response = await chatbot_service.get_completion(
            prompt=prompt,
            file_base64=file_content_base64,
            file_mime_type=file_mime_type,
            extracted_text=extracted_text,
            filename=file.filename if file else None,
        )

        # Save bot response to DB
        if session_id:
            _save_message(session_id, "bot", response)

        return {"response": response, "session_id": session_id}
    except Exception as e:
        print(f"Error calling chatbot service: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while communicating with the AI service.",
        )
