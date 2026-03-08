"""
Monthly/Annual Report — PDF generation + Email delivery.
Uses ReportLab for PDF and SMTP for email.
"""

import io
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from email.utils import formatdate, make_msgid
from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from config.database import get_db
from models.models import User
from utils.auth import get_current_active_user
from services.scan_helpers import get_supabase_admin

router = APIRouter()

# ── SMTP config (Fallback to Gmail/Resend via env) ───────────────────────────

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@ocr.web.id")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_billing_period(join_date: date, target_date: date | None = None):
    """Calculate billing period (month cycle) from user join date."""
    today = target_date or date.today()
    day = join_date.day
    try:
        period_start = today.replace(day=day)
    except ValueError:
        import calendar
        last_day = calendar.monthrange(today.year, today.month)[1]
        period_start = today.replace(day=min(day, last_day))
    
    if period_start > today:
        if today.month == 1:
            period_start = period_start.replace(year=today.year - 1, month=12)
        else:
            import calendar
            prev_month = today.month - 1
            last_day = calendar.monthrange(today.year, prev_month)[1]
            period_start = today.replace(month=prev_month, day=min(day, last_day))
    
    if period_start.month == 12:
        period_end = period_start.replace(year=period_start.year + 1, month=1) - timedelta(days=1)
    else:
        import calendar
        next_month = period_start.month + 1
        last_day = calendar.monthrange(period_start.year, next_month)[1]
        period_end = period_start.replace(month=next_month, day=min(day, last_day)) - timedelta(days=1)
    
    return period_start, period_end


def _fetch_report_data(user_id: str, period_start: date, period_end: date):
    """Fetch report data from Supabase for a specific period."""
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        return None
    
    start_iso = period_start.isoformat()
    end_iso = (period_end + timedelta(days=1)).isoformat()
    
    docs_res = supabase_admin.table("documents").select("status, created_at").eq(
        "user_id", user_id
    ).gte("created_at", start_iso).lt("created_at", end_iso).execute()
    
    docs = docs_res.data or []
    verified = sum(1 for d in docs if d["status"] == "verified")
    processing = sum(1 for d in docs if d["status"] == "processing")
    tampered = sum(1 for d in docs if d["status"] == "tampered")
    
    finance_res = supabase_admin.table("extracted_finance_data").select(
        "nominal_amount, field_confidence"
    ).eq("user_id", user_id).gte("created_at", start_iso).lt("created_at", end_iso).execute()
    
    finance = finance_res.data or []
    total_revenue = sum(
        float(f.get("nominal_amount", 0))
        for f in finance
        if f.get("field_confidence") != "low"
    )
    
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


def _generate_pdf(user_email: str, report_data: dict, months_data: list[dict]) -> bytes:
    """Generate PDF report using ReportLab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm,
                            leftMargin=20*mm, rightMargin=20*mm)
    styles = getSampleStyleSheet()
    elements = []

    dark = HexColor("#0a0a0a")
    gray = HexColor("#6b7280")
    white = HexColor("#ffffff")

    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=22, textColor=dark, spaceAfter=10)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=10, textColor=gray, spaceAfter=20)
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=14, textColor=dark, spaceAfter=8, spaceBefore=16)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, textColor=dark, spaceAfter=4)

    elements.append(Paragraph("DGTNZ Annual Performance Report", title_style))
    elements.append(Paragraph(f"User: {user_email} | Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}", subtitle_style))
    elements.append(Spacer(1, 5*mm))

    if report_data:
        elements.append(Paragraph("Current Period Summary", heading_style))
        elements.append(Paragraph(f"Period: {report_data['period_start']} — {report_data['period_end']}", body_style))
        elements.append(Spacer(1, 3*mm))

        summary_data = [
            ["Metric", "Value"],
            ["Trust Score", f"{report_data['trust_score']} / 1000"],
            ["Total Revenue (IDR)", f"Rp {report_data['total_revenue']:,.0f}"],
            ["Verified Documents", str(report_data['verified'])],
            ["Processing Documents", str(report_data['processing'])],
            ["Tampered Documents", str(report_data['tampered'])],
            ["Total Documents", str(report_data['total_docs'])],
        ]
        t = Table(summary_data, colWidths=[120*mm, 50*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), dark),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, gray),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f9fafb"), white]),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(t)

    if months_data:
        elements.append(Spacer(1, 8*mm))
        elements.append(Paragraph("Monthly Performance History", heading_style))
        elements.append(Spacer(1, 3*mm))

        history_data = [["Period", "Score", "Revenue", "Verified", "Processing", "Tampered"]]
        for m in months_data:
            history_data.append([
                f"{m['period_start'][:7]}",
                str(m.get("trust_score", 0)),
                f"Rp {m.get('total_revenue', 0):,.0f}",
                str(m.get("verified", 0)),
                str(m.get("processing", 0)),
                str(m.get("tampered", 0)),
            ])

        ht = Table(history_data, colWidths=[30*mm, 20*mm, 50*mm, 20*mm, 20*mm, 20*mm])
        ht.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), dark),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, gray),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f9fafb"), white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(ht)

    elements.append(Spacer(1, 15*mm))
    elements.append(Paragraph(
        "This report was automatically generated by DGTNZ OCR Platform (ocr.web.id). "
        "Data is based on fraud detection scans processed during the reporting period.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=gray)
    ))

    doc.build(elements)
    return buffer.getvalue()


def _send_email(to_email: str, subject: str, body_html: str, pdf_bytes: bytes, pdf_filename: str):
    """Send email with HTML and optional PDF attachment via SMTP."""
    if not SMTP_USER or not SMTP_PASS:
        print("SMTP not configured, skipping email")
        return "SMTP_USER or SMTP_PASS not set in env"

    msg = MIMEMultipart("mixed")
    # Tampilkan display name jika dari Gmail atau Resend
    msg["From"] = f"DGTNZ System <{SMTP_FROM}>" 
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="ocr.web.id")
    msg["Reply-To"] = SMTP_FROM

    alt_part = MIMEMultipart("alternative")
    
    plain_text = "This is an automated email from DGTNZ OCR Platform. Please view this email using an HTML-compatible client."
    alt_part.attach(MIMEText(plain_text, "plain", "utf-8"))
    
    safe_body_html = body_html.replace("\r\n", "\n").replace("\n", "\r\n")
    html_part = MIMEText(safe_body_html, "html", "utf-8")
    alt_part.attach(html_part)
    
    msg.attach(alt_part)

    if pdf_bytes and pdf_filename:
        part = MIMEBase("application", "pdf")
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="{pdf_filename}"')
        msg.attach(part)

    try:
        import ssl
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, local_hostname="ocr.web.id") as server:
            server.set_debuglevel(1)
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
            
        print(f"Email sent to {to_email}")
        return True
    except Exception as e:
        err = f"SMTP error: {type(e).__name__}: {e}"
        print(f"Email send failed to {to_email}: {err}")
        return err


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
        start, end = _get_billing_period(join_date, today)
    elif period == "last":
        curr_start, _ = _get_billing_period(join_date, today)
        prev_day = curr_start - timedelta(days=1)
        start, end = _get_billing_period(join_date, prev_day)
    elif period == "3months":
        curr_start, _ = _get_billing_period(join_date, today)
        start = curr_start
        for _ in range(2):
            prev_day = start - timedelta(days=1)
            start, _ = _get_billing_period(join_date, prev_day)
        end = today
    else:
        start = join_date
        end = today

    data = _fetch_report_data(user_id, start, end)
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
        start, end = _get_billing_period(join_date, current_date)
        if start < join_date:
            break
        data = _fetch_report_data(user_id, start, end)
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

    start, end = _get_billing_period(join_date, today)
    current_data = _fetch_report_data(user_id, start, end)

    history = []
    current_date = today
    for _ in range(12):
        s, e = _get_billing_period(join_date, current_date)
        if s < join_date:
            break
        data = _fetch_report_data(user_id, s, e)
        if data:
            history.append(data)
        current_date = s - timedelta(days=1)
        if current_date < join_date:
            break
    history.reverse()

    pdf_bytes = _generate_pdf(current_user.email, current_data, history)
    filename = f"DGTNZ_Report_{today.strftime('%Y%m%d')}.pdf"

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
    start, end = _get_billing_period(join_date, today)
    current_data = _fetch_report_data(user_id, start, end)

    history = []
    current_date = today
    for _ in range(12):
        s, e = _get_billing_period(join_date, current_date)
        if s < join_date:
            break
        data = _fetch_report_data(user_id, s, e)
        if data:
            history.append(data)
        current_date = s - timedelta(days=1)
        if current_date < join_date:
            break
    history.reverse()

    pdf_bytes = _generate_pdf(current_user.email, current_data, history)
    filename = f"DGTNZ_Report_{today.strftime('%Y%m%d')}.pdf"

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0a0a0a;">Your DGTNZ Monthly Report</h2>
        <p style="color: #6b7280;">Hi {current_user.email.split('@')[0]},</p>
        <p style="color: #374151;">
            Your performance report for period <strong>{start.strftime('%d %b %Y')}</strong> — 
            <strong>{end.strftime('%d %b %Y')}</strong> is attached.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #0a0a0a; color: white;">
                <td style="padding: 10px; font-weight: bold;">Trust Score</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">{current_data.get('trust_score', 0)} / 1000</td>
            </tr>
            <tr style="background: #f3f4f6;">
                <td style="padding: 10px;">Revenue</td>
                <td style="padding: 10px; text-align: right;">Rp {current_data.get('total_revenue', 0):,.0f}</td>
            </tr>
            <tr>
                <td style="padding: 10px;">Documents</td>
                <td style="padding: 10px; text-align: right;">
                    Verified: {current_data.get('verified', 0)} |
                    Processing: {current_data.get('processing', 0)} |
                    Tampered: {current_data.get('tampered', 0)}
                </td>
            </tr>
        </table>
        <p style="color: #9ca3af; font-size: 12px;">
            This email was sent by DGTNZ OCR Platform (ocr.web.id).<br>
            Full PDF report is attached.
        </p>
    </div>
    """

    success = _send_email(current_user.email, f"DGTNZ Report - {today.strftime('%B %Y')}", body_html, pdf_bytes, filename)

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

            start, end = _get_billing_period(join_date, today)
            current_data = _fetch_report_data(user_id, start, end)

            if not current_data or current_data.get("total_docs", 0) == 0:
                skipped += 1
                continue

            history = []
            current_date = today
            for _ in range(12):
                s, e = _get_billing_period(join_date, current_date)
                if s < join_date:
                    break
                data = _fetch_report_data(user_id, s, e)
                if data:
                    history.append(data)
                current_date = s - timedelta(days=1)
                if current_date < join_date:
                    break
            history.reverse()

            pdf_bytes = _generate_pdf(email, current_data, history)
            filename = f"DGTNZ_Report_{today.strftime('%Y%m%d')}.pdf"

            body_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0a0a0a;">Your Monthly DGTNZ Report</h2>
                <p style="color: #6b7280;">Hi {email.split('@')[0]},</p>
                <p style="color: #374151;">
                    Your automatic monthly report for <strong>{start.strftime('%d %b %Y')}</strong> — 
                    <strong>{end.strftime('%d %b %Y')}</strong> is ready.
                </p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr style="background: #0a0a0a; color: white;">
                        <td style="padding: 8px;">Trust Score</td>
                        <td style="padding: 8px; text-align: right;">{current_data.get('trust_score', 0)} / 1000</td>
                    </tr>
                    <tr style="background: #f3f4f6;">
                        <td style="padding: 8px;">Revenue</td>
                        <td style="padding: 8px; text-align: right;">Rp {current_data.get('total_revenue', 0):,.0f}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px;">Docs</td>
                        <td style="padding: 8px; text-align: right;">
                            Verified: {current_data.get('verified', 0)} | Processing: {current_data.get('processing', 0)} | Tampered: {current_data.get('tampered', 0)}
                        </td>
                    </tr>
                </table>
                <p style="color: #9ca3af; font-size: 11px;">
                    Auto-generated by DGTNZ (ocr.web.id). PDF attached.
                </p>
            </div>
            """

            result = _send_email(
                email,
                f"DGTNZ Monthly Report - {today.strftime('%B %Y')}",
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
    Send feature announcement newsletter with modern SaaS design.
    Gunakan ?test_email=email@kamu.com untuk testing.
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
            result = _send_email(
                to_email=email,
                subject="🚀 What's New in DGTNZ - March 2026 Update",
                body_html=newsletter_html,
                pdf_bytes=b"",
                pdf_filename="",
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

    test_html = f"""
    <div style="font-family: Arial; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0a0a0a;">DGTNZ Test Email</h2>
        <p style="color: #6b7280;">This is a test email from the DGTNZ platform.</p>
        <p style="color: #374151;">If you can read this, SMTP is working perfectly with the new setup!</p>
        <hr style="border: 1px solid #e5e7eb; margin: 16px 0;">
        <p style="color: #9ca3af; font-size: 11px;">Sent at {datetime.now().isoformat()}</p>
    </div>
    """

    result = _send_email(
        to_email=to,
        subject="DGTNZ Setup Status",
        body_html=test_html,
        pdf_bytes=b"",
        pdf_filename="",
    )

    return {
        "success": result is True,
        "error": result if isinstance(result, str) else None,
        "debug": debug,
    }
