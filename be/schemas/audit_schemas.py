"""
Audit.WTF Schemas - Data validation for invoice audit
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

# Enums
class AuditStatus(str, Enum):
    PASSED = "PASSED"
    WARNING = "WARNING"
    FAILED = "FAILED"

# Invoice Item
class InvoiceItem(BaseModel):
    name: str
    qty: float
    price: float
    total: float

# Extracted Data from Agent 1 (Vision)
class ExtractedInvoiceData(BaseModel):
    merchant: str
    date: str
    items: List[InvoiceItem]
    subtotal: float
    tax: float
    grandTotal: float
    npwp: Optional[str] = None

# Math Validation Result
class MathValidationResult(BaseModel):
    isValid: bool
    errors: List[str] = []
    
# AI Analysis from Agent 2 (Text)
class AIAnalysis(BaseModel):
    summary: str = Field(description="Short analysis (max 2 sentences)")
    riskScore: int = Field(ge=0, le=100, description="0=High Risk, 100=Safe")
    suspiciousItems: List[str] = []

# Final Audit Report
class AuditReport(BaseModel):
    status: AuditStatus
    score: int = Field(ge=0, le=100)
    findings: List[str]
    aiAnalysis: str
    extractedData: Optional[ExtractedInvoiceData] = None
    mathValidation: Optional[MathValidationResult] = None

# Request/Response
class AuditRequest(BaseModel):
    imageBase64: str = Field(description="Base64 encoded invoice image")

class AuditResponse(BaseModel):
    success: bool
    report: Optional[AuditReport] = None
    error: Optional[str] = None
