"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    credits: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Scan Schemas
class ScanCreate(BaseModel):
    filename: str

class ScanResponse(BaseModel):
    id: int
    user_id: int
    original_filename: str
    extracted_text: Optional[str] = None
    confidence_score: Optional[float] = None
    processing_time: Optional[float] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Review Schemas
class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = None

class ReviewResponse(BaseModel):
    id: int
    user_name: str
    rating: int
    feedback: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Team Schemas (Community Feature)
class TeamCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)

class TeamJoin(BaseModel):
    join_code: str = Field(min_length=5, max_length=50)

class TeamResponse(BaseModel):
    id: int
    name: str
    join_code: str
    created_at: datetime
    member_count: Optional[int] = 0
    
    class Config:
        from_attributes = True

# Community Post Schemas
class PostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    scope: str = Field(pattern="^(INTERNAL|GLOBAL)$")  # INTERNAL or GLOBAL
    author_role: Optional[str] = None

class PostResponse(BaseModel):
    id: int
    content: str
    scope: str
    team_id: Optional[int] = None
    user_id: str
    author_name: str
    author_role: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Invoice Schemas
class InvoiceItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    amount: float

class InvoiceCreate(BaseModel):
    client_name: str
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    items: List[InvoiceItem]
    tax: float = 0.0
    issue_date: datetime
    due_date: datetime

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    client_name: str
    subtotal: float
    tax: float
    total: float
    status: str
    issue_date: datetime
    due_date: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# Token Schema
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None
