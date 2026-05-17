from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

def get_scoring_data(sb, user_id: str, email: str, raw_profile: dict, limit: int) -> dict:
    """Core logic to fetch trust score, risk, cycles, and financial index."""
    # 2. Fetch fraud_scans for this user
    scans_res = (
        sb.table("fraud_scans")
        .select("id, status, nominal_total, nama_klien, doc_type, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    all_scans = getattr(scans_res, "data", None) or []

    total = len(all_scans)
    verified = sum(1 for s in all_scans if s.get("status") == "verified")
    tampered = sum(1 for s in all_scans if s.get("status") == "tampered")
    total_nominal = sum((s.get("nominal_total") or 0) for s in all_scans if s.get("status") == "verified")

    # 3. Trust score
    trust_score = 0
    try:
        fn_res = sb.rpc("calculate_logistics_trust_score", {"p_user_id": user_id}).execute()
        fn_data = getattr(fn_res, "data", None)
        if fn_data is not None:
            trust_score = int(fn_data)
    except Exception:
        if total > 0:
            trust_score = min(int((verified / total) * 800), 800)

    # 4. Risk
    risk_detail_data = None
    risk_label = "LOW"
    try:
        from services.risk_service import calculate_risk_level
        risk_data = calculate_risk_level(user_id)
        risk_label = risk_data.get("risk_level", "HIGH")
        risk_detail_data = {
            "risk_level": risk_data["risk_level"],
            "risk_score": risk_data["risk_score"],
            "factors": risk_data["factors"],
        }
    except Exception:
        if tampered == 0:
            risk_label = "LOW"
        elif tampered <= 2:
            risk_label = "MEDIUM"
        else:
            risk_label = "HIGH"

    # 5. Cycles
    cycle_info_data = None
    try:
        from services.scoring_service import compute_and_sync_cycles
        cycle_data = compute_and_sync_cycles(user_id, trust_score)
        cycle_info_data = {
            "current_cycle": cycle_data.get("current_cycle", 0),
            "current_cycle_score": cycle_data.get("current_cycle_score", 0),
            "cycle_max": cycle_data.get("cycle_max", 1000),
            "lifetime_score": cycle_data.get("lifetime_score", 0),
            "completed_cycles": cycle_data.get("completed_cycles", 0),
        }
    except Exception:
        pass

    # 6. Recent scans
    recent = []
    for s in all_scans[:limit]:
        recent.append({
            "scan_id": s.get("id", ""),
            "status": s.get("status", ""),
            "nominal_total": s.get("nominal_total"),
            "vendor_name": s.get("nama_klien"),
            "doc_type": s.get("doc_type"),
            "created_at": s.get("created_at", ""),
        })

    # 7. Credit Breakdown
    credit_breakdown = None
    try:
        from services.otaru_finance_service import calculate_otaru_index
        cr = calculate_otaru_index(user_id)
        credit_breakdown = {
            "final_score": cr.get("otaru_index", 0),
            "grade": cr.get("credit_grade", "E"),
            "formula": "CR = DSR(0-300) + Consistency(0-300) + Integrity(0-400)",
            "components": {
                "dsr_score": cr.get("dsr_score", 0),
                "consistency_score": cr.get("consistency_score", 0),
                "integrity_score": cr.get("integrity_score", 0),
            },
            "metrics": {
                "dsr_percent": cr.get("dsr_percent", 0),
                "tampered_attempts": cr.get("tampered_attempts", 0),
            },
            "grade_ranges": [
                {"grade": "A", "min": 850, "max": 1000},
                {"grade": "B", "min": 720, "max": 849},
                {"grade": "C", "min": 600, "max": 719},
                {"grade": "D", "min": 450, "max": 599},
                {"grade": "E", "min": 0, "max": 449},
            ],
        }
    except Exception:
        credit_breakdown = None

    return {
        "email": email,
        "user_id": user_id,
        "trust_score": trust_score,
        "risk_label": risk_label,
        "risk_detail": risk_detail_data,
        "cycle_info": cycle_info_data,
        "total_scans": total,
        "verified_scans": verified,
        "tampered_scans": tampered,
        "total_nominal": total_nominal,
        "recent_scans": recent,
        "credit_score_breakdown": credit_breakdown,
    }


def get_unified_decision_data(sb, profile: dict) -> dict:
    """Core logic to fetch OtaruChain metrics, financial metrics, trust grade and recommendation."""
    user_id = profile.get("id")
    
    # ── OtaruChain metrics (fraud_scans) ─────────────────────────────────
    try:
        scans_res = sb.table("fraud_scans").select("status,nominal_total").eq("user_id", user_id).execute()
        scans = getattr(scans_res, "data", None) or []
        verified_docs = sum(1 for s in scans if (s.get("status") or "").upper() == "VERIFIED")
        tampered_docs = sum(1 for s in scans if (s.get("status") or "").upper() == "TAMPERED")
        trust_score_chain = int(profile.get("credit_score") or 0)
    except Exception:
        verified_docs = 0
        tampered_docs = 0
        trust_score_chain = 0

    # ── Financial metrics (Otaru Index) ──────────────────────────────────
    otaru_index = 0
    credit_grade = "E"
    dsr_percent = 0.0
    sisa_plafon = 0.0
    integrity_level = "LOW"
    fin = {}
    try:
        from services.otaru_finance_service import calculate_otaru_index
        fin = calculate_otaru_index(user_id)
        otaru_index = fin.get("otaru_index", 0)
        credit_grade = fin.get("credit_grade", "E")
        dsr_percent = fin.get("dsr_percent", 0.0)
        sisa_plafon = fin.get("sisa_plafon_aman", 0.0)
        integrity_level = fin.get("integrity_level", "LOW")
    except Exception:
        pass

    # ── Trust Grade calculation ───────────────────────────────────────────
    fraud_flags = int(profile.get("fraud_flags") or 0)
    trust_grade = credit_grade
    
    if trust_grade in ["A", "B"] and tampered_docs == 0 and fraud_flags == 0:
        recommendation_code = "LAYAK_KREDIT"
        recommendation_desc = (
            f"{profile.get('full_name') or 'Nasabah'} memiliki rekam jejak dokumen bersih "
            f"(0 TAMPERED) dan Otaru Index tinggi ({otaru_index}/1000). "
            "Rekomendasikan DITERIMA dengan batas plafon penuh."
        )
    elif trust_grade == "C" or (trust_grade in ["A", "B"] and tampered_docs > 0):
        recommendation_code = "RISIKO_MENENGAH"
        recommendation_desc = (
            f"{profile.get('full_name') or 'Nasabah'} memiliki Trust Grade {trust_grade} "
            f"dengan {tampered_docs} dokumen terindikasi manipulasi. "
            "Rekomendasikan PERTIMBANGKAN dengan batas plafon terbatas dan verifikasi manual."
        )
    else:
        recommendation_code = "TOLAK"
        recommendation_desc = (
            f"{profile.get('full_name') or 'Nasabah'} memiliki Trust Grade rendah ({trust_grade}) "
            f"dengan {tampered_docs} dokumen TAMPERED dan {fraud_flags} fraud flags. "
            "Rekomendasikan DITOLAK atau verifikasi mendalam sebelum diproses."
        )

    return {
        "trust_score_chain": trust_score_chain,
        "verified_docs": verified_docs,
        "tampered_docs": tampered_docs,
        "fraud_flags": fraud_flags,
        "otaru_index": otaru_index,
        "credit_grade": credit_grade,
        "dsr_percent": dsr_percent,
        "sisa_plafon": sisa_plafon,
        "integrity_level": integrity_level,
        "trust_grade": trust_grade,
        "recommendation_code": recommendation_code,
        "recommendation_desc": recommendation_desc,
        "fin": fin,
    }


def handle_score_user_by_email(sb, email: str, limit: int, api_key_owner: str, deduct_credit_fn) -> dict:
    profile_res = sb.table("profiles").select("id, user_email").eq("user_email", email).limit(1).execute()
    profiles = getattr(profile_res, "data", None) or []
    if not profiles:
        try:
            page = 1
            found_uid = None
            while True:
                resp = sb.auth.admin.list_users(page=page, per_page=50)
                user_list = resp if isinstance(resp, list) else getattr(resp, "users", []) or []
                if not user_list: break
                for u in user_list:
                    u_email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
                    u_id = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
                    if u_email and u_email.lower() == email.lower() and u_id:
                        found_uid = str(u_id)
                        try:
                            sb.table("profiles").upsert({"id": found_uid, "user_email": u_email}, on_conflict="id").execute()
                        except Exception: pass
                        break
                if found_uid or len(user_list) < 50: break
                page += 1
            if not found_uid: raise Exception(f"User dengan email '{email}' tidak ditemukan")
            user_id = found_uid
        except Exception as lookup_err:
            raise Exception(f"User tidak ditemukan: {lookup_err}")
    else:
        user_id = profiles[0]["id"]

    deduct_credit_fn(sb, api_key_owner)
    scoring_data = get_scoring_data(sb, user_id, email, {}, limit)
    
    return scoring_data


def handle_lookup_by_nik(sb, nik: str, deduct_credit_fn, api_key_owner: str) -> dict:
    prof_res = sb.table("profiles").select("id, user_email, full_name, data_consent_given").eq("nik", nik).limit(1).execute()
    prof_rows = getattr(prof_res, "data", None) or []
    if not prof_rows: raise Exception("NIK tidak ditemukan di sistem")
    
    raw_profile = prof_rows[0]
    if not raw_profile.get("data_consent_given"):
        raise Exception("User belum memberikan consent data sesuai UU PDP. Tidak dapat membagikan data ke pihak ketiga.")

    user_id = raw_profile["id"]
    email = raw_profile.get("user_email", "")

    deduct_credit_fn(sb, api_key_owner)
    scoring_data = get_scoring_data(sb, user_id, email, raw_profile, 10)
    
    return {"scoring_data": scoring_data, "raw_profile": raw_profile}


def handle_score_user_by_nik(sb, nik: str, limit: int, api_key_owner: str, deduct_credit_fn) -> dict:
    prof_res = sb.table("profiles").select("id, user_email, data_consent_given").eq("nik", nik).limit(1).execute()
    prof_rows = getattr(prof_res, "data", None) or []
    if not prof_rows: raise Exception("NIK tidak ditemukan")
    raw_profile = prof_rows[0]
    if not raw_profile.get("data_consent_given"):
        raise Exception("User belum memberikan consent data sesuai UU PDP. Tidak dapat membagikan data ke pihak ketiga.")

    user_id = raw_profile["id"]
    email = raw_profile.get("user_email", "")

    deduct_credit_fn(sb, api_key_owner)
    scoring_data = get_scoring_data(sb, user_id, email, raw_profile, limit)
    return {"scoring_data": scoring_data, "raw_profile": raw_profile}


def handle_score_user_by_phone(sb, phone: str, limit: int, api_key_owner: str, deduct_credit_fn, resolve_phone_to_profile) -> dict:
    raw_profile = resolve_phone_to_profile(sb, phone)
    if not raw_profile.get("data_consent_given"):
        raise Exception("User belum memberikan consent data sesuai UU PDP. Tidak dapat membagikan data ke pihak ketiga.")

    user_id = raw_profile["id"]
    email = raw_profile.get("user_email", "")

    deduct_credit_fn(sb, api_key_owner)
    scoring_data = get_scoring_data(sb, user_id, email, raw_profile, limit)
    return {"scoring_data": scoring_data, "raw_profile": raw_profile}


def handle_unified_decision(sb, phone: str, x_api_key: str, mask_profile_for_partner) -> dict:
    phone_variants = [
        phone,
        f"+62{phone[1:]}" if phone.startswith("0") else f"+62{phone}",
        phone[1:] if phone.startswith("0") else phone,
    ]
    raw_profile = None
    try:
        prof_res = sb.table("profiles").select(
            "id,full_name,nik,address,ktp_photo_url,selfie_photo_url,"
            "phone_number,data_consent_given"
        ).in_("phone_number", phone_variants).limit(1).execute()
        profiles_data = getattr(prof_res, "data", None) or []
        if profiles_data:
            raw_profile = profiles_data[0]
        else:
            tl_res = sb.table("telegram_links").select("user_id").in_("phone_number", phone_variants).limit(1).execute()
            tl_data = getattr(tl_res, "data", None) or []
            if tl_data and tl_data[0].get("user_id"):
                prof_res2 = sb.table("profiles").select(
                    "id,full_name,nik,address,ktp_photo_url,selfie_photo_url,"
                    "phone_number,data_consent_given"
                ).eq("id", tl_data[0]["user_id"]).limit(1).execute()
                profiles_data2 = getattr(prof_res2, "data", None) or []
                if profiles_data2:
                    raw_profile = profiles_data2[0]

        if not raw_profile:
            raise Exception(f"Nomor HP {phone} tidak ditemukan dalam sistem")
    except Exception as e:
        raise Exception(f"Nomor HP tidak ditemukan: {e}")

    if not raw_profile.get("data_consent_given"):
        raise Exception("User belum memberikan consent data sesuai UU PDP. Tidak dapat membagikan data ke pihak ketiga.")

    profile = mask_profile_for_partner(raw_profile)
    user_id = profile["id"]

    ud = get_unified_decision_data(sb, profile)

    import hashlib
    hash_payload = f"{profile.get('nik')}-{ud['recommendation_code']}-OTARU_ADMIN-{datetime.now(timezone.utc).isoformat()}"
    stamp_hash = hashlib.sha256(hash_payload.encode()).hexdigest()

    response = {
        "compliance": {
            "uu_pdp_consent": True,
            "consent_label": "GRANTED — User Verified",
            "ojk_pka_proxy": "ACTIVE",
            "data_source": "First-Party Telegram Verification",
        },
        "personal_data": {
            "nik": profile.get("nik") or "",
            "full_name": profile.get("full_name") or "",
            "phone_number": phone,
        },
        "kyc_media": {
            "ktp_photo_url": profile.get("ktp_photo_url") or "",
            "selfie_photo_url": profile.get("selfie_photo_url") or "",
        },
        "otaruchain_metric": {
            "verified_docs": ud["verified_docs"],
            "tampered_docs": ud["tampered_docs"],
            "fraud_flags": ud["fraud_flags"],
            "trust_score_chain": ud["trust_score_chain"],
        },
        "otarufinancial_metric": {
            "otaru_index": ud["otaru_index"],
            "credit_grade": ud["credit_grade"],
            "dsr_percent": ud["dsr_percent"],
            "sisa_plafon": ud["sisa_plafon"],
            "integrity_level": ud["integrity_level"],
            "verified_income": ud["fin"].get("salary", 0) if ud["fin"] else 0,
            "active_installments": ud["fin"].get("cicilan_aktif_total", 0) if ud["fin"] else 0,
        },
        "final_decision": {
            "trust_grade": ud["trust_grade"],
            "recommendation": ud["recommendation_code"],
            "description": ud["recommendation_desc"],
            "digital_stamp_hash": stamp_hash,
        },
    }

    try:
        api_key_id = None
        if x_api_key and x_api_key.startswith("dk-"):
            kh = hashlib.sha256(x_api_key.encode()).hexdigest()
            ak_res = sb.table("partner_api_keys").select("id").eq("api_key_hash", kh).limit(1).execute()
            ak_rows = getattr(ak_res, "data", None) or []
            if ak_rows:
                api_key_id = ak_rows[0]["id"]
        elif x_api_key:
            ak_res = sb.table("api_keys").select("id").eq("key_value", x_api_key).limit(1).execute()
            ak_rows = getattr(ak_res, "data", None) or []
            if ak_rows:
                api_key_id = ak_rows[0]["id"]
                
        if api_key_id:
            sb.table("partner_api_usage").insert({
                "api_key_id": api_key_id,
                "endpoint": f"/api/v1/partner/unified-decision/{phone}",
                "target_user_id": user_id,
                "response_code": 200
            }).execute()
    except Exception:
        pass

    return response
