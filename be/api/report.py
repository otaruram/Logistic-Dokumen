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


# ── Cron: Auto-send email reports ────────────────────────────────────────────

CLEANUP_SECRET = os.getenv("CLEANUP_SECRET", "")

@router.post("/cron/send-all")
async def cron_send_all_reports(
    request: Request,
):
    """
    Cron endpoint: auto-send monthly email reports to ALL active users.
    Protected by CLEANUP_SECRET Bearer token (same as cleanup cron).
    """
    # Auth check — same secret as cleanup cron
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

            # Current period
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


# ── Newsletter / Feature Announcement Blast ──────────────────────────────────

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

    # Fitur Filter Testing agar tidak nge-blast ke semua orang saat tes
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

        # HTML di-generate di dalam loop agar sapaan (Hi {nama}) dinamis per user
        user_name = email.split('@')[0]
        
        newsletter_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DGTNZ Update</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f3f4f6; padding: 40px 0;">
                <tr>
                    <td align="center">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                            
                            <tr>
                                <td style="background-color: #111827; text-align: center;">
                                    <img src="{banner_url}" alt="DGTNZ OCR Platform" style="width: 100%; max-width: 600px; height: auto; display: block;" />
                                </td>
                            </tr>
                            
                            <tr>
                                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                                    <h1 style="margin: 0; color: #111827; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🚀 Platform Update</h1>
                                    <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 15px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">March 2026</p>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 0 40px 20px 40px;">
                                    <p style="margin: 0; color: #374151; font-size: 16px; line-height: 24px;">
                                        Hi <strong>{user_name}</strong>,<br><br>
                                        We've been working hard behind the scenes to make the DGTNZ OCR Platform faster, smarter, and more reliable. Here are the exciting new features we've shipped for you this month:
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 10px 40px;">
                                    
                                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 16px; background-color: #f0fdf4; border-radius: 12px; border-left: 6px solid #10b981;">
                                        <tr>
                                            <td style="padding: 20px;">
                                                <h3 style="margin: 0 0 8px 0; color: #065f46; font-size: 16px; font-weight: 700;">🛡️ Smart Fraud Detection</h3>
                                                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 22px;">
                                                    AI-powered document authenticity verification with 3-tier confidence scoring. Low-confidence documents are now automatically flagged for your review.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>

                                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 16px; background-color: #eff6ff; border-radius: 12px; border-left: 6px solid #3b82f6;">
                                        <tr>
                                            <td style="padding: 20px;">
                                                <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 16px; font-weight: 700;">📊 Automated PDF Reports</h3>
                                                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 22px;">
                                                    Receive professional monthly PDF reports straight to your inbox, detailing your trust score trends, revenue analytics, and document processing stats.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>

                                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 16px; background-color: #fff7ed; border-radius: 12px; border-left: 6px solid #f97316;">
                                        <tr>
                                            <td style="padding: 20px;">
                                                <h3 style="margin: 0 0 8px 0; color: #9a3412; font-size: 16px; font-weight: 700;">⚡ 2x Faster Scanning Engine</h3>
                                                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 22px;">
                                                    Our optimized OCR pipeline and intelligent image preprocessing now cut document processing time in half.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>

                                </td>
                            </tr>

                            <tr>
                                <td align="center" style="padding: 30px 40px 40px 40px;">
                                    <a href="https://ocr.web.id/dashboard" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                                        Explore New Features
                                    </a>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 0 40px;">
                                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 30px 40px; text-align: center; background-color: #f9fafb;">
                                    <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px; line-height: 20px;">
                                        You're receiving this email because you're a registered user at DGTNZ.
                                    </p>
                                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                        © 2026 DGTNZ OCR Platform.<br>
                                        <a href="https://ocr.web.id" style="color: #6b7280; text-decoration: underline;">ocr.web.id</a>
                                    </p>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

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


# ── Test Single Email ─────────────────────────────────────────────────────────

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
