"""
Otaru Financial Service — Hybrid Input + Full Integrity Index

Komponen skor:
  DSR Score       (30%): Cicilan aktif / Gaji. Target < 30%.
  Consistency     (30%): Histori ketepatan pelunasan kasbon (dari loan_requests).
  Integrity Score (40%): Anti-fraud signal dari Bot 1 (TAMPERED / fraud_scans).
                         Ini USP — bank tidak bisa dapatkan dari tempat lain.

Gaji yang dipakai: gaji_verified (OCR slip gaji) > gaji_bulanan (manual) > salary di profiles.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from services.scan_helpers import get_supabase_admin


def _sb():
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase admin not configured")
    return sb


def _si(v: Any, d: int = 0) -> int:
    try:
        return int(v)
    except Exception:
        return d


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────

_SLIP_GAJI_SIGNALS = [
    "slip gaji", "payslip", "rekapitulasi gaji", "penghasilan", "take home pay",
    "gaji pokok", "tunjangan", "potongan bpjs", "insentif", "lembur",
    "nama karyawan", "nip", "periode gaji", "jabatan",
]

_STRUK_BELANJA_SIGNALS = [
    "total belanja", "struk", "nota", "kasir", "minimarket", "indomaret",
    "alfamart", "supermarket", "hypermart", "grand total", "kembalian",
    "qty", "harga satuan", "subtotal", "diskon",
]


def classify_document(ocr_text: str) -> str:
    text_lower = ocr_text.lower()
    slip_score = sum(1 for kw in _SLIP_GAJI_SIGNALS if kw in text_lower)
    struk_score = sum(1 for kw in _STRUK_BELANJA_SIGNALS if kw in text_lower)
    if slip_score >= 2 and slip_score > struk_score:
        return "slip_gaji"
    if struk_score >= 2 and struk_score > slip_score:
        return "struk_belanja"
    return "unknown"


def _extract_nominal(ocr_text: str) -> int:
    numbers = re.findall(r"[\d]{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?", ocr_text)
    candidates: list[int] = []
    for n in numbers:
        cleaned = re.sub(r"[.,\s]", "", n)
        try:
            candidates.append(int(cleaned))
        except ValueError:
            pass
    return max(candidates) if candidates else 0


# ─────────────────────────────────────────────────────────────────────────────
# OCR + UPLOAD
# ─────────────────────────────────────────────────────────────────────────────

def process_personal_doc_upload(
    user_id: str,
    image_bytes: bytes,
    uploaded_via: str = "telegram",
) -> dict[str, Any]:
    from services.ocr_service import extract_structured_data_from_image
    image_b64 = base64.b64encode(image_bytes).decode()
    ocr_result = extract_structured_data_from_image(image_b64)
    raw_text = ocr_result.get("raw_text", "")
    doc_type = classify_document(raw_text)
    nominal = _extract_nominal(raw_text)
    confidence = ocr_result.get("confidence", "low")
    ai_indicator = "TAMPERED" if (ocr_result.get("tampered") or ocr_result.get("ai_indicator") == "TAMPERED") else "CLEAN"
    sb = _sb()
    doc_res = sb.table("personal_finance_docs").insert({
        "user_id": user_id,
        "doc_type": doc_type,
        "ocr_raw": json.dumps(ocr_result),
        "extracted_nominal": nominal,
        "confidence": confidence,
        "ai_indicator": ai_indicator,
        "uploaded_via": uploaded_via,
        "admin_reviewed": False,
        "review_status": "pending",
    }).execute()
    doc_rows = getattr(doc_res, "data", None) or []

    # Route to Admin Approval Queue — do NOT auto-approve gaji_verified
    # The gaji_verified upsert should only happen after Admin approval
    try:
        prof = sb.table("profiles").select("nik, full_name").eq("id", user_id).limit(1).execute()
        prof_rows = getattr(prof, "data", None) or []
        nik = prof_rows[0].get("nik") if prof_rows else None
        if nik:
            sb.table("loan_requests").insert({
                "nik": nik,
                "nominal_pengajuan": int(nominal) if nominal else 0,
                "image_url": storage_path or "",
                "status": "PENDING",
                "ai_indicator": ai_indicator.upper() if ai_indicator != "CLEAN" else "PROCESSING",
                "source": "FINANCE",
                "doc_type": doc_type,
                "ai_fraud_status": "NEEDS_REVIEW",
                "ai_fraud_reason": f"Dokumen finansial ({doc_type}) memerlukan verifikasi admin. Analisis AI otomatis tidak tersedia untuk upload langsung.",
                "ocr_raw": {
                    "source": "finance_upload",
                    "confidence": confidence,
                    "doc_id": doc_rows[0].get("id") if doc_rows else None,
                },
            }).execute()
    except Exception:
        pass  # Queue insert is best-effort

    return {
        "doc_type": doc_type,
        "extracted_nominal": nominal,
        "confidence": confidence,
        "ai_indicator": ai_indicator,
        "doc_id": doc_rows[0].get("id") if doc_rows else None,
        "queued_for_admin": True,
    }


def process_beta_dummy_doc_upload(
    user_id: str,
    dummy_type: str,
    uploaded_via: str = "web",
    image_url: str = "",
) -> dict[str, Any]:
    """Beta helper: accept official dummy template docs without OCR dependency."""
    if dummy_type not in {"slip_gaji", "struk_belanja"}:
        raise HTTPException(status_code=400, detail="dummy_type tidak valid")

    nominal = 5_500_000 if dummy_type == "slip_gaji" else 425_000
    ocr_result = {
        "raw_text": f"OTARU BETA DUMMY {dummy_type.upper()}",
        "confidence": "high",
        "ai_indicator": "CLEAN",
        "beta_dummy": True,
    }

    sb = _sb()
    doc_res = sb.table("personal_finance_docs").insert({
        "user_id": user_id,
        "doc_type": dummy_type,
        "ocr_raw": json.dumps(ocr_result),
        "extracted_nominal": nominal,
        "confidence": "high",
        "ai_indicator": "CLEAN",
        "uploaded_via": uploaded_via,
        "admin_reviewed": False,
        "review_status": "pending",
    }).execute()
    doc_rows = getattr(doc_res, "data", None) or []

    # Route to Admin Approval Queue — do NOT auto-approve gaji_verified
    try:
        prof = sb.table("profiles").select("nik, full_name").eq("id", user_id).limit(1).execute()
        prof_rows = getattr(prof, "data", None) or []
        nik = prof_rows[0].get("nik") if prof_rows else None
        if nik:
            sb.table("loan_requests").insert({
                "nik": nik,
                "nominal_pengajuan": int(nominal),
                "image_url": image_url,
                "status": "PENDING",
                "ai_indicator": "PROCESSING",
                "source": "FINANCE",
                "doc_type": dummy_type,
                "ai_fraud_status": "TRUSTED",
                "ai_fraud_reason": "Dokumen template resmi Otaru (beta dummy). Terverifikasi otomatis.",
                "ocr_raw": {
                    "source": "finance_beta_dummy",
                    "beta_dummy": True,
                    "doc_id": doc_rows[0].get("id") if doc_rows else None,
                },
            }).execute()
    except Exception:
        pass

    return {
        "doc_type": dummy_type,
        "extracted_nominal": nominal,
        "confidence": "high",
        "ai_indicator": "CLEAN",
        "beta_dummy": True,
        "doc_id": doc_rows[0].get("id") if doc_rows else None,
        "queued_for_admin": True,
    }


# ─────────────────────────────────────────────────────────────────────────────
# MANUAL PROFILE UPDATE
# ─────────────────────────────────────────────────────────────────────────────

def upsert_manual_profile(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    allowed = {"gaji_bulanan", "tanggungan", "pengeluaran_rutin", "pekerjaan", "nama_perusahaan"}
    payload = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not payload:
        return {"updated": False}
    payload["user_id"] = user_id
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    _sb().table("personal_finance_profiles").upsert(payload, on_conflict="user_id").execute()
    return {"updated": True, "fields": list(payload.keys())}


def add_installment(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    sb = _sb()
    res = sb.table("active_installments").insert({
        "user_id": user_id,
        "nama_pinjaman": data["nama_pinjaman"],
        "cicilan_bulanan": _si(data.get("cicilan_bulanan", 0)),
        "sisa_tenor": _si(data.get("sisa_tenor", 0)),
        "lembaga": data.get("lembaga"),
    }).execute()
    rows = getattr(res, "data", None) or []
    return rows[0] if rows else {}


def get_installments(user_id: str) -> list[dict[str, Any]]:
    res = _sb().table("active_installments").select("*").eq("user_id", user_id).eq("status", "active").execute()
    return getattr(res, "data", None) or []


# ─────────────────────────────────────────────────────────────────────────────
# OTARU INTEGRITY INDEX — Full Formula (DSR 30% + Consistency 30% + Integrity 40%)
# ─────────────────────────────────────────────────────────────────────────────

def _get_salary(user_id: str, profile: dict) -> int:
    fp_res = _sb().table("personal_finance_profiles").select("gaji_verified, gaji_bulanan").eq("user_id", user_id).limit(1).execute()
    fp_rows = getattr(fp_res, "data", None) or []
    if fp_rows:
        fp = fp_rows[0]
        if fp.get("gaji_verified"):
            return _si(fp["gaji_verified"])
        if fp.get("gaji_bulanan"):
            return _si(fp["gaji_bulanan"])
    return 0


def _calc_dsr_score(cicilan_total: int, salary: int) -> tuple[int, float]:
    if salary <= 0:
        ratio = 1.0 if cicilan_total > 0 else 0.0
    else:
        ratio = cicilan_total / salary
    if ratio <= 0.20:
        score = 300
    elif ratio <= 0.30:
        score = int(300 - ((ratio - 0.20) / 0.10) * 100)
    elif ratio <= 0.50:
        score = int(200 - ((ratio - 0.30) / 0.20) * 100)
    elif ratio <= 0.70:
        score = int(100 - ((ratio - 0.50) / 0.20) * 80)
    else:
        score = 0
    return max(0, min(300, score)), round(ratio * 100, 2)


def _calc_consistency_score(user_id: str, nik: str | None) -> int:
    if not nik:
        return 150
    sb = _sb()
    res = sb.table("loan_requests").select("status").eq("nik", nik).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        return 150
    total = len(rows)
    lunas = sum(1 for r in rows if (r.get("status") or "").upper() in {"APPROVED", "LUNAS"})
    rejected = sum(1 for r in rows if (r.get("status") or "").upper() in {"REJECTED"})
    rate = lunas / total
    penalty = min(60, rejected * 10)
    return max(0, min(300, int(rate * 300) - penalty))


def _calc_integrity_score(user_id: str, nik: str | None) -> tuple[int, int]:
    sb = _sb()
    tampered = 0
    if nik:
        r1 = sb.table("loan_requests").select("ai_indicator").eq("nik", nik).execute()
        tampered += sum(1 for r in (getattr(r1, "data", None) or []) if (r.get("ai_indicator") or "").upper() == "TAMPERED")
    r2 = sb.table("fraud_scans").select("status").eq("user_id", user_id).eq("status", "tampered").execute()
    tampered += len(getattr(r2, "data", None) or [])
    r3 = sb.table("personal_finance_docs").select("ai_indicator").eq("user_id", user_id).eq("ai_indicator", "TAMPERED").execute()
    tampered += len(getattr(r3, "data", None) or [])
    score = max(0, 400 - (tampered * 80))
    return score, tampered


def calculate_otaru_index(user_id: str) -> dict[str, Any]:
    sb = _sb()
    pr = sb.table("profiles").select("id, user_email, nik, full_name, limit_pinjaman").eq("id", user_id).limit(1).execute()
    profile_rows = getattr(pr, "data", None) or []
    if not profile_rows:
        raise HTTPException(status_code=404, detail="User profile not found")
    profile = profile_rows[0]
    nik = profile.get("nik")
    salary = _get_salary(user_id, profile)
    salary_source = "ocr_verified" if _salary_is_verified(user_id) else "manual_or_profile"

    # Cicilan: Bot 2 manual + Bot 1 loan_requests
    ai_res = sb.table("active_installments").select("cicilan_bulanan").eq("user_id", user_id).eq("status", "active").execute()
    cicilan_manual = sum(_si(r.get("cicilan_bulanan")) for r in (getattr(ai_res, "data", None) or []))
    cicilan_bot1 = 0
    active_nominal_total = 0
    if nik:
        lr = sb.table("loan_requests").select("status, nominal_pengajuan, ocr_raw").eq("nik", nik).execute()
        for row in getattr(lr, "data", None) or []:
            if (row.get("status") or "").upper() in {"PENDING", "APPROVED"}:
                active_nominal_total += _si(row.get("nominal_pengajuan"))
                cicilan_bot1 += _si((row.get("ocr_raw") or {}).get("cicilan_sistem"))
    cicilan_total = cicilan_manual + cicilan_bot1

    dsr, dsr_pct = _calc_dsr_score(cicilan_total, salary)
    consistency = _calc_consistency_score(user_id, nik)
    integrity, tampered = _calc_integrity_score(user_id, nik)
    otaru_index = min(1000, dsr + consistency + integrity)

    if otaru_index >= 850:
        grade = "A"
    elif otaru_index >= 720:
        grade = "B"
    elif otaru_index >= 600:
        grade = "C"
    elif otaru_index >= 450:
        grade = "D"
    else:
        grade = "E"

    integrity_level = "HIGH" if tampered == 0 else ("MEDIUM" if tampered <= 2 else "LOW")
    limit_pinjaman = _si(profile.get("limit_pinjaman"))
    sisa_plafon_aman = max(0, limit_pinjaman - active_nominal_total)

    result = {
        "user_id": user_id,
        "full_name": profile.get("full_name"),
        "email": profile.get("user_email"),
        "nik": nik,
        "salary": salary,
        "salary_source": salary_source,
        "cicilan_aktif_total": cicilan_total,
        "dsr_percent": dsr_pct,
        "tampered_attempts": tampered,
        "dsr_score": dsr,
        "consistency_score": consistency,
        "integrity_score": integrity,
        "otaru_index": otaru_index,
        "credit_grade": grade,
        "integrity_level": integrity_level,
        "limit_pinjaman": limit_pinjaman,
        "active_nominal_total": active_nominal_total,
        "sisa_plafon_aman": sisa_plafon_aman,
    }
    try:
        sb.table("otaru_score_history").insert({
            "user_id": user_id,
            "otaru_index": otaru_index,
            "credit_grade": grade,
            "dsr_percent": dsr_pct,
            "integrity_score": integrity,
            "dsr_score": dsr,
            "consistency_score": consistency,
        }).execute()
    except Exception:
        pass
    return result


def _salary_is_verified(user_id: str) -> bool:
    res = _sb().table("personal_finance_profiles").select("gaji_verified").eq("user_id", user_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    return bool(rows and rows[0].get("gaji_verified"))


# ─────────────────────────────────────────────────────────────────────────────
# RECONCILIATION + HISTORY
# ─────────────────────────────────────────────────────────────────────────────

def get_reconciliation_history(user_id: str, limit: int = 10) -> list[dict[str, Any]]:
    res = _sb().table("ledger_hashes").select("id, table_name, row_id, sha256_hash, created_at").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
    rows = getattr(res, "data", None) or []
    return [{"id": r.get("id"), "table": r.get("table_name"), "row_id": r.get("row_id"), "sha256_hash": r.get("sha256_hash"), "created_at": r.get("created_at"), "status": "SEALED"} for r in rows]


def get_score_history(user_id: str, limit: int = 12) -> list[dict[str, Any]]:
    res = _sb().table("otaru_score_history").select("*").eq("user_id", user_id).order("snapshot_at", desc=True).limit(limit).execute()
    return getattr(res, "data", None) or []


# ─────────────────────────────────────────────────────────────────────────────
# FAMILY SHARING
# ─────────────────────────────────────────────────────────────────────────────

def create_family_invite(owner_user_id: str, invitee_contact: str) -> dict[str, Any]:
    sb = _sb()
    raw_token = secrets.token_urlsafe(24)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=2)
    res = sb.table("family_sharing_invites").insert({
        "owner_user_id": owner_user_id,
        "invitee_contact": invitee_contact,
        "permission": "view_only",
        "invite_token_hash": token_hash,
        "expires_at": expires_at.isoformat(),
        "status": "pending",
    }).execute()
    rows = getattr(res, "data", None) or []
    invite = rows[0] if rows else {}
    return {"invite_id": invite.get("id"), "invite_token": raw_token, "expires_at": expires_at.isoformat(), "permission": "view_only"}


def accept_family_invite(viewer_user_id: str, invite_token: str) -> dict[str, Any]:
    sb = _sb()
    token_hash = hashlib.sha256(invite_token.encode()).hexdigest()
    res = sb.table("family_sharing_invites").select("id, owner_user_id, permission, status, expires_at").eq("invite_token_hash", token_hash).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite = rows[0]
    if invite.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Invite already used or revoked")
    exp_raw = invite.get("expires_at")
    if exp_raw:
        try:
            exp = datetime.fromisoformat(exp_raw.replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="Invite expired")
        except HTTPException:
            raise
        except Exception:
            pass
    owner_user_id = invite["owner_user_id"]
    permission = invite.get("permission") or "view_only"
    sb.table("family_sharing_access").upsert({"owner_user_id": owner_user_id, "viewer_user_id": viewer_user_id, "permission": permission, "accepted_at": datetime.now(timezone.utc).isoformat(), "status": "active"}, on_conflict="owner_user_id,viewer_user_id").execute()
    sb.table("family_sharing_invites").update({"status": "accepted", "accepted_user_id": viewer_user_id, "accepted_at": datetime.now(timezone.utc).isoformat()}).eq("id", invite["id"]).execute()
    # Notif ke owner
    try:
        notify_owner_on_accept(owner_user_id, viewer_user_id)
    except Exception:
        pass
    return {"owner_user_id": owner_user_id, "viewer_user_id": viewer_user_id, "permission": permission, "status": "active"}


def list_family_invites(owner_user_id: str) -> list[dict[str, Any]]:
    res = _sb().table("family_sharing_invites").select("id, invitee_contact, permission, status, expires_at, created_at").eq("owner_user_id", owner_user_id).order("created_at", desc=True).execute()
    return getattr(res, "data", None) or []


def list_family_access(owner_user_id: str) -> list[dict[str, Any]]:
    res = _sb().table("family_sharing_access").select("id, viewer_user_id, permission, status, accepted_at").eq("owner_user_id", owner_user_id).eq("status", "active").execute()
    return getattr(res, "data", None) or []


def revoke_family_access(owner_user_id: str, viewer_user_id: str) -> dict[str, Any]:
    _sb().table("family_sharing_access").update({"status": "revoked"}).eq("owner_user_id", owner_user_id).eq("viewer_user_id", viewer_user_id).execute()
    return {"status": "revoked"}


def get_family_owner_data(viewer_user_id: str, owner_user_id: str) -> dict[str, Any]:
    sb = _sb()
    acc = sb.table("family_sharing_access").select("permission, status").eq("owner_user_id", owner_user_id).eq("viewer_user_id", viewer_user_id).eq("status", "active").limit(1).execute()
    if not (getattr(acc, "data", None) or []):
        raise HTTPException(status_code=403, detail="Akses tidak ditemukan atau sudah dicabut")
    score = calculate_otaru_index(owner_user_id)
    return {"otaru_index": score["otaru_index"], "credit_grade": score["credit_grade"], "integrity_level": score["integrity_level"], "dsr_percent": score["dsr_percent"]}


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────

def _send_finance_bot_message(user_id: str, message: str) -> None:
    import requests as req
    from config.settings import settings
    token = settings.TELEGRAM_FINANCE_BOT_TOKEN
    if not token:
        return
    sb = _sb()
    tl = sb.table("telegram_links").select("telegram_chat_id").eq("user_id", user_id).eq("is_linked", True).limit(1).execute()
    tl_rows = getattr(tl, "data", None) or []
    if not tl_rows:
        return
    chat_id = tl_rows[0].get("telegram_chat_id")
    if not chat_id:
        return
    try:
        req.post(f"https://api.telegram.org/bot{token}/sendMessage", json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"}, timeout=10)
    except Exception:
        pass


def notify_family_viewers(owner_user_id: str, message: str) -> None:
    """Kirim notifikasi ke semua viewer aktif — dipanggil saat skor naik atau kasbon baru."""
    sb = _sb()
    acc = sb.table("family_sharing_access").select("viewer_user_id").eq("owner_user_id", owner_user_id).eq("status", "active").execute()
    for r in getattr(acc, "data", None) or []:
        try:
            _send_finance_bot_message(r["viewer_user_id"], message)
        except Exception:
            pass


def notify_owner_on_accept(owner_user_id: str, viewer_user_id: str) -> None:
    _send_finance_bot_message(
        owner_user_id,
        f"👨‍👩‍👧‍👦 <b>Family Sharing</b>\n"
        f"Anggota keluarga (<code>{viewer_user_id[:8]}…</code>) baru saja menerima undangan akses view-only data kreditmu.",
    )


def notify_score_change(user_id: str, old_index: int, new_index: int) -> None:
    if abs(new_index - old_index) < 10:
        return
    direction = "naik ⬆️" if new_index > old_index else "turun ⬇️"
    msg = (
        f"📊 <b>Otaru Index {direction}</b>\n"
        f"Sebelumnya: <b>{old_index}</b> → Sekarang: <b>{new_index}</b>\n"
        f"Cek detail di menu <b>Cek Skor Kesehatan</b>."
    )
    _send_finance_bot_message(user_id, msg)
    notify_family_viewers(user_id, f"📊 Anggota keluarga kamu punya update skor: <b>{old_index} → {new_index}</b>")


# ─────────────────────────────────────────────────────────────────────────────
# PARTNER API
# ─────────────────────────────────────────────────────────────────────────────

def verify_partner_api_key(raw_key: str) -> dict[str, Any]:
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    sb = _sb()
    res = sb.table("partner_api_keys").select("id, email, partner_name, plan, rate_limit_per_day, scopes, is_active, expires_at").eq("api_key_hash", key_hash).eq("is_active", True).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")

    row = rows[0]

    # Note: phone_number existence is checked at lookup time, not at key validation.
    # This allows keys to work immediately after generation.

    # Check expiration if set
    expires_at = row.get("expires_at")
    if expires_at:
        try:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                # Auto-deactivate expired key
                sb.table("partner_api_keys").update({"is_active": False}).eq("id", row["id"]).execute()
                raise HTTPException(status_code=401, detail="API key sudah kadaluarsa. Generate key baru.")
        except HTTPException:
            raise
        except Exception:
            pass  # If parsing fails, allow through

    sb.table("partner_api_keys").update({"last_used_at": datetime.now(timezone.utc).isoformat()}).eq("id", row["id"]).execute()
    return row


def get_credit_check_for_partner(user_id: str, api_key_id: str) -> dict[str, Any]:
    score = calculate_otaru_index(user_id)
    history = get_reconciliation_history(user_id, limit=12)
    try:
        _sb().table("partner_api_usage").insert({"api_key_id": api_key_id, "endpoint": f"/api/v1/credit-check/{user_id}", "target_user_id": user_id, "response_code": 200}).execute()
    except Exception:
        pass
    return {
        "otaru_index": score["otaru_index"],
        "credit_grade": score["credit_grade"],
        "integrity_level": score["integrity_level"],
        "dsr_percent": score["dsr_percent"],
        "tampered_attempts": score["tampered_attempts"],
        "salary_verified": score["salary_source"] == "ocr_verified",
        "reconciliation_count": len(history),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# CHAT / RESOLVE
# ─────────────────────────────────────────────────────────────────────────────

def resolve_user_id_by_chat(chat_id: int) -> str | None:
    sb = _sb()
    res = sb.table("telegram_links").select("user_id").eq("telegram_chat_id", str(chat_id)).eq("is_linked", True).limit(1).execute()
    rows = getattr(res, "data", None) or []
    return rows[0].get("user_id") if rows else None


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATION TEMPLATES — Source-Specific (OtaruChain vs Otaru Financial)
# ─────────────────────────────────────────────────────────────────────────────

def build_chain_notification(status: str, doc_info: dict) -> str:
    """Build notification message for OtaruChain (logistics) documents."""
    nominal_fmt = f"Rp {int(doc_info.get('nominal', 0)):,}".replace(",", ".")
    no_ref = doc_info.get("no_referensi", "")

    if status == "APPROVED":
        return (
            "✅ <b>Dokumen Tervalidasi (OtaruChain)</b>\n\n"
            f"Surat Jalan / Bon Bensin tervalidasi oleh Admin.\n"
            f"Nominal: <b>{nominal_fmt}</b>\n"
            f"No. Ref: <code>{no_ref}</code>\n\n"
            "🛡️ Integritas operasional terjaga. Trust Score kamu bertambah."
        )
    elif status == "TAMPERED":
        return (
            "🚫 <b>Dokumen Ditandai TAMPERED (OtaruChain)</b>\n\n"
            "Dokumen ditandai TAMPERED oleh Admin.\n"
            f"Nominal: <b>{nominal_fmt}</b>\n\n"
            "⚠️ Integrity Score kamu terpengaruh.\n"
            "Kirim /ask untuk konsultasi dampaknya."
        )
    elif status == "REJECTED":
        return (
            "❌ <b>Dokumen Ditolak (OtaruChain)</b>\n\n"
            "Dokumen ditolak oleh Admin.\n"
            f"Nominal: <b>{nominal_fmt}</b>\n"
            f"No. Ref: <code>{no_ref}</code>"
        )
    elif status == "REVISION":
        return (
            "⚠️ <b>Dokumen Perlu Revisi (OtaruChain)</b>\n\n"
            "Pengajuan kamu perlu diperbaiki.\n"
            f"Nominal: <b>{nominal_fmt}</b>\n"
            f"No. Ref: <code>{no_ref}</code>"
        )
    else:
        return (
            f"ℹ️ <b>Status Dokumen OtaruChain: {status}</b>\n"
            f"Nominal: <b>{nominal_fmt}</b>\n"
            f"No. Ref: <code>{no_ref}</code>"
        )


def build_finance_notification(status: str, doc_info: dict) -> str:
    """Build notification message for Otaru Financial (salary/income) documents."""
    nominal_fmt = f"Rp {int(doc_info.get('nominal', 0)):,}".replace(",", ".")
    doc_type = doc_info.get("doc_type", "dokumen")
    doc_type_label = {"slip_gaji": "Slip Gaji", "struk_belanja": "Struk Belanja"}.get(doc_type, doc_type)

    if status == "APPROVED":
        return (
            "✅ <b>Dokumen Tervalidasi (Otaru Financial)</b>\n\n"
            f"{doc_type_label} tervalidasi oleh Admin.\n"
            f"Nominal: <b>{nominal_fmt}</b>\n\n"
            "📊 Profil finansial kamu telah diperbarui.\n"
            "Otaru Index dan Credit Grade mungkin berubah."
        )
    elif status == "TAMPERED":
        return (
            "🚫 <b>Dokumen Finansial Ditolak (Otaru Financial)</b>\n\n"
            f"{doc_type_label} ditolak oleh Admin.\n"
            f"Nominal: <b>{nominal_fmt}</b>\n\n"
            "Hubungi support jika kamu yakin ini keliru."
        )
    elif status == "REJECTED":
        return (
            "❌ <b>Dokumen Finansial Ditolak (Otaru Financial)</b>\n\n"
            f"{doc_type_label} ditolak oleh Admin.\n"
            f"Nominal: <b>{nominal_fmt}</b>\n\n"
            "Silakan periksa kembali kelengkapan dokumen."
        )
    elif status == "REVISION":
        return (
            "⚠️ <b>Dokumen Perlu Revisi (Otaru Financial)</b>\n\n"
            f"Pengajuan {doc_type_label} kamu perlu diperbaiki.\n"
            f"Nominal: <b>{nominal_fmt}</b>"
        )
    else:
        return (
            f"ℹ️ <b>Status Dokumen Financial: {status}</b>\n"
            f"Tipe: {doc_type_label}\n"
            f"Nominal: <b>{nominal_fmt}</b>"
        )

