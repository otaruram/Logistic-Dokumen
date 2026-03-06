from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import base64
import mimetypes

from ..config.database import get_db
from ..services.chatbot_service import ChatbotService
from ..schemas.schemas import User
from ..utils.auth import get_current_user

router = APIRouter(
    prefix="/api/chatbot",
    tags=["chatbot"],
    responses={404: {"description": "Not found"}},
)

@router.post("/chat")
async def handle_chat_completion(
    prompt: str = Form(...),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Handles chat completions with the Otaru bot.
    Accepts a prompt and an optional file upload.
    """
    chatbot_service = ChatbotService(db=db, user=current_user)
    
    file_content_base64 = None
    file_mime_type = None

    if file:
        # Ensure file type is supported
        allowed_types = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"File type {file.content_type} not supported.")
        
        # Read file and encode to base64
        contents = await file.read()
        file_content_base64 = base64.b64encode(contents).decode('utf-8')
        file_mime_type = file.content_type

    try:
        response = await chatbot_service.get_completion(
            prompt=prompt,
            file_base64=file_content_base64,
            file_mime_type=file_mime_type
        )
        return {"response": response}
    except Exception as e:
        # Log the exception e
        print(f"Error calling chatbot service: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while communicating with the AI service.")
