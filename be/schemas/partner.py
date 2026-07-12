from typing import Optional, List
from pydantic import BaseModel

class ApiKeyOut(BaseModel):
    key_value: str
    name: str
    is_active: bool
    created_at: str
    last_used_at: Optional[str] = None


class GenerateKeyRequest(BaseModel):
    key_type: Optional[str] = "individual"  # 'individual' or 'partner'


class DecisionApiKeyOut(BaseModel):
    key_value: str
    name: str
    partner_name: str
    is_active: bool
    created_at: str
    last_used_at: Optional[str] = None


class PhoneSyncRequest(BaseModel):
    phone_number: str  # 08xxxxxxxxxx


class PhoneSyncResponse(BaseModel):
    phone_number: str
    message: str = "Phone number saved successfully."


class PhoneAutoFillResponse(BaseModel):
    phone_number: str
    source: str
    message: str


class PlatformStats(BaseModel):
    total_scans: int
    fraud_prevented: int
    verified_scans: int
    integrity_rate: float  # percentage 0-100


class ScanSummary(BaseModel):
    scan_id: str
    status: str
    nominal_total: Optional[float] = None
    vendor_name: Optional[str] = None
    doc_type: Optional[str] = None
    created_at: str


class CycleInfo(BaseModel):
    current_cycle: int
    current_cycle_score: int
    cycle_max: int
    lifetime_score: int
    completed_cycles: int


class RiskDetail(BaseModel):
    risk_level: str
    risk_score: int
    factors: list[dict]


class ScoringResponse(BaseModel):
    email: str
    user_id: str
    trust_score: int
    risk_label: str          # "LOW" | "MEDIUM" | "HIGH"
    risk_detail: Optional[RiskDetail] = None
    cycle_info: Optional[CycleInfo] = None
    total_scans: int
    verified_scans: int
    tampered_scans: int
    total_nominal: float
    recent_scans: list[ScanSummary]
    credit_score_breakdown: Optional[dict] = None
    compliance: Optional[dict] = None
