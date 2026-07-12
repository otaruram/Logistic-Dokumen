"""
Monthly/Annual Report — PDF generation + Email delivery.
Refactored to delegate business logic to services.
"""

import io
import os
from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from models.models import User
from utils.auth import get_current_active_user
from services.scan_helpers import get_supabase_admin

from services.email_service import (
    send_email, get_report_email_html, get_newsletter_email_html, get_base_email_template,
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, BRAND_NAME
)
from services.pdf_service import generate_pdf
from services.report_service import get_billing_period, fetch_report_data

router = APIRouter()

# ── API Endpoints ────────────────────────────────────────────────────────────

@router.get("/period-data")
async def get_period_data(
    period: str = Query("all", regex="^(all|current|last|3months)$"),
    current_user: User = Depends(get_current_active_user),
):
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not available")

    user_id = str(current_user.id)

    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
        join_date = datetime.fromisoformat(auth_user.user.created_at.replace("Z", "+00:00")).date()
    except Exception:
        join_date = date.today()

    today = date.today()

    if period == "current":
        start, end = get_billing_period(join_date, today)
    elif period == "last":
        # Go to previous period
        curr_start, _ = get_billing_period(join_date, today)
        prev_day = curr_start - timedelta(days=1)
        start, end = get_billing_period(join_date, prev_day)
    elif period == "3months":
        # Go back 3 periods
        curr_start, _ = get_billing_period(join_date, today)
        start = curr_start
        for _ in range(2):
            prev_day = start - timedelta(days=1)
            start, _ = get_billing_period(join_date, prev_day)
        end = today
    else:
        start = join_date
        end = today

    data = fetch_report_data(user_id, start, end)
    if not data:
        data = {"verified": 0, "processing": 0, "tampered": 0, "total_docs": 0,
                "total_revenue": 0, "trust_score": 0, "period_start": start.isoformat(),
                "period_end": end.isoformat()}

    return {
        **data,
        "period": period,
        "join_date": join_date.isoformat(),
    }


@router.get("/monthly-history")
async def get_monthly_history(
    months: int = Query(12, ge=1, le=24),
    current_user: User = Depends(get_current_active_user),
):
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not available")

    user_id = str(current_user.id)
    
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
        join_date = datetime.fromisoformat(auth_user.user.created_at.replace("Z", "+00:00")).date()
    except Exception:
        join_date = date.today()

    today = date.today()
    history = []

    current_date = today
    for _ in range(months):
        start, end = get_billing_period(join_date, current_date)
        if start < join_date:
            break
        data = fetch_report_data(user_id, start, end)
        if data:
            history.append(data)
        current_date = start - timedelta(days=1)
        if current_date < join_date:
            break

    history.reverse()
    return {"history": history, "join_date": join_date.isoformat()}


@router.get("/download-pdf")
async def download_report_pdf(
    current_user: User = Depends(get_current_active_user),
):
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not available")

    user_id = str(current_user.id)
    
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
        join_date = datetime.fromisoformat(auth_user.user.created_at.replace("Z", "+00:00")).date()
    except Exception:
        join_date = date.today()

    today = date.today()

    # Current period
    start, end = get_billing_period(join_date, today)
    current_data = fetch_report_data(user_id, start, end)

    history = []
    current_date = today
    for _ in range(12):
        s, e = get_billing_period(join_date, current_date)
        if s < join_date:
            break
        data = fetch_report_data(user_id, s, e)
        if data:
            history.append(data)
        current_date = s - timedelta(days=1)
        if current_date < join_date:
            break
    history.reverse()

    pdf_bytes = generate_pdf(current_user.email, current_data, history)
    filename = f"{BRAND_NAME}_Report_{today.strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/send-email-report")
async def send_email_report(
    current_user: User = Depends(get_current_active_user),
):
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not available")

    user_id = str(current_user.id)
    
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
        join_date = datetime.fromisoformat(auth_user.user.created_at.replace("Z", "+00:00")).date()
    except Exception:
        join_date = date.today()

    today = date.today()
    start, end = get_billing_period(join_date, today)
    current_data = fetch_report_data(user_id, start, end)

    history = []
    current_date = today
    for _ in range(12):
        s, e = get_billing_period(join_date, current_date)
        if s < join_date:
            break
        data = fetch_report_data(user_id, s, e)
        if data:
            history.append(data)
        current_date = s - timedelta(days=1)
        if current_date < join_date:
            break
    history.reverse()

    pdf_bytes = generate_pdf(current_user.email, current_data, history)
    filename = f"{BRAND_NAME}_Report_{today.strftime('%Y%m%d')}.pdf"

    body_html = get_report_email_html(current_user.email, start, end, current_data)

    success = send_email(current_user.email, f"📊 Laporan Bulanan {BRAND_NAME} — {today.strftime('%B %Y')}", body_html, pdf_bytes, filename)

    if success is True:
        return {"message": "Report sent to your email", "email": current_user.email}
    else:
        return {"message": "Email not configured. Download PDF manually.", "email_sent": False}



