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
    """Wraps content in a Dicoding-style email template."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 24px 32px; text-align: left; border-bottom: 1px solid #e5e7eb;">
                  <h1 style="color: #111827; font-size: 24px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">{BRAND_NAME}</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 32px;">
                  {content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #2c3e50; padding: 32px; text-align: center; color: #cbd5e1;">
                  <h4 style="color: #ffffff; font-size: 16px; margin: 0 0 16px;">Temukan kami</h4>
                  <p style="margin: 0 0 16px; font-size: 14px;">
                    {BRAND_NAME} Space, Jakarta, Indonesia
                  </p>
                  <p style="margin: 0 0 24px; font-size: 14px;">
                    &copy; {date.today().year} {BRAND_NAME} Indonesia
                  </p>
                  <hr style="border: 0; border-top: 1px solid #475569; margin: 0 0 24px;">
                  <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">
                    Keanggotaan & Berlangganan
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                    Pesan ini dikirim untuk <a href="mailto:{email_to}" style="color: #3498db; text-decoration: none;">{email_to}</a> karena Anda terdaftar dalam keanggotaan {BRAND_NAME} Indonesia.
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

def get_report_email_html(email: str, start: date, end: date, current_data: dict) -> str:
    username = email.split('@')[0]
    content = f"""
        <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Halo <strong>{username}</strong>,</p>
        <p style="color: #374151; font-size: 15px; margin: 0 0 24px; line-height: 1.6;">
            Berikut adalah laporan bulanan performa Anda untuk periode <strong>{start.strftime('%d %b %Y')}</strong> hingga <strong>{end.strftime('%d %b %Y')}</strong>. Laporan versi PDF telah kami lampirkan pada email ini.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 16px; font-weight: 600; color: #1f2937;">Skor Kepercayaan</td>
                <td style="padding: 12px 16px; text-align: right; font-weight: 600; color: #3b82f6;">{current_data.get('trust_score', 0)} / 1000</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 16px; color: #4b5563;">Pendapatan</td>
                <td style="padding: 12px 16px; text-align: right; color: #10b981; font-weight: 500;">Rp {current_data.get('total_revenue', 0):,.0f}</td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; color: #4b5563;">Statistik Dokumen</td>
                <td style="padding: 12px 16px; text-align: right; color: #4b5563;">
                    <span style="color: #10b981;">✅ {current_data.get('verified', 0)}</span> &nbsp;|&nbsp;
                    <span style="color: #f59e0b;">⏳ {current_data.get('processing', 0)}</span> &nbsp;|&nbsp;
                    <span style="color: #ef4444;">❌ {current_data.get('tampered', 0)}</span>
                </td>
            </tr>
        </table>
        
        <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.5;">
            Terima kasih telah mempercayakan pengelolaan dokumen Anda pada {BRAND_NAME}. 
            Jika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi tim dukungan kami.
        </p>
        <br>
        <p style="color: #374151; font-size: 15px; margin: 0;">Salam Semangat,</p>
        <p style="color: #1f2937; font-size: 15px; font-weight: 600; margin: 4px 0 0;">Tim {BRAND_NAME}</p>
    """
    return get_base_email_template(content, email)

def get_newsletter_email_html(email: str, banner_url: str) -> str:
    username = email.split('@')[0]
    content = f"""
        <div style="margin-bottom: 24px;">
            <img src="{banner_url}" alt="{BRAND_NAME} Update" style="width: 100%; height: auto; border-radius: 8px; display: block;" />
        </div>
        
        <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Halo <strong>{username}</strong>,</p>
        
        <p style="color: #374151; font-size: 15px; margin: 0 0 24px; line-height: 1.6;">
            Kami telah bekerja keras untuk membuat pengalaman Anda di <strong>{BRAND_NAME}</strong> menjadi lebih baik, cepat, dan handal. 
            Berikut adalah beberapa fitur dan pembaruan terbaru bulan ini yang dirancang khusus untuk meningkatkan produktivitas Anda:
        </p>

        <!-- Feature 1 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; border-left: 4px solid #10b981;">
            <tr>
                <td style="padding: 16px; background-color: #f8fafc;">
                    <h3 style="color: #065f46; font-size: 16px; margin: 0 0 8px;">🛡️ Deteksi Penipuan Cerdas</h3>
                    <p style="color: #4b5563; font-size: 14px; margin: 0; line-height: 1.5;">
                        Verifikasi keaslian dokumen berbasis AI dengan sistem skor 3 tingkat: Terverifikasi, 
                        Diproses, dan Dimanipulasi. Dokumen dengan tingkat kepercayaan rendah akan ditandai secara otomatis.
                    </p>
                </td>
            </tr>
        </table>

        <!-- Feature 2 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <tr>
                <td style="padding: 16px; background-color: #f8fafc;">
                    <h3 style="color: #1e40af; font-size: 16px; margin: 0 0 8px;">📊 Laporan PDF Otomatis</h3>
                    <p style="color: #4b5563; font-size: 14px; margin: 0; line-height: 1.5;">
                        Dapatkan laporan profesional setiap bulan langsung di kotak masuk Anda. 
                        Laporan ini mencakup tren skor kepercayaan, analitik pendapatan, dan statistik pemrosesan dokumen.
                    </p>
                </td>
            </tr>
        </table>

        <!-- Feature 3 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; border-left: 4px solid #f97316;">
            <tr>
                <td style="padding: 16px; background-color: #f8fafc;">
                    <h3 style="color: #9a3412; font-size: 16px; margin: 0 0 8px;">⚡ Mesin Pemindai 2x Lebih Cepat</h3>
                    <p style="color: #4b5563; font-size: 14px; margin: 0; line-height: 1.5;">
                        Pipeline OCR kami telah dioptimalkan dengan prapemrosesan gambar yang cerdas. 
                        Kini, waktu pemrosesan dokumen Anda dipangkas hingga setengahnya!
                    </p>
                </td>
            </tr>
        </table>

        <div style="text-align: center; margin: 32px 0 16px;">
            <a href="https://otaru.id" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 4px; border: 1px solid #111827;">
                Mulai Gunakan
            </a>
        </div>

        <p style="color: #374151; font-size: 15px; margin: 32px 0 0;">Salam hangat,</p>
        <p style="color: #111827; font-size: 15px; font-weight: 700; margin: 4px 0 0;">Tim {BRAND_NAME}</p>
    """
    return get_base_email_template(content, email)
