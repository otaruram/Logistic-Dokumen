from typing import Optional
from pydantic import BaseModel

class ProcessDocumentRequest(BaseModel):
    image_url: str
    telegram_chat_id: Optional[int] = None
    tenor_bulan: Optional[int] = None
    no_referensi: Optional[str] = None


class ProcessDocumentResponse(BaseModel):
    success: bool
    loan_id: Optional[str] = None
    nik: Optional[str] = None
    nominal_pengajuan: Optional[int] = None
    tenor_bulan: Optional[int] = None
    cicilan_sistem: Optional[int] = None
    dsr_status: Optional[str] = None
    ai_indicator: str
    status: str
    message: str


class ComponentCoords(BaseModel):
    x: float
    y: float
    rotation: float = 0.0  # degrees, clockwise


class StampCoords(BaseModel):
    materai: Optional[ComponentCoords] = None
    ttd: Optional[ComponentCoords] = None
    stamp: Optional[ComponentCoords] = None


class ApproveLoanRequest(BaseModel):
    loan_id: str
    admin_signature: str
    stamp_applied: bool = False
    stamp_style: str = "classic"
    stamp_color: str = "red"
    stamp_name: str = "KOPERASI MITRA SEJAHTERA"
    coords: Optional[StampCoords] = None


class ApproveLoanResponse(BaseModel):
    success: bool
    loan_id: str
    sha256_hash: str
    message: str


class RejectLoanRequest(BaseModel):
    loan_id: str
    reason: str = ""


class RevisionLoanRequest(BaseModel):
    loan_id: str
    notes: str


class PreviewStampRequest(BaseModel):
    loan_id: str
    admin_signature: Optional[str] = None
    stamp_applied: bool = True
    stamp_color: str = "red"
    stamp_name: str = "KOPERASI MITRA SEJAHTERA"
    coords: Optional[StampCoords] = None


class PreviewStampResponse(BaseModel):
    image_b64: str
    orig_w: int
    orig_h: int
    preview_w: int
    preview_h: int
    scale: float
    default_coords: dict
    nominal: int


class AiRecommendationRequest(BaseModel):
    loan_id: str
