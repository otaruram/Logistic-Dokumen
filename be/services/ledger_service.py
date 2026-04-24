"""
OtaruChain Ledger Service — SHA-256 Integrity Seal

Generates and verifies cryptographic seals on fraud_scans rows to detect
any manual tampering in the Supabase database.

Hash formula:
  SHA-256( user_id | scan_id | nominal_total | created_at | LEDGER_SECRET_SALT )
"""

import hashlib
from typing import Optional

from config.settings import settings


def _build_hash_payload(
    user_id: str,
    scan_id: str,
    nominal: float,
    created_at: str,
) -> str:
    """Build the canonical string that gets hashed."""
    return f"{user_id}|{scan_id}|{nominal}|{created_at}|{settings.LEDGER_SECRET_SALT}"


def generate_integrity_hash(
    user_id: str,
    scan_id: str,
    nominal: float,
    created_at: str,
) -> str:
    """
    Generate a SHA-256 integrity hash for a fraud_scans row.
    The hash binds the core immutable fields together with a server-side salt.
    """
    payload = _build_hash_payload(user_id, scan_id, nominal, created_at)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verify_row_integrity(row: dict) -> dict:
    """
    Recompute the integrity hash from a fraud_scans row and compare
    with the stored `integrity_hash`.

    Returns:
        {
            "scan_id": "...",
            "result": "VERIFIED" | "TAMPERED" | "UNSEALED",
            "expected_hash": "...",
            "actual_hash": "..."
        }
    """
    scan_id = str(row.get("id", ""))
    stored_hash = row.get("integrity_hash")

    if not stored_hash:
        return {
            "scan_id": scan_id,
            "result": "UNSEALED",
            "expected_hash": None,
            "actual_hash": None,
        }

    recomputed = generate_integrity_hash(
        user_id=str(row.get("user_id", "")),
        scan_id=scan_id,
        nominal=float(row.get("nominal_total") or 0),
        created_at=str(row.get("created_at", "")),
    )

    result = "VERIFIED" if recomputed == stored_hash else "TAMPERED"
    return {
        "scan_id": scan_id,
        "result": result,
        "expected_hash": recomputed,
        "actual_hash": stored_hash,
    }


def seal_scan(supabase_admin, scan_row: dict) -> Optional[str]:
    """
    Compute and store the integrity_hash on a fraud_scans row.
    Called right after insert.  Returns the hash string or None on failure.
    """
    if not supabase_admin:
        return None

    scan_id = str(scan_row.get("id", ""))
    if not scan_id:
        return None

    integrity_hash = generate_integrity_hash(
        user_id=str(scan_row.get("user_id", "")),
        scan_id=scan_id,
        nominal=float(scan_row.get("nominal_total") or 0),
        created_at=str(scan_row.get("created_at", "")),
    )

    try:
        supabase_admin.table("fraud_scans").update(
            {"integrity_hash": integrity_hash}
        ).eq("id", scan_id).execute()
        print(f"🔏 Integrity seal applied to scan {scan_id[:8]}...")
    except Exception as e:
        print(f"⚠️ Failed to seal scan {scan_id}: {e}")
        return None

    return integrity_hash
