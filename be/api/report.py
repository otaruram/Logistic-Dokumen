"""
Monthly/Annual Report — PDF generation + Email delivery.
Uses ReportLab for PDF and SMTP (Sumopod) for email.
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

# ── SMTP config (Sumopod / ocr.wtf) ──────────────────────────────────────────

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.sumopod.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@ocr.wtf")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_billing_period(join_date: date, target_date: date | None = None):
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


def _fetch_report_data(user_id: str, period_start: date, period_end: date):
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

    # Colors
    dark = HexColor("#0a0a0a")
    green = HexColor("#10b981")
    yellow = HexColor("#f59e0b")
    red = HexColor("#ef4444")
    gray = HexColor("#6b7280")
    white = HexColor("#ffffff")

    # Title style
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=22,
                                  textColor=dark, spaceAfter=10)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=10,
                                     textColor=gray, spaceAfter=20)
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=14,
                                    textColor=dark, spaceAfter=8, spaceBefore=16)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10,
                                 textColor=dark, spaceAfter=4)

    # Header
    elements.append(Paragraph("📊 DGTNZ Annual Performance Report", title_style))
    elements.append(Paragraph(
        f"User: {user_email} | Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}",
        subtitle_style
    ))
    elements.append(Spacer(1, 5*mm))

    # Current Period Summary
    if report_data:
        elements.append(Paragraph("Current Period Summary", heading_style))
        elements.append(Paragraph(
            f"Period: {report_data['period_start']} — {report_data['period_end']}",
            body_style
        ))
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

    # Monthly History
    if months_data:
        elements.append(Spacer(1, 8*mm))
        elements.append(Paragraph("Monthly Performance History", heading_style))
        elements.append(Spacer(1, 3*mm))

        history_data = [["Period", "Score", "Revenue", "✓", "⏳", "✗"]]
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

    # Footer
    elements.append(Spacer(1, 15*mm))
    elements.append(Paragraph(
        "This report was automatically generated by DGTNZ OCR Platform (ocr.wtf). "
        "Data is based on fraud detection scans processed during the reporting period.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=gray)
    ))

    doc.build(elements)
    return buffer.getvalue()


def _send_email(to_email: str, subject: str, body_html: str, pdf_bytes: bytes, pdf_filename: str):
    """Send email with PDF attachment via SMTP. Returns True on success, error string on failure."""
    if not SMTP_USER or not SMTP_PASS:
        print("⚠️ SMTP not configured, skipping email")
        return "SMTP_USER or SMTP_PASS not set in env"

    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="ocr.web.id")

    msg.attach(MIMEText(body_html, "html"))

    # PDF attachment (skip if empty — e.g. newsletter)
    if pdf_bytes and pdf_filename:
        part = MIMEBase("application", "pdf")
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={pdf_filename}")
        msg.attach(part)

    try:
        import ssl
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"✅ Email sent to {to_email}")
        return True
    except Exception as e:
        err = f"SMTP error: {type(e).__name__}: {e}"
        print(f"❌ Email send failed to {to_email}: {err}")
        return err


# ── API Endpoints ────────────────────────────────────────────────────────────

@router.get("/period-data")
async def get_period_data(
    period: str = Query("all", regex="^(all|current|last|3months)$"),
    current_user: User = Depends(get_current_active_user),
):
    """Get dashboard data filtered by billing period."""
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not available")

    user_id = str(current_user.id)

    # Get user join date from Supabase auth
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
        join_date = datetime.fromisoformat(auth_user.user.created_at.replace("Z", "+00:00")).date()
    except Exception:
        join_date = date.today()

    today = date.today()

    if period == "current":
        start, end = _get_billing_period(join_date, today)
    elif period == "last":
        # Go to previous period
        curr_start, _ = _get_billing_period(join_date, today)
        prev_day = curr_start - timedelta(days=1)
        start, end = _get_billing_period(join_date, prev_day)
    elif period == "3months":
        # Go back 3 periods
        curr_start, _ = _get_billing_period(join_date, today)
        start = curr_start
        for _ in range(2):
            prev_day = start - timedelta(days=1)
            start, _ = _get_billing_period(join_date, prev_day)
        end = today
    else:  # all
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
    """Get monthly history for annual report (up to 24 months)."""
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

    # Walk back through billing periods
    current_date = today
    for _ in range(months):
        start, end = _get_billing_period(join_date, current_date)
        if start < join_date:
            break
        data = _fetch_report_data(user_id, start, end)
        if data:
            history.append(data)
        # Go to previous period
        current_date = start - timedelta(days=1)
        if current_date < join_date:
            break

    history.reverse()  # Oldest first
    return {"history": history, "join_date": join_date.isoformat()}


@router.get("/download-pdf")
async def download_report_pdf(
    current_user: User = Depends(get_current_active_user),
):
    """Generate and download annual report PDF."""
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
    start, end = _get_billing_period(join_date, today)
    current_data = _fetch_report_data(user_id, start, end)

    # History (12 months)
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
    """Generate PDF report and send via email to user."""
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

    # History
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
        <h2 style="color: #0a0a0a;">📊 Your DGTNZ Monthly Report</h2>
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
                    ✅ {current_data.get('verified', 0)} |
                    ⏳ {current_data.get('processing', 0)} |
                    ❌ {current_data.get('tampered', 0)}
                </td>
            </tr>
        </table>
        <p style="color: #9ca3af; font-size: 12px;">
            This email was sent by DGTNZ OCR Platform (ocr.wtf).<br>
            Full PDF report is attached.
        </p>
    </div>
    """

    success = _send_email(current_user.email, f"📊 DGTNZ Report — {today.strftime('%B %Y')}", body_html, pdf_bytes, filename)

    if success:
        return {"message": "Report sent to your email", "email": current_user.email}
    else:
        # Even if email fails, return the PDF download URL
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
    
    VPS crontab example:
    0 9 1 * * curl -s -X POST https://api-ocr.xyz/api/report/cron/send-all \
      -H "Authorization: Bearer YOUR_CLEANUP_SECRET"
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

    # Get all users
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
            # Get join date
            try:
                auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
                join_date = datetime.fromisoformat(
                    auth_user.user.created_at.replace("Z", "+00:00")
                ).date()
            except Exception:
                join_date = today

            # Current period
            start, end = _get_billing_period(join_date, today)
            current_data = _fetch_report_data(user_id, start, end)

            if not current_data or current_data.get("total_docs", 0) == 0:
                skipped += 1
                continue

            # History
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
                <h2 style="color: #0a0a0a;">📊 Your Monthly DGTNZ Report</h2>
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
                            ✅{current_data.get('verified', 0)} ⏳{current_data.get('processing', 0)} ❌{current_data.get('tampered', 0)}
                        </td>
                    </tr>
                </table>
                <p style="color: #9ca3af; font-size: 11px;">
                    Auto-generated by DGTNZ (ocr.wtf). PDF attached.
                </p>
            </div>
            """

            result = _send_email(
                email,
                f"📊 DGTNZ Monthly Report — {today.strftime('%B %Y')}",
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
):
    """
    Send feature announcement newsletter to ALL registered users.
    Protected by CLEANUP_SECRET.

    VPS one-time cron:
    0 9 13 3 * curl -s -X POST https://api-ocr.xyz/api/report/cron/newsletter \
      -H "Authorization: Bearer YOUR_CLEANUP_SECRET"
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

    try:
        users_res = supabase_admin.table("profiles").select("id, email").execute()
        users = users_res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {e}")

    # Banner image URL (hosted via API static)
    banner_url = "https://api-ocr.xyz/static/newsletter_banner.png"

    newsletter_html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Banner -->
        <tr>
          <td style="padding: 0;">
            <img src="{banner_url}" alt="DGTNZ OCR Platform" style="width: 100%; height: auto; display: block;" />
          </td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); padding: 32px 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px;">🚀 What's New in DGTNZ</h1>
            <p style="color: #9ca3af; font-size: 14px; margin: 0;">March 2026 — Platform Update</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding: 28px 32px 8px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0;">
              Hi there! 👋<br><br>
              We've been working hard to make DGTNZ even better. Here are the exciting new features
              we've shipped this month:
            </p>
          </td>
        </tr>

        <!-- Feature 1: Fraud Detection -->
        <tr>
          <td style="padding: 16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border-radius: 10px; border-left: 4px solid #10b981;">
              <tr>
                <td style="padding: 16px 20px;">
                  <h3 style="color: #065f46; font-size: 15px; margin: 0 0 6px;">🛡️ Smart Fraud Detection</h3>
                  <p style="color: #374151; font-size: 13px; margin: 0; line-height: 1.5;">
                    AI-powered document authenticity verification with 3-tier confidence scoring: 
                    <strong style="color: #10b981;">Verified</strong>, 
                    <strong style="color: #f59e0b;">Processing</strong>, and 
                    <strong style="color: #ef4444;">Tampered</strong>. 
                    Low-confidence documents are automatically flagged.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Feature 2: Annual Report -->
        <tr>
          <td style="padding: 4px 32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #eff6ff; border-radius: 10px; border-left: 4px solid #3b82f6;">
              <tr>
                <td style="padding: 16px 20px;">
                  <h3 style="color: #1e40af; font-size: 15px; margin: 0 0 6px;">📊 Annual Performance Report</h3>
                  <p style="color: #374151; font-size: 13px; margin: 0; line-height: 1.5;">
                    Download professional PDF reports with monthly trust score trends, revenue analytics, 
                    and document statistics. Also available via automated email delivery.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Feature 3: Dashboard -->
        <tr>
          <td style="padding: 4px 32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #fdf4ff; border-radius: 10px; border-left: 4px solid #a855f7;">
              <tr>
                <td style="padding: 16px 20px;">
                  <h3 style="color: #6b21a8; font-size: 15px; margin: 0 0 6px;">📈 Enhanced Dashboard</h3>
                  <p style="color: #374151; font-size: 13px; margin: 0; line-height: 1.5;">
                    Period selector (All Time / Monthly), real-time trust score, currency toggle (IDR/USD), 
                    and monthly performance bar charts — all in one view.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Feature 4: Performance -->
        <tr>
          <td style="padding: 4px 32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #fff7ed; border-radius: 10px; border-left: 4px solid #f97316;">
              <tr>
                <td style="padding: 16px 20px;">
                  <h3 style="color: #9a3412; font-size: 15px; margin: 0 0 6px;">⚡ 2x Faster Scanning</h3>
                  <p style="color: #374151; font-size: 13px; margin: 0; line-height: 1.5;">
                    Optimized OCR pipeline with intelligent image preprocessing. 
                    Documents are now processed nearly twice as fast with lower server resource usage.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Feature 5: Pagination -->
        <tr>
          <td style="padding: 4px 32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 10px; border-left: 4px solid #64748b;">
              <tr>
                <td style="padding: 16px 20px;">
                  <h3 style="color: #334155; font-size: 15px; margin: 0 0 6px;">📄 Paginated History</h3>
                  <p style="color: #374151; font-size: 13px; margin: 0; line-height: 1.5;">
                    Scan history and fraud logs now display 10 records per page with smooth pagination. 
                    Navigate through your records easily with numbered page buttons.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding: 24px 32px; text-align: center;">
            <a href="https://ocr.wtf" 
               style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
                      color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; 
                      font-size: 15px; font-weight: 600; letter-spacing: 0.3px;
                      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
              Try It Now →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center; line-height: 1.6;">
              You are receiving this email because you have an account on DGTNZ OCR Platform.<br>
              © 2026 DGTNZ — Powered by <a href="https://ocr.wtf" style="color: #3b82f6; text-decoration: none;">ocr.web.id</a>
            </p>
          </td>
        </tr>

      </table>
    </body>
    </html>
    """

    sent = 0
    skipped = 0
    errors = []

    for user in users:
        email = user.get("email")
        if not email:
            skipped += 1
            continue

        try:
            result = _send_email(
                to_email=email,
                subject="🚀 What's New in DGTNZ — March 2026 Update",
                body_html=newsletter_html,
                pdf_bytes=b"",  # No PDF attachment for newsletter
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
        "message": "Newsletter blast completed",
        "sent": sent,
        "skipped": skipped,
        "total_users": len(users),
        "errors": errors[:10] if errors else [],
    }


# ── Test Single Email ─────────────────────────────────────────────────────────

@router.post("/cron/test-email")
async def cron_test_email(request: Request):
    """
    Send a test email to a single address. For debugging SMTP.
    Usage: curl -X POST 'https://api-ocr.xyz/api/report/cron/test-email?to=okitr52@gmail.com' \
      -H 'Authorization: Bearer YOUR_SECRET'
    """
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if not CLEANUP_SECRET or token != CLEANUP_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing secret")

    to = request.query_params.get("to", "")
    if not to:
        return {"error": "Missing ?to=email@example.com"}

    # Debug info
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
        <h2 style="color: #0a0a0a;">✅ DGTNZ Test Email</h2>
        <p style="color: #6b7280;">This is a test email from the DGTNZ platform.</p>
        <p style="color: #374151;">If you can read this, SMTP is working!</p>
        <hr style="border: 1px solid #e5e7eb; margin: 16px 0;">
        <p style="color: #9ca3af; font-size: 11px;">Sent at {datetime.now().isoformat()}</p>
    </div>
    """

    result = _send_email(
        to_email=to,
        subject="✅ DGTNZ Test Email",
        body_html=test_html,
        pdf_bytes=b"",
        pdf_filename="",
    )

    return {
        "success": result is True,
        "error": result if isinstance(result, str) else None,
        "debug": debug,
    }

