from fastapi import HTTPException, Header

def calculate_otaru_index(user_id: str) -> dict:
    """Fallback dummy for removed finance logic"""
    return {
        "integrity_level": "A",
        "credit_grade": "A",
        "otaru_index": 850,
        "dsr_percent": 25.0,
        "tampered_attempts": 0,
        "salary_source": "manual",
        "cicilan_aktif_total": 0,
        "sisa_plafon_aman": 5000000,
    }

def verify_partner_api_key(x_api_key: str = Header(..., alias="x-api-key")) -> dict:
    from utils.api_key import validate_api_key
    return validate_api_key(x_api_key)

def resolve_user_id_by_chat(chat_id: int) -> str | None:
    from services.telegram_service import get_link_by_chat_id
    link = get_link_by_chat_id(chat_id)
    if link:
        return link["user_id"]
    return None
