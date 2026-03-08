import io
from datetime import datetime

BRAND_NAME = "OtaruChain"

def generate_pdf(user_email: str, report_data: dict, months_data: list[dict]) -> bytes:
    """Generate PDF report using ReportLab with updated branding."""
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
    dark = HexColor("#1e293b")
    blue = HexColor("#3b82f6")
    green = HexColor("#10b981")
    yellow = HexColor("#f59e0b")
    red = HexColor("#ef4444")
    gray = HexColor("#64748b")
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
    elements.append(Paragraph(f"📊 Laporan Performa {BRAND_NAME}", title_style))
    
    # Handle localized date formatting
    now = datetime.now()
    month_names = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    formatted_date = f"{now.day} {month_names[now.month]} {now.year}, {now.strftime('%H:%M')}"
    
    elements.append(Paragraph(
        f"Pengguna: {user_email} | Dibuat pada: {formatted_date}",
        subtitle_style
    ))
    elements.append(Spacer(1, 5*mm))

    # Current Period Summary
    if report_data:
        elements.append(Paragraph("Ringkasan Periode Ini", heading_style))
        elements.append(Paragraph(
            f"Periode: {report_data['period_start']} — {report_data['period_end']}",
            body_style
        ))
        elements.append(Spacer(1, 3*mm))

        summary_data = [
            ["Metrik", "Nilai"],
            ["Skor Kepercayaan", f"{report_data['trust_score']} / 1000"],
            ["Total Pendapatan (IDR)", f"Rp {report_data['total_revenue']:,.0f}"],
            ["Dokumen Terverifikasi", str(report_data['verified'])],
            ["Dokumen Diproses", str(report_data['processing'])],
            ["Dokumen Dimanipulasi", str(report_data['tampered'])],
            ["Total Dokumen", str(report_data['total_docs'])],
        ]
        t = Table(summary_data, colWidths=[120*mm, 50*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), dark),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, gray),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f8fafc"), white]),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(t)

    # Monthly History
    if months_data:
        elements.append(Spacer(1, 8*mm))
        elements.append(Paragraph("Riwayat Performa Bulanan", heading_style))
        elements.append(Spacer(1, 3*mm))

        history_data = [["Periode", "Skor", "Pendapatan", "✓", "⏳", "✗"]]
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
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f8fafc"), white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(ht)

    # Footer
    elements.append(Spacer(1, 15*mm))
    elements.append(Paragraph(
        f"Laporan ini dibuat secara otomatis oleh {BRAND_NAME}. "
        "Data didasarkan pada hasil prapemrosesan dan ekstraksi OCR selama periode laporan.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=gray)
    ))

    doc.build(elements)
    return buffer.getvalue()
