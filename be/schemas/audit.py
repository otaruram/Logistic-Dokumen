from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class KycIdentity(BaseModel):
    """KYC identity data from profiles table — KTP-based verification."""
    full_name: Optional[str] = None
    nik: Optional[str] = None
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    rt_rw: Optional[str] = None
    kelurahan: Optional[str] = None
    kecamatan: Optional[str] = None
    religion: Optional[str] = None
    marital_status: Optional[str] = None
    occupation: Optional[str] = None
    nationality: Optional[str] = None
    ktp_photo_url: Optional[str] = None
    selfie_photo_url: Optional[str] = None
    kyc_verified: bool = False
    kyc_submitted_at: Optional[str] = None


class CreditScoreInfo(BaseModel):
    current_cycle: int
    current_cycle_score: int
    cycle_max: int
    lifetime_score: int
    completed_cycles: int


class FinancialCreditScore(BaseModel):
    final_score: int
    grade: str
    formula: str
    components: dict
    metrics: dict
    grade_ranges: list[dict]


class RiskInfo(BaseModel):
    risk_level: str
    risk_score: int
    factors: list[dict]


class PeriodSummary(BaseModel):
    count: int
    nominal: float


class TransactionInfo(BaseModel):
    total: int
    verified: int
    tampered: int
    processing: int
    total_nominal: float
    by_period: dict[str, PeriodSummary]


class IntegrityInfo(BaseModel):
    total_sealed: int
    verified_seals: int
    tampered_seals: int
    unsealed: int
    integrity_rate: float


class AuditLogEntry(BaseModel):
    scan_id: str
    status: str
    nominal: float
    doc_type: Optional[str] = None
    vendor_name: Optional[str] = None
    created_at: str
    integrity_status: str


class LoanHistoryEntry(BaseModel):
    id: str
    nik: str
    nominal_pengajuan: int
    image_url: Optional[str] = None
    status: str
    ai_indicator: Optional[str] = None
    sha256_hash: Optional[str] = None
    submitted_at: Optional[str] = None
    reviewed_at: Optional[str] = None
    # SOP enrichment
    tenor_bulan: Optional[int] = None
    cicilan_sistem: Optional[int] = None
    dsr_status: Optional[str] = None
    no_referensi: Optional[str] = None


class DsrHealth(BaseModel):
    cicilan_aktif_total: int
    dsr_limit: int
    dsr_pct: float  # percentage of DSR limit used
    status: str  # 'AMAN' | 'OVER'


class UserInfo(BaseModel):
    email: str
    user_id: str


class AuditResponse(BaseModel):
    user: UserInfo
    identity: Optional[KycIdentity] = None
    credit_score: CreditScoreInfo
    financial_credit_score: Optional[FinancialCreditScore] = None
    risk: RiskInfo
    transactions: TransactionInfo
    integrity: IntegrityInfo
    audit_log: list[AuditLogEntry]
    loan_history: list[LoanHistoryEntry] = []
    # SOP additions
    dsr_health: Optional[DsrHealth] = None
    fraud_flags: int = 0
