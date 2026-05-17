from datetime import date, timedelta
from services.scan_helpers import get_supabase_admin

def get_billing_period(join_date: date, target_date: date | None = None) -> tuple[date, date]:
    """Calculate billing period (month cycle) from user join date."""
    today = target_date or date.today()
    day = join_date.day
    # Current period start
    try:
        period_start = today.replace(day=day)
    except ValueError:
        # Handle months with fewer days
        import calendar
        last_day = calendar.monthrange(today.year, today.month)[1]
        period_start = today.replace(day=min(day, last_day))
    
    if period_start > today:
        # Go back one month
        if today.month == 1:
            period_start = period_start.replace(year=today.year - 1, month=12)
        else:
            import calendar
            prev_month = today.month - 1
            last_day = calendar.monthrange(today.year, prev_month)[1]
            period_start = today.replace(month=prev_month, day=min(day, last_day))
    
    # Period end = start + ~1 month
    if period_start.month == 12:
        period_end = period_start.replace(year=period_start.year + 1, month=1) - timedelta(days=1)
    else:
        import calendar
        next_month = period_start.month + 1
        last_day = calendar.monthrange(period_start.year, next_month)[1]
        period_end = period_start.replace(month=next_month, day=min(day, last_day)) - timedelta(days=1)
    
    return period_start, period_end


def fetch_report_data(user_id: str, period_start: date, period_end: date) -> dict | None:
    """Fetch report data from Supabase for a specific period."""
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        return None
    
    start_iso = period_start.isoformat()
    end_iso = (period_end + timedelta(days=1)).isoformat()
    
    # Documents
    docs_res = supabase_admin.table("documents").select("status, created_at").eq(
        "user_id", user_id
    ).gte("created_at", start_iso).lt("created_at", end_iso).execute()
    
    docs = docs_res.data or []
    verified = sum(1 for d in docs if d["status"] == "verified")
    processing = sum(1 for d in docs if d["status"] == "processing")
    tampered = sum(1 for d in docs if d["status"] == "tampered")
    
    # Finance
    finance_res = supabase_admin.table("extracted_finance_data").select(
        "nominal_amount, field_confidence"
    ).eq("user_id", user_id).gte("created_at", start_iso).lt("created_at", end_iso).execute()
    
    finance = finance_res.data or []
    total_revenue = sum(
        float(f.get("nominal_amount", 0))
        for f in finance
        if f.get("field_confidence") != "low"
    )
    
    # Trust score
    total_docs = verified + processing + tampered
    if total_docs > 0:
        trust_score = min(round((verified * 100 + processing * 50) / total_docs * 10), 1000)
    else:
        trust_score = 0
    if verified == 0 and processing == 0 and tampered > 0:
        trust_score = 0
    
    return {
        "verified": verified,
        "processing": processing,
        "tampered": tampered,
        "total_docs": total_docs,
        "total_revenue": total_revenue,
        "trust_score": trust_score,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
    }
