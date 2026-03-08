import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from email.utils import formatdate, make_msgid
from datetime import date

# ── SMTP config (Sumopod / ocr.wtf or OtaruChain) ─────────────────────────────

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.sumopod.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@otaru.id")
BRAND_NAME = "OtaruChain"

def send_email(to_email: str, subject: str, body_html: str, pdf_bytes: bytes = None, pdf_filename: str = None):
    """Send email with optional PDF attachment via SMTP."""
    if not SMTP_USER or not SMTP_PASS:
        print("⚠️ SMTP not configured, skipping email")
        return "SMTP_USER or SMTP_PASS not set in env"

    msg = MIMEMultipart("mixed")
    msg["From"] = f"{BRAND_NAME} <{SMTP_FROM}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="otaru.id")
    msg["Reply-To"] = SMTP_FROM

    safe_body_html = body_html.replace("\r\n", "\n").replace("\n", "\r\n")
    
    alt_part = MIMEMultipart("alternative")
    alt_part.attach(MIMEText(safe_body_html, "html"))
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
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, local_hostname="otaru.id") as server:
            server.set_debuglevel(1)
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
            
        print(f"✅ Email sent to {to_email}")
        return True
    except Exception as e:
        err = f"SMTP error: {type(e).__name__}: {e}"
        print(f"❌ Email send failed to {to_email}: {err}")
        return err


def get_base_email_template(content: str, email_to: str) -> str:
    """Wraps content in a Digdaya/Dicoding-style clean email template."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; color: #000000;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 10px 0;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: #ffffff;">
              <tr>
                <td style="padding: 0 24px; text-align: left;">
                  {content}
                </td>
              </tr>
              <tr>
                <td style="padding: 0 24px 24px; text-align: left;">
                  <p style="margin: 0 0 4px; font-size: 14px; color: #000000;">Salam hangat,</p>
                  <p style="margin: 0; font-size: 14px; font-weight: bold; color: #000000;">Tim {BRAND_NAME}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


def get_report_email_html(email: str, start: date, end: date, current_data: dict) -> str:
    # Sapaan kapital seperti Digdaya
    username = email.split('@')[0].upper()
    content = f"""
        <p style="font-size: 14px; margin: 0 0 16px; color: #000000;">Halo, {username}</p>
        
        <p style="font-size: 14px; margin: 0 0 24px; line-height: 1.6; color: #000000;">
            Berikut adalah laporan bulanan performa Anda di <strong>{BRAND_NAME}</strong> untuk periode <strong>{start.strftime('%d %b %Y')}</strong> hingga <strong>{end.strftime('%d %b %Y')}</strong>. Laporan versi PDF lengkap telah kami lampirkan pada email ini.
        </p>
        
        <hr style="border: 0; border-top: 2px solid #374151; margin: 24px 0;">
        
        <div style="text-align: center;">
            <h3 style="font-size: 16px; margin: 0 0 16px; color: #000000;">
                Ringkasan Laporan <span style="background-color: #fef08a; padding: 2px 4px;">{start.strftime('%B %Y')}</span>
            </h3>
        </div>
        
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 24px; margin: 0 auto 24px; text-align: center; max-width: 450px;">
            <p style="font-size: 14px; margin: 0 0 8px; font-weight: bold; color: #000000;">Skor Kepercayaan</p>
            <p style="font-size: 18px; margin: 0 0 16px; font-weight: bold; color: #dc2626;">{current_data.get('trust_score', 0)} / 1000</p>
            
            <p style="font-size: 14px; margin: 0 0 8px; font-weight: bold; color: #000000;">Pendapatan Tercatat</p>
            <p style="font-size: 18px; margin: 0 0 16px; font-weight: bold; color: #1d4ed8;">Rp {current_data.get('total_revenue', 0):,.0f}</p>
            
            <p style="font-size: 14px; margin: 0 0 8px; font-weight: bold; color: #000000;">Statistik Dokumen</p>
            <p style="font-size: 14px; margin: 0; color: #374151;">
                ✅ Terverifikasi: {current_data.get('verified', 0)} | 
                ⏳ Diproses: {current_data.get('processing', 0)} | 
                ❌ Dimanipulasi: {current_data.get('tampered', 0)}
            </p>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #d1d5db; margin: 24px 0;">
        
        <p style="font-size: 14px; margin: 0 0 16px; line-height: 1.6; color: #000000;">
            Terima kasih telah mempercayakan pengelolaan dokumen Anda pada {BRAND_NAME}. 
            Semoga laporan ini dapat membantu mengevaluasi dan memperkuat produktivitasmu. Semangat ✨
        </p>
        
        <hr style="border: 0; border-top: 2px solid #374151; margin: 24px 0;">
        
        <div style="text-align: left;">
            <h3 style="font-size: 16px; margin: 0 0 8px; color: #000000;">Butuh Bantuan?</h3>
            <p style="font-size: 14px; margin: 0 0 24px; line-height: 1.6; color: #000000;">
                Jika mengalami kendala atau memiliki pertanyaan, silakan balas pesan ini.
            </p>
        </div>
    """
    return get_base_email_template(content, email)


def get_newsletter_email_html(email: str, banner_url: str) -> str:
    # Sapaan kapital
    username = email.split('@')[0].upper()
    content = f"""
        <div style="margin-bottom: 24px;">
            <img src="{banner_url}" alt="Banner Update" style="width: 100%; height: auto; display: block;" />
        </div>
        
        <p style="font-size: 14px; margin: 0 0 16px; color: #000000;">Halo, {username}</p>
        
        <p style="font-size: 14px; margin: 0 0 16px; line-height: 1.6; color: #000000;">
            Terima kasih atas antusiasme kamu dalam menggunakan <strong>{BRAND_NAME}</strong>! 🚀
        </p>

        <p style="font-size: 14px; margin: 0 0 16px; line-height: 1.6; color: #000000;">
            Pembaruan bulan ini lebih istimewa karena semua pengguna akan mendapat akses fitur secara gratis.
        </p>

        <p style="font-size: 14px; margin: 0 0 24px; line-height: 1.6; color: #000000;">
            Kami selaku pengembang sangat antusias dan berharap kamu menjadi salah satu yang memanfaatkannya. 
            <span style="background-color: #fef08a; padding: 2px 4px; font-weight: bold;">{BRAND_NAME}</span> terus berinovasi dalam menyediakan teknologi yang dibutuhkan oleh para talenta digital.
        </p>

        <hr style="border: 0; border-top: 2px solid #374151; margin: 24px 0;">

        <div style="text-align: center;">
            <h3 style="font-size: 16px; margin: 0 0 16px; color: #000000;">
                Mulai eksplorasimu <span style="background-color: #fef08a; padding: 2px 4px;">di</span> {BRAND_NAME}
            </h3>
        </div>

        <p style="font-size: 14px; margin: 0 0 16px; line-height: 1.6; color: #000000;">
            Sebagai bentuk dukungan untuk membantu peserta mempersiapkan dokumen dan strategi terbaik, 
            <span style="background-color: #fef08a; padding: 2px 4px; font-weight: bold;">{BRAND_NAME}</span> menyediakan fitur baru.
        </p>
        
        <p style="font-size: 14px; margin: 0 0 8px; line-height: 1.6; color: #000000;">
            Melalui pembaruan ini, kamu akan mendapatkan:
        </p>

        <ul style="font-size: 14px; line-height: 1.6; margin-bottom: 24px; padding-left: 20px; color: #000000;">
            <li>Mengoptimalkan produktivitas dengan <strong>Deteksi Penipuan Cerdas</strong> berbasis AI.</li>
            <li>Mempercepat proses evaluasi dengan <strong>Laporan PDF Otomatis</strong>.</li>
            <li>Memperkuat kualitas solusi dengan <strong>Mesin Pemindai 2x Lebih Cepat</strong>.</li>
        </ul>

        <hr style="border: 0; border-top: 1px solid #d1d5db; margin: 24px 0;">

        <div style="text-align: center;">
            <h3 style="font-size: 16px; margin: 0 0 16px; color: #000000;">Status Fitur</h3>
            <p style="font-size: 14px; margin: 0 0 16px; color: #000000;">Fitur ini telah diaktifkan untuk akunmu.</p>
            
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 24px; margin: 0 auto 24px; text-align: center; max-width: 450px;">
                <p style="font-size: 14px; margin: 0 0 8px; font-weight: bold; color: #000000;">Status Keanggotaan</p>
                <p style="font-size: 18px; margin: 0 0 8px; font-weight: bold; color: #dc2626;">AKTIF - PRO TIER</p>
                <p style="font-size: 12px; margin: 0; color: #6b7280;">Batas Akhir Akses Gratis: 31 Desember 2026 pukul 23:59:59 WIB</p>
            </div>
        </div>

        <hr style="border: 0; border-top: 1px solid #d1d5db; margin: 24px 0;">

        <div style="text-align: center;">
            <h3 style="font-size: 16px; margin: 0 0 16px; color: #000000;">Panduan Akses Dashboard</h3>
            <p style="font-size: 14px; margin: 0 0 16px; color: #000000;">Akses fitur terbaru dapat dilakukan melalui tautan berikut.</p>
            
            <a href="https://ocr.web.id" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; padding: 12px 32px; border-radius: 6px; margin-bottom: 24px;">
                Buka Dashboard
            </a>
        </div>

        <p style="font-size: 14px; margin: 0 0 16px; line-height: 1.6; color: #000000;">
            Semoga pembaruan ini dapat membantu memperkuat produktivitasmu. Semangat ✨
        </p>

        <hr style="border: 0; border-top: 2px solid #374151; margin: 24px 0;">

        <div style="text-align: left;">
            <h3 style="font-size: 16px; margin: 0 0 8px; color: #000000;">Butuh Bantuan?</h3>
            <p style="font-size: 14px; margin: 0 0 24px; line-height: 1.6; color: #000000;">
                Jika mengalami kendala atau memiliki pertanyaan, silakan balas pesan ini.
            </p>
        </div>
    """
    return get_base_email_template(content, email)
