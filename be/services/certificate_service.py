import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from services.pdf_service import generate_integrity_certificate

def issue_integrity_certificate(
    sb,
    user_id: str,
    badge_tier: str,
    month_year: str,
    verified_count: int,
    otaru_index: int,
) -> tuple[str, bytes]:
    """
    Generate an integrity certificate PDF, store the verification hash in DB, and return (hash, pdf_bytes).
    """
    # 1. Generate unique hash based on user, month, and timestamp
    timestamp = datetime.now(timezone.utc).isoformat()
    raw_str = f"{user_id}:{badge_tier}:{month_year}:{timestamp}"
    verification_hash = hashlib.sha256(raw_str.encode()).hexdigest()

    # 2. Get user info
    prof_res = sb.table("profiles").select("full_name, nik").eq("id", user_id).limit(1).execute()
    prof_rows = getattr(prof_res, "data", None) or []
    if not prof_rows:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    full_name = prof_rows[0].get("full_name") or "Unknown User"
    nik = prof_rows[0].get("nik") or "0000000000000000"

    # 3. Generate PDF
    pdf_bytes = generate_integrity_certificate(
        full_name=full_name,
        nik=nik,
        badge_tier=badge_tier,
        month_year=month_year,
        verified_count=verified_count,
        otaru_index=otaru_index,
        verification_hash=verification_hash,
    )

    # 4. Store in database for verification (if the schema exists)
    try:
        sb.table("certificate_verifications").insert({
            "user_id": user_id,
            "verification_hash": verification_hash,
            "badge_tier": badge_tier,
            "month_year": month_year,
            "otaru_index": otaru_index,
            "verified_count": verified_count,
            "issued_at": timestamp
        }).execute()
    except Exception as e:
        print(f"Warning: Failed to save certificate verification: {e}")
        # We don't block the generation if the DB fails (e.g. if the migration hasn't run yet)

    return verification_hash, pdf_bytes

def verify_certificate(sb, verification_hash: str) -> Optional[dict]:
    """Verify a certificate by its hash and return its details."""
    res = (
        sb.table("certificate_verifications")
        .select("*, profiles(full_name, nik)")
        .eq("verification_hash", verification_hash)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        return None
    return rows[0]
