"""
File handling utilities
"""
import os
import uuid
from typing import Optional
from pathlib import Path
from fastapi import UploadFile, HTTPException
from config.settings import settings

class FileHandler:
    """Handle file uploads and storage"""
    
    @staticmethod
    def validate_file(file: UploadFile) -> None:
        """
        Validate uploaded file
        
        Args:
            file: Uploaded file
            
        Raises:
            HTTPException if validation fails
        """
        # Check file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )
    
    @staticmethod
    async def save_file(file: UploadFile, user_id: int) -> tuple[str, str]:
        """
        Save uploaded file to disk
        
        Args:
            file: Uploaded file
            user_id: User ID
            
        Returns:
            Tuple of (file_path, unique_filename)
        """
        # Validate file
        FileHandler.validate_file(file)
        
        # Create upload directory if not exists
        upload_dir = Path(settings.UPLOAD_DIR) / str(user_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = upload_dir / unique_filename
        
        # Save file
        content = await file.read()
        
        # Check file size
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {settings.MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        return str(file_path), unique_filename
    
    @staticmethod
    def delete_file(file_path: str) -> None:
        """
        Delete file from disk
        
        Args:
            file_path: Path to file
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error deleting file: {e}")
