import os
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from models.models import User
from utils.auth import get_current_active_user
from services.scan_helpers import get_supabase_admin
from services.email_service import (
    send_email, get_report_email_html, get_newsletter_email_html, get_base_email_template,
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, BRAND_NAME
)
from services.pdf_service import generate_pdf
from services.report_service import get_billing_period, fetch_report_data

router = APIRouter(prefix="/api/report", tags=["Cron Reports"])

CLEANUP_SECRET = os.getenv("CLEANUP_SECRET", "")

@router.post("/cron/send-all")
async def cron_send_all_reports(
    request: Request,
):
    """
    Cron endpoint: auto-send monthly email reports to ALL active users.
    Protected by CLEANUP_SECRET Bearer token (same as cleanup cron).
    """
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if not CLEANUP_SECRET or token != CLEANUP_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing secret")

    if not SMTP_USER or not SMTP_PASS:
        return {"message": "SMTP not configured", "sent": 0, "skipped": 0}

    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not available")

    try:
        users_res = supabase_admin.table("profiles").select("id, email").execute()
        users = users_res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {e}")

    today = date.today()
    sent = 0
    skipped = 0
    errors = []

    for user in users:
        user_id = user.get("id")
        email = user.get("email")
        if not email or not user_id:
            skipped += 1
            continue

        try:
            try:
                auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
                join_date = datetime.fromisoformat(
                    auth_user.user.created_at.replace("Z", "+00:00")
                ).date()
            except Exception:
                join_date = today

            start, end = get_billing_period(join_date, today)
            current_data = fetch_report_data(user_id, start, end)

            if not current_data or current_data.get("total_docs", 0) == 0:
                skipped += 1
                continue

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

            pdf_bytes = generate_pdf(email, current_data, history)
            filename = f"{BRAND_NAME}_Report_{today.strftime('%Y%m%d')}.pdf"

            body_html = get_report_email_html(email, start, end, current_data)

            result = send_email(
                email,
                f"📊 Laporan Bulanan {BRAND_NAME} — {today.strftime('%B %Y')}",
                body_html, pdf_bytes, filename
            )
            if result is True:
                sent += 1
            else:
                skipped += 1
                if isinstance(result, str):
                    errors.append(f"{email}: {result}")

        except Exception as e:
            errors.append(f"{email}: {str(e)}")
            skipped += 1

    return {
        "message": f"Monthly report cron completed",
        "sent": sent,
        "skipped": skipped,
        "errors": errors[:5] if errors else [],
    }


@router.post("/cron/newsletter")
async def cron_send_newsletter(
    request: Request,
    test_email: str = Query(None, description="If set, only sends to this email for testing"),
):
    """
    Send feature announcement newsletter to ALL registered users.
    Protected by CLEANUP_SECRET.
    """
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if not CLEANUP_SECRET or token != CLEANUP_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing secret")

    if not SMTP_USER or not SMTP_PASS:
        return {"message": "SMTP not configured", "sent": 0}

    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not available")

    if test_email:
        users = [{"id": "test_mode", "email": test_email}]
        print(f"🛠️ Menjalankan mode TEST Newsletter, mengirim HANYA ke: {test_email}")
    else:
        try:
            users_res = supabase_admin.table("profiles").select("id, email").execute()
            users = users_res.data or []
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch users: {e}")

    banner_url = "https://api-ocr.xyz/static/newsletter_banner.png"

    sent = 0
    skipped = 0
    errors = []

    for user in users:
        email = user.get("email")
        if not email:
            skipped += 1
            continue

        try:
            newsletter_html = get_newsletter_email_html(email, banner_url)
            
            result = send_email(
                to_email=email,
                subject=f"🚀 Pembaruan Fitur {BRAND_NAME} — {date.today().strftime('%B %Y')}",
                body_html=newsletter_html,
            )
            if result is True:
                sent += 1
            else:
                skipped += 1
                if isinstance(result, str):
                    errors.append(f"{email}: {result}")
        except Exception as e:
            errors.append(f"{email}: {str(e)}")
            skipped += 1

    return {
        "message": "Newsletter test run completed" if test_email else "Newsletter blast completed",
        "sent": sent,
        "skipped": skipped,
        "total_users_processed": len(users),
        "errors": errors[:10] if errors else [],
    }


@router.post("/cron/test-email")
async def cron_test_email(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if not CLEANUP_SECRET or token != CLEANUP_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing secret")

    to = request.query_params.get("to", "")
    if not to:
        return {"error": "Missing ?to=email@example.com"}

    debug = {
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "smtp_user": SMTP_USER[:8] + "..." if SMTP_USER else "(empty)",
        "smtp_pass_set": bool(SMTP_PASS),
        "smtp_from": SMTP_FROM,
        "to": to,
    }

    test_content = f"""
    <div style="font-family: Arial; padding: 24px;">
        <h2 style="color: #0a0a0a;">✅ Uji Coba Email {BRAND_NAME}</h2>
        <p style="color: #6b7280;">Ini adalah email percobaan dari platform {BRAND_NAME}.</p>
        <p style="color: #374151;">Jika Anda dapat membaca ini, fitur pengiriman email (SMTP) berfungsi dengan baik!</p>
        <hr style="border: 1px solid #e5e7eb; margin: 16px 0;">
        <p style="color: #9ca3af; font-size: 11px;">Dikirim pada {datetime.now().isoformat()}</p>
    </div>
    """
    test_html = get_base_email_template(test_content, to)

    result = send_email(
        to_email=to,
        subject=f"✅ Uji Coba Email {BRAND_NAME}",
        body_html=test_html,
    )

    return {
        "success": result is True,
        "error": result if isinstance(result, str) else None,
        "debug": debug,
    }
