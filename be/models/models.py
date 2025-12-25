"""
Database models using SQLAlchemy
Updated to include Teams and Community features
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base

class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    credits = Column(Integer, default=10)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
    
    # Relationships
    scans = relationship("Scan", back_populates="user")
    invoices = relationship("Invoice", back_populates="user")


class Scan(Base):
    """Scan/OCR model for dgtnz.wtf"""
    __tablename__ = "scans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    file_type = Column(String(50))
    
    # Digitization specific fields
    recipient_name = Column(String(255), nullable=True)
    signature_url = Column(String(500), nullable=True)
    imagekit_url = Column(String(500), nullable=True)
    
    # OCR Results
    extracted_text = Column(Text)
    confidence_score = Column(Float)
    processing_time = Column(Float)  # in seconds
    
    # Status
    status = Column(String(50), default='pending')  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="scans")


class Invoice(Base):
    """Invoice model for invoice.wtf"""
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    invoice_number = Column(String(100), unique=True, nullable=False)
    
    # Client Info
    client_name = Column(String(255), nullable=False)
    client_email = Column(String(255))
    client_address = Column(Text)
    
    # Invoice Details
    items = Column(Text)  # JSON string
    subtotal = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    
    # Dates
    issue_date = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    
    # Status
    status = Column(String(50), default='draft')  # draft, sent, paid, overdue, cancelled
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="invoices")


class CreditHistory(Base):
    """Credit usage history"""
    __tablename__ = "credit_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)  # negative for usage, positive for refill
    action = Column(String(100), nullable=False)  # scan, invoice, refill, etc.
    reference_id = Column(Integer)  # ID of scan/invoice
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PPTHistory(Base):
    """PPT generation history with PDF storage and 1-week expiration"""
    __tablename__ = "ppt_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # File info
    title = Column(String(500), nullable=False)
    pptx_filename = Column(String(500), nullable=False)
    pdf_filename = Column(String(500), nullable=False)
    pptx_url = Column(String(1000), nullable=False)
    pdf_url = Column(String(1000), nullable=False)
    
    # Metadata
    theme = Column(String(50), default="modern")
    prompt = Column(Text, nullable=True)
    script = Column(Text, nullable=True)  # AI Generated Speaker Notes
    
    # Expiration (1 week from creation)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
