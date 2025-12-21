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
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    credits = Column(Integer, default=10)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # Community feature
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
    
    # Relationships
    scans = relationship("Scan", back_populates="user")
    invoices = relationship("Invoice", back_populates="user")
    team = relationship("Team", back_populates="members")  # Community relation


class Team(Base):
    """Team model for Community feature"""
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    join_code = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    members = relationship("User", back_populates="team")
    posts = relationship("CommunityPost", back_populates="team")


class CommunityPost(Base):
    """Post model for Community Feed"""
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    scope = Column(String, default="GLOBAL") # INTERNAL atau GLOBAL
    
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    
    # Note: user_id disini kita simpan sebagai String (UUID) dari Supabase Auth
    # Kita tidak pakai ForeignKey ke users.id karena users.id tipenya Integer
    user_id = Column(String, nullable=False) 
    author_name = Column(String)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    team = relationship("Team", back_populates="posts")


class Scan(Base):
    """Scan/OCR model for dgtnz.wtf"""
    __tablename__ = "scans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)  # negative for usage, positive for refill
    action = Column(String(100), nullable=False)  # scan, invoice, refill, etc.
    reference_id = Column(Integer)  # ID of scan/invoice
    created_at = Column(DateTime(timezone=True), server_default=func.now())