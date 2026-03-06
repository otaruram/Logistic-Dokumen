from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import base64
import io

from config.database import get_db
from services.chatbot_service import ChatbotService
from models.models import User
from utils.auth import get_current_user

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
    extracted_text = None

    if file:
        # Ensure file type is supported
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

        contents = await file.read()

        if file.content_type.startswith("image/"):
            # Images → send as base64 image_url to GPT vision
            file_content_base64 = base64.b64encode(contents).decode("utf-8")
            file_mime_type = file.content_type
        elif file.content_type == "application/pdf":
            # PDF → extract text and send as text content
            extracted_text = extract_text_from_pdf(contents)
            if not extracted_text:
                extracted_text = "[PDF uploaded but text could not be extracted. The document may be scanned/image-based.]"
        elif "wordprocessingml" in (file.content_type or ""):
            # DOCX → extract text and send as text content
            extracted_text = extract_text_from_docx(contents)
            if not extracted_text:
                extracted_text = "[DOCX uploaded but text could not be extracted.]"

    try:
        response = await chatbot_service.get_completion(
            prompt=prompt,
            file_base64=file_content_base64,
            file_mime_type=file_mime_type,
            extracted_text=extracted_text,
            filename=file.filename if file else None,
        )
        return {"response": response}
    except Exception as e:
        print(f"Error calling chatbot service: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while communicating with the AI service.",
        )
