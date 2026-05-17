from typing import Optional
from datetime import datetime, timezone

def build_audit_response(
    sb, user_id: str, email: str, limit: int,
    CreditScoreInfo, FinancialCreditScore, RiskInfo, PeriodSummary,
    TransactionInfo, IntegrityInfo, AuditLogEntry, LoanHistoryEntry,
    DsrHealth, UserInfo, AuditResponse,
    compute_and_sync_cycles, calculate_risk_level, verify_row_integrity, get_kyc_identity
) -> 'AuditResponse':
    identity = get_kyc_identity(sb, user_id)

    scans_res = (
        sb.table("fraud_scans")
        .select("id, user_id, status, nominal_total, nama_klien, doc_type, created_at, integrity_hash")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    all_scans = getattr(scans_res, "data", None) or []

    trust_score = 0
    try:
        fn_res = sb.rpc("calculate_logistics_trust_score", {"p_user_id": user_id}).execute()
        fn_data = getattr(fn_res, "data", None)
        if fn_data is not None:
            trust_score = int(fn_data)
    except Exception:
        total = len(all_scans)
        verified = sum(1 for s in all_scans if s.get("status") == "verified")
        if total > 0:
            trust_score = min(int((verified / total) * 800), 800)

    try:
        cycle_data = compute_and_sync_cycles(user_id, trust_score)
    except Exception as e:
        print(f"⚠️ Cycle scoring fallback: {e}")
        cycle_data = {}

    credit_score = CreditScoreInfo(
        current_cycle=cycle_data.get("current_cycle", 1),
        current_cycle_score=cycle_data.get("current_cycle_score", trust_score),
        cycle_max=cycle_data.get("cycle_max", 1000),
        lifetime_score=cycle_data.get("lifetime_score", trust_score),
        completed_cycles=cycle_data.get("completed_cycles", 0),
    )

    financial_credit_score = None
    try:
        from services.otaru_finance_service import calculate_otaru_index

        cr = calculate_otaru_index(user_id)
        financial_credit_score = FinancialCreditScore(
            final_score=cr.get("otaru_index", 0),
            grade=cr.get("credit_grade", "E"),
            formula="CR = DSR(0-300) + Consistency(0-300) + Integrity(0-400)",
            components={
                "dsr_score": cr.get("dsr_score", 0),
                "consistency_score": cr.get("consistency_score", 0),
                "integrity_score": cr.get("integrity_score", 0),
            },
            metrics={
                "dsr_percent": cr.get("dsr_percent", 0),
                "tampered_attempts": cr.get("tampered_attempts", 0),
            },
            grade_ranges=[
                {"grade": "A", "min": 850, "max": 1000},
                {"grade": "B", "min": 720, "max": 849},
                {"grade": "C", "min": 600, "max": 719},
                {"grade": "D", "min": 450, "max": 599},
                {"grade": "E", "min": 0, "max": 449},
            ],
        )
    except Exception:
        financial_credit_score = None

    try:
        risk_data = calculate_risk_level(user_id)
    except Exception as e:
        print(f"⚠️ Risk calculation fallback: {e}")
        risk_data = {"risk_level": "MEDIUM", "risk_score": 50, "factors": []}

    risk = RiskInfo(
        risk_level=risk_data.get("risk_level", "MEDIUM"),
        risk_score=risk_data.get("risk_score", 50),
        factors=risk_data.get("factors", []),
    )

    def get_period_summary(scans: list, days: Optional[int] = None) -> PeriodSummary:
        now = datetime.now(timezone.utc)
        count = 0
        nominal = 0.0
        for s in scans:
            if days is not None:
                ca = s.get("created_at", "")
                try:
                    if ca.endswith("Z"):
                        ca = ca[:-1] + "+00:00"
                    dt = datetime.fromisoformat(ca)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if (now - dt).days > days:
                        continue
                except (ValueError, TypeError):
                    continue
            count += 1
            nominal += float(s.get("nominal_total") or 0)
        return PeriodSummary(count=count, nominal=nominal)

    verified_count = sum(1 for s in all_scans if s.get("status") == "verified")
    tampered_count = sum(1 for s in all_scans if s.get("status") == "tampered")
    processing_count = sum(1 for s in all_scans if s.get("status") == "processing")
    total_nominal = sum(float(s.get("nominal_total") or 0) for s in all_scans)

    transactions = TransactionInfo(
        total=len(all_scans),
        verified=verified_count,
        tampered=tampered_count,
        processing=processing_count,
        total_nominal=total_nominal,
        by_period={
            "30d": get_period_summary(all_scans, 30),
            "6m": get_period_summary(all_scans, 180),
            "1y": get_period_summary(all_scans, 365),
            "all": get_period_summary(all_scans, None),
        },
    )

    sealed = 0
    verified_seals = 0
    tampered_seals = 0
    unsealed = 0

    for s in all_scans:
        try:
            v = verify_row_integrity(s)
            r = v["result"]
        except Exception as e:
            print(f"⚠️ Integrity check fallback: {e}")
            r = "UNSEALED"

        if r == "VERIFIED":
            sealed += 1
            verified_seals += 1
        elif r == "TAMPERED":
            sealed += 1
            tampered_seals += 1
        else:
            unsealed += 1

    total_sealed = verified_seals + tampered_seals
    integrity_rate = round((verified_seals / total_sealed * 100), 1) if total_sealed > 0 else 0.0

    integrity = IntegrityInfo(
        total_sealed=total_sealed,
        verified_seals=verified_seals,
        tampered_seals=tampered_seals,
        unsealed=unsealed,
        integrity_rate=integrity_rate,
    )

    audit_log = []
    for s in all_scans[:limit]:
        try:
            v = verify_row_integrity(s)
            res_status = v["result"]
        except Exception:
            res_status = "UNSEALED"

        audit_log.append(AuditLogEntry(
            scan_id=str(s.get("id", "")),
            status=s.get("status", ""),
            nominal=float(s.get("nominal_total") or 0),
            doc_type=s.get("doc_type"),
            vendor_name=s.get("nama_klien"),
            created_at=s.get("created_at", ""),
            integrity_status=res_status,
        ))

    profile_nik = None
    try:
        profile_nik_res = (
            sb.table("profiles")
            .select("nik")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        profile_nik_rows = getattr(profile_nik_res, "data", None) or []
        if profile_nik_rows:
            profile_nik = profile_nik_rows[0].get("nik")
    except Exception:
        profile_nik = None

    loan_history: list[LoanHistoryEntry] = []
    if profile_nik:
        try:
            loan_res = (
                sb.table("loan_requests")
                .select(
                    "id, nik, nominal_pengajuan, image_url, status, ai_indicator, "
                    "sha256_hash, submitted_at, reviewed_at, ocr_raw"
                )
                .eq("nik", profile_nik)
                .order("submitted_at", desc=True)
                .execute()
            )
            loan_rows = getattr(loan_res, "data", None) or []
            for row in loan_rows:
                ocr_raw = row.get("ocr_raw") or {}
                loan_history.append(
                    LoanHistoryEntry(
                        id=str(row.get("id", "")),
                        nik=str(row.get("nik", "")),
                        nominal_pengajuan=int(row.get("nominal_pengajuan") or 0),
                        image_url=row.get("image_url"),
                        status=str(row.get("status", "")),
                        ai_indicator=row.get("ai_indicator"),
                        sha256_hash=row.get("sha256_hash"),
                        submitted_at=row.get("submitted_at"),
                        reviewed_at=row.get("reviewed_at"),
                        tenor_bulan=ocr_raw.get("tenor_bulan"),
                        cicilan_sistem=ocr_raw.get("cicilan_sistem"),
                        dsr_status=ocr_raw.get("dsr_status"),
                        no_referensi=ocr_raw.get("no_referensi") or str(row.get("id", ""))[:8].upper(),
                    )
                )
        except Exception:
            loan_history = []

    DSR_LIMIT_VAL = 1_500_000
    dsr_health: Optional[DsrHealth] = None
    fraud_flags: int = 0
    if profile_nik:
        try:
            active_loan_res = (
                sb.table("loan_requests")
                .select("ocr_raw, ai_indicator")
                .eq("nik", profile_nik)
                .in_("status", ["PENDING", "APPROVED"])
                .execute()
            )
            active_rows = getattr(active_loan_res, "data", None) or []
            cicilan_aktif_total = sum(
                int((r.get("ocr_raw") or {}).get("cicilan_sistem") or 0) for r in active_rows
            )
            dsr_pct = round(cicilan_aktif_total / DSR_LIMIT_VAL * 100, 1) if DSR_LIMIT_VAL else 0
            dsr_health = DsrHealth(
                cicilan_aktif_total=cicilan_aktif_total,
                dsr_limit=DSR_LIMIT_VAL,
                dsr_pct=dsr_pct,
                status="OVER" if cicilan_aktif_total > DSR_LIMIT_VAL else "AMAN",
            )
            fraud_flags = sum(1 for r in loan_history if r.ai_indicator == "TAMPERED")
        except Exception:
            dsr_health = None
            fraud_flags = 0

    return AuditResponse(
        user=UserInfo(email=email, user_id=user_id),
        identity=identity,
        credit_score=credit_score,
        financial_credit_score=financial_credit_score,
        risk=risk,
        transactions=transactions,
        integrity=integrity,
        audit_log=audit_log,
        loan_history=loan_history,
        dsr_health=dsr_health,
        fraud_flags=fraud_flags,
    )
