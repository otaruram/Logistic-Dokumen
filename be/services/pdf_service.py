import base64
import io
from datetime import datetime

BRAND_NAME = "OtaruChain"


def generate_kasbon_template_pdf(
    *,
    full_name: str = "Budi Santoso",
    nik: str = "3201010101010001",
    email: str = "budi.demo@otaruchain.id",
) -> bytes:
    """Generate an auto-filled kasbon form for beta/demo use."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    def _style(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    black = HexColor("#0f172a")
    dark = HexColor("#1e293b")
    gray = HexColor("#64748b")
    light = HexColor("#e2e8f0")
    white = HexColor("#ffffff")

    st_brand = _style("tpl_brand", fontSize=9, textColor=gray)
    st_h1 = _style("tpl_h1", fontSize=18, textColor=black, fontName="Helvetica-Bold", leading=22, spaceAfter=6)
    st_sub = _style("tpl_sub", fontSize=9, textColor=gray, leading=12, spaceAfter=8)
    st_section = _style("tpl_section", fontSize=8, textColor=gray, fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4)
    st_label = _style("tpl_label", fontSize=8, textColor=gray)
    st_value = _style("tpl_value", fontSize=10, textColor=dark, fontName="Helvetica-Bold")
    st_note = _style("tpl_note", fontSize=9, textColor=dark, leading=14)
    st_footer = _style("tpl_footer", fontSize=8, textColor=gray, alignment=1)

    elements: list = []

    header_data = [[
        Paragraph(f"<b>{BRAND_NAME}</b> · Koperasi Mitra Sejahtera", st_brand),
        Paragraph("Form Pengajuan (Siap Cetak)", _style("tpl_right", fontSize=8, textColor=gray, alignment=2)),
    ]]
    ht = Table(header_data, colWidths=[110 * mm, 70 * mm])
    ht.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("TEXTCOLOR", (0, 0), (-1, -1), dark),
        ("LINEBELOW", (0, 0), (-1, -1), 1, light),
        ("LEFTPADDING", (0, 0), (0, -1), 5),
        ("RIGHTPADDING", (-1, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(ht)
    elements.append(Spacer(1, 8 * mm))

    elements.append(Paragraph("Form Pengajuan Kasbon Karyawan (Beta)", st_h1))
    elements.append(Paragraph("Template sudah auto-terisi dari profil user. Tanda tangan pemohon sudah terpasang.", st_sub))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e2e8f0"), spaceAfter=6))

    elements.append(Paragraph("Identitas Pemohon", st_section))
    identitas = [
        [Paragraph("Koperasi / Perusahaan", st_label), Paragraph("Tanggal Pengajuan", st_label), Paragraph("No. Referensi", st_label)],
        [Paragraph("Koperasi Mitra Sejahtera", st_value), Paragraph(datetime.now().strftime("%d / %m / %Y"), st_value), Paragraph("DUMMY-KSBN-001", st_value)],
        [Paragraph("Nama Lengkap", st_label), Paragraph("NIK (16 digit)", st_label), Paragraph("Divisi / Jabatan", st_label)],
        [Paragraph(full_name or "-", st_value), Paragraph(nik or "-", st_value), Paragraph("Operasional", st_value)],
        [Paragraph("Nomor HP", st_label), Paragraph("Email", st_label), Paragraph("", st_label)],
        [Paragraph("081234567890", st_value), Paragraph(email or "-", st_value), Paragraph("", st_value)],
    ]
    identitas_tbl = Table(identitas, colWidths=[60 * mm, 60 * mm, 60 * mm])
    identitas_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("GRID", (0, 0), (-1, -1), 0.35, light),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(identitas_tbl)
    elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph("Detail Pengajuan", st_section))
    detail = [
        [Paragraph("Nominal Pengajuan", st_label), Paragraph("Tenor (bulan)", st_label), Paragraph("Keperluan Pengajuan", st_label)],
        [Paragraph("Rp 2.500.000", st_value), Paragraph("6", st_value), Paragraph("Modal pembelian stok usaha", st_value)],
        [Paragraph("", st_label), Paragraph("", st_label), Paragraph("Kebutuhan operasional bulanan", st_value)],
    ]
    detail_tbl = Table(detail, colWidths=[55 * mm, 45 * mm, 80 * mm])
    detail_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("GRID", (0, 0), (-1, -1), 0.35, light),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(detail_tbl)
    elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph("Catatan SOP Koperasi", st_section))
    elements.append(Paragraph(
        "- Gaji Acuan UMK: Rp 5.000.000<br/>"
        "- DSR Maksimum: Rp 1.500.000 / bulan<br/>"
        "- Bunga Flat: 1% per bulan<br/>"
        "- Status Dummy: Data ini untuk simulasi beta",
        st_note,
    ))
    elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph("Pernyataan", st_section))
    elements.append(Paragraph(
        "Saya menyatakan data di atas adalah data simulasi untuk keperluan beta testing sistem.",
        st_note,
    ))
    elements.append(Spacer(1, 8 * mm))

    sig_data = [
        [Paragraph("Tanda Tangan Pemohon", st_label), Paragraph("Validasi Koperasi (Admin)", st_label)],
        [Paragraph(f"<font size='14'><b>{full_name or 'Pemohon'}</b></font><br/><font size='8'>TTD Digital Pemohon (Auto)</font>", st_value), Paragraph("\n\n______________________________", st_value)],
        [Paragraph("(Terisi otomatis dari data user)", st_label), Paragraph("(Diisi Admin saat Approval)", st_label)],
    ]
    sig_tbl = Table(sig_data, colWidths=[90 * mm, 90 * mm])
    sig_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("GRID", (0, 0), (-1, -1), 0.35, light),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, light),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    elements.append(sig_tbl)
    elements.append(Spacer(1, 8 * mm))
    elements.append(Paragraph(f"{BRAND_NAME} · Dokumen Resmi · Siap download & print", st_footer))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()


def generate_kasbon_pdf(loan: dict, profile: dict, sha256_hash: str = "", source: str = "", image_url: str = "") -> bytes:
    """
    Generate a structured PDF for an approved/rejected/revision kasbon form.

    loan keys expected: id, nik, nominal_pengajuan, status, submitted_at,
                        reviewed_at, ocr_raw (dict with tenor_bulan, cicilan_sistem,
                        dsr_status, no_referensi, reject_reason, revision_notes)
    profile keys expected: full_name, divisi (optional), email (optional)
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.graphics.shapes import Circle, Drawing, String
    from reportlab.platypus import (
        Image,
        SimpleDocTemplate,
        Table,
        TableStyle,
        Paragraph,
        Spacer,
        HRFlowable,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
    )

    # ── Colors
    black   = HexColor("#0f172a")
    dark    = HexColor("#1e293b")
    gray    = HexColor("#64748b")
    lgray   = HexColor("#e2e8f0")
    white   = HexColor("#ffffff")

    green   = HexColor("#166534")
    red     = HexColor("#991b1b")
    amber   = HexColor("#92400e")
    amber_bg = HexColor("#fffbeb")
    green_bg = HexColor("#f0fdf4")
    red_bg  = HexColor("#fef2f2")

    styles = getSampleStyleSheet()

    def _style(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    def _build_round_stamp(variant: str = "classic") -> Drawing:
        d = Drawing(28 * mm, 28 * mm)
        cx = 14 * mm
        cy = 14 * mm
        red_seal = HexColor("#b91c1c")
        if variant == "embossed":
            d.add(Circle(cx, cy, 12.7 * mm, strokeColor=red_seal, strokeWidth=1.8, fillColor=None))
            d.add(Circle(cx, cy, 10.7 * mm, strokeColor=red_seal, strokeWidth=0.9, fillColor=None))
            d.add(Circle(cx, cy, 8.9 * mm, strokeColor=red_seal, strokeWidth=0.6, fillColor=None))
            d.add(String(cx, cy + 5.5 * mm, "OTARUCHAIN", textAnchor="middle", fillColor=red_seal, fontName="Helvetica-Bold", fontSize=6.5))
            d.add(String(cx, cy + 0.8 * mm, "KOPERASI", textAnchor="middle", fillColor=red_seal, fontName="Helvetica-Bold", fontSize=6.2))
            d.add(String(cx, cy - 4.0 * mm, "RESMI", textAnchor="middle", fillColor=red_seal, fontName="Helvetica-Bold", fontSize=6.2))
            d.add(String(cx, cy - 8.7 * mm, "APPROVED", textAnchor="middle", fillColor=red_seal, fontName="Helvetica-Bold", fontSize=4.8))
        else:
            d.add(Circle(cx, cy, 12.5 * mm, strokeColor=red_seal, strokeWidth=1.6, fillColor=None))
            d.add(Circle(cx, cy, 10.3 * mm, strokeColor=red_seal, strokeWidth=1.0, fillColor=None))
            d.add(String(cx, cy + 1.5 * mm, "OTARUCHAIN", textAnchor="middle", fillColor=red_seal, fontName="Helvetica-Bold", fontSize=7.5))
            d.add(String(cx, cy - 4.0 * mm, "KOPERASI", textAnchor="middle", fillColor=red_seal, fontName="Helvetica-Bold", fontSize=6.5))
            d.add(String(cx, cy - 8.5 * mm, "RESMI", textAnchor="middle", fillColor=red_seal, fontName="Helvetica-Bold", fontSize=6.5))
        d.hAlign = "CENTER"
        return d

    st_brand  = _style("brand",  fontSize=9, textColor=gray, spaceAfter=0)
    st_h1     = _style("h1",     fontSize=18, textColor=black, fontName="Helvetica-Bold", leading=22, spaceAfter=6)
    st_sub    = _style("sub",    fontSize=9,  textColor=gray,  leading=12, spaceAfter=8)
    st_secttl = _style("secttl", fontSize=8,  textColor=gray,  fontName="Helvetica-Bold",
                       spaceBefore=10, spaceAfter=4, textTransform="uppercase")
    st_label  = _style("lbl",    fontSize=8,  textColor=gray)
    st_value  = _style("val",    fontSize=10, textColor=dark,  fontName="Helvetica-Bold")
    st_nom    = _style("nom",    fontSize=14, textColor=green, fontName="Helvetica-Bold")
    st_note   = _style("note",   fontSize=9,  textColor=dark,  leading=14)
    st_hash   = _style("hash",   fontSize=7,  textColor=gray,  fontName="Courier", spaceBefore=2)
    st_footer = _style("ftr",    fontSize=8,  textColor=gray,  alignment=1)  # center

    ocr = loan.get("ocr_raw") or {}
    status = (loan.get("status") or "PENDING").upper()
    no_ref = ocr.get("no_referensi") or str(loan.get("id", ""))[:8].upper()
    tenor = ocr.get("tenor_bulan") or "-"
    cicilan = ocr.get("cicilan_sistem")
    dsr = ocr.get("dsr_status", "AMAN")
    nominal = int(loan.get("nominal_pengajuan") or 0)
    nik = loan.get("nik", "-")
    full_name = profile.get("full_name") or "-"
    divisi = profile.get("divisi") or "-"
    email = profile.get("email") or "-"
    admin_signature = ocr.get("admin_signature")
    stamp_applied = bool(ocr.get("stamp_applied", False))
    stamp_variant = str(ocr.get("stamp_style") or "classic").lower()
    doc_source = source or loan.get("source") or "CHAIN"
    original_url = image_url or loan.get("image_url") or ""

    # Date helpers
    _MONTHS = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
               "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

    def _fmt_date(iso: str | None) -> str:
        if not iso:
            return "-"
        try:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            return f"{dt.day} {_MONTHS[dt.month]} {dt.year}"
        except Exception:
            return iso[:10]

    def _fmt_rp(v: int | None) -> str:
        if v is None:
            return "-"
        return f"Rp {v:,}".replace(",", ".")

    elements: list = []

    # ── Contextual Header Band (OtaruChain vs OtaruFinancial) ────────
    if doc_source == "FINANCE":
        header_icon = "\ud83d\udcb0"
        header_text = "SURAT PERSETUJUAN KASBON KARYAWAN \u2014 OTARUFINANCIAL"
        header_bg = HexColor("#064e3b")   # Emerald-900
        header_accent = HexColor("#10b981")  # Emerald-500
        header_fg = white
    else:
        header_icon = "\ud83e\uddfe"
        header_text = "DOKUMEN RESMI BUKTI OPERASIONAL \u2014 OTARUCHAIN"
        header_bg = HexColor("#1e293b")   # Slate-800
        header_accent = HexColor("#64748b")  # Slate-500
        header_fg = white

    st_header_txt = _style("hdr_txt", fontSize=9, textColor=header_fg, fontName="Helvetica-Bold")
    st_header_ref = _style("hdr_ref", fontSize=8, textColor=header_fg, alignment=2)
    header_data = [[
        Paragraph(f"{header_icon} <b>{header_text}</b>", st_header_txt),
        Paragraph(f"No. Ref: <b>{no_ref}</b>", st_header_ref),
    ]]
    ht = Table(header_data, colWidths=[130 * mm, 50 * mm])
    ht.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, -1), header_fg),
        ("LINEBELOW", (0, 0), (-1, -1), 3, header_accent),
        ("LEFTPADDING", (0, 0), (0, -1), 8),
        ("RIGHTPADDING", (-1, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(ht)
    elements.append(Spacer(1, 8 * mm))

    # ── Title
    doc_title = "Form Persetujuan Kasbon Karyawan" if doc_source == "FINANCE" else "Form Pengajuan Kasbon Karyawan"
    elements.append(Paragraph(doc_title, st_h1))
    elements.append(Spacer(1, 1.5 * mm))
    elements.append(Paragraph(
        f"Tanggal Pengajuan: {_fmt_date(loan.get('submitted_at'))}  |  "
        f"Diproses: {_fmt_date(loan.get('reviewed_at') or datetime.utcnow().isoformat())}",
        st_sub,
    ))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e2e8f0"), spaceAfter=6))

    # ── Status badge row
    status_colors = {
        "APPROVED": ("#166534", "#f0fdf4"),
        "REJECTED": ("#991b1b", "#fef2f2"),
        "NEED_REVISION": ("#92400e", "#fffbeb"),
        "PENDING": ("#374151", "#f9fafb"),
    }
    fg, bg = status_colors.get(status, ("#374151", "#f9fafb"))
    status_label = {
        "APPROVED": "✓  DISETUJUI",
        "REJECTED": "✗  DITOLAK",
        "NEED_REVISION": "⚠  PERLU REVISI",
        "PENDING": "⏳  MENUNGGU",
    }.get(status, status)

    sb_data = [[Paragraph(f"<b>{status_label}</b>",
                           _style("st_lbl", fontSize=10, textColor=HexColor(fg), fontName="Helvetica-Bold"))]]
    st_tbl = Table(sb_data, colWidths=[180 * mm])
    st_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor(bg)),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(st_tbl)
    elements.append(Spacer(1, 4 * mm))

    # ── Identitas Pemohon
    elements.append(Paragraph("Identitas Pemohon", st_secttl))
    id_data = [
        [Paragraph("Nama Lengkap", st_label), Paragraph("NIK (16 digit)", st_label),
         Paragraph("Divisi / Jabatan", st_label)],
        [Paragraph(full_name, st_value), Paragraph(nik, st_value), Paragraph(divisi, st_value)],
        [Paragraph("Email", st_label), Paragraph("", st_label), Paragraph("", st_label)],
        [Paragraph(email, st_value), Paragraph("", st_value), Paragraph("", st_value)],
    ]
    id_tbl = Table(id_data, colWidths=[60 * mm, 60 * mm, 60 * mm])
    id_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("GRID", (0, 0), (-1, -1), 0.35, lgray),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(id_tbl)
    elements.append(Spacer(1, 4 * mm))

    # ── Detail Pengajuan
    elements.append(Paragraph("Detail Pengajuan", st_secttl))
    det_data = [
        [Paragraph("Nominal Pengajuan", st_label), Paragraph("Tenor", st_label),
         Paragraph("Cicilan / Bulan", st_label), Paragraph("DSR Status", st_label)],
        [Paragraph(_fmt_rp(nominal), st_nom),
         Paragraph(f"{tenor} bln", st_value),
         Paragraph(_fmt_rp(cicilan) if cicilan else "-", st_value),
         Paragraph(str(dsr), _style("dsr", fontSize=10, textColor=green if dsr == "AMAN" else red,
                                    fontName="Helvetica-Bold"))],
    ]
    det_tbl = Table(det_data, colWidths=[55 * mm, 35 * mm, 50 * mm, 40 * mm])
    det_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("GRID", (0, 0), (-1, -1), 0.35, lgray),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(det_tbl)
    elements.append(Spacer(1, 4 * mm))

    # ── Notes for non-approved statuses
    if status == "REJECTED":
        reason = ocr.get("reject_reason") or "-"
        elements.append(Paragraph("Alasan Penolakan", st_secttl))
        rj_data = [[Paragraph(reason, st_note)]]
        rj_tbl = Table(rj_data, colWidths=[180 * mm])
        rj_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#fef2f2")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(rj_tbl)
        elements.append(Spacer(1, 4 * mm))

    if status == "NEED_REVISION":
        notes = ocr.get("revision_notes") or "-"
        elements.append(Paragraph("Catatan Revisi", st_secttl))
        rv_data = [[Paragraph(notes, st_note)]]
        rv_tbl = Table(rv_data, colWidths=[180 * mm])
        rv_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#fffbeb")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(rv_tbl)
        elements.append(Spacer(1, 4 * mm))

    # ── Pernyataan
    elements.append(Paragraph("Pernyataan Pemohon", st_secttl))
    elements.append(Paragraph(
        "Saya yang bertanda tangan di bawah ini menyatakan bahwa seluruh data yang tercantum dalam form ini "
        "adalah benar dan dapat dipertanggungjawabkan. Saya bersedia mematuhi ketentuan angsuran yang telah "
        "ditetapkan oleh koperasi serta bersedia dikenakan sanksi apabila terbukti memberikan data palsu.",
        st_note,
    ))
    elements.append(Spacer(1, 5 * mm))

    # ── Signature row — Fixed Dimension Bounding Boxes ─────────────────
    # Admin signature: fixed 50×18mm box inside structured table
    admin_signature_flow = Spacer(1, 18 * mm)
    if status == "APPROVED" and isinstance(admin_signature, str) and admin_signature.startswith("data:image"):
        try:
            b64 = admin_signature.split(",", 1)[1]
            sig_bytes = base64.b64decode(b64)
            admin_signature_flow = Image(io.BytesIO(sig_bytes), width=50 * mm, height=18 * mm)
            admin_signature_flow.hAlign = "CENTER"
        except Exception:
            admin_signature_flow = Paragraph("(ttd tidak terbaca)", _style("sg_bad", fontSize=9, textColor=red, alignment=1))

    line_style = _style("sign_line", fontSize=10, textColor=gray, alignment=1)
    signer_style = _style("signer_name", fontSize=10, textColor=dark, fontName="Helvetica-Bold", alignment=1)
    signer_meta_style = _style("signer_meta", fontSize=8, textColor=gray, alignment=1)

    # User signature block (left) — fixed 82mm wide
    user_signature_block = Table(
        [
            [Paragraph("Tanda Tangan Pemohon", st_label)],
            [Spacer(1, 20 * mm)],
            [Paragraph("______________________________", line_style)],
            [Paragraph(full_name, signer_style)],
            [Paragraph("Pemohon", signer_meta_style)],
        ],
        colWidths=[82 * mm],
        rowHeights=[6 * mm, 20 * mm, 6 * mm, 6 * mm, 5 * mm],
    )
    user_signature_block.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("BOX", (0, 0), (-1, -1), 0.5, lgray),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    # Admin signature block (right) — stamp + signature in fixed grid
    stamp_flow = _build_round_stamp(stamp_variant) if (status == "APPROVED" and stamp_applied) else Spacer(1, 1 * mm)

    # Place stamp and signature side-by-side in fixed cells
    admin_sig_inner = Table(
        [[stamp_flow, admin_signature_flow]],
        colWidths=[28 * mm, 50 * mm],
        rowHeights=[20 * mm],
    )
    admin_sig_inner.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
    ]))

    admin_signature_block = Table(
        [
            [Paragraph("Disetujui Oleh (Admin)", st_label)],
            [admin_sig_inner],
            [Paragraph("______________________________", line_style)],
            [Paragraph("Koperasi Mitra Sejahtera", signer_style)],
            [Paragraph("Admin Koperasi", signer_meta_style)],
        ],
        colWidths=[82 * mm],
        rowHeights=[6 * mm, 20 * mm, 6 * mm, 6 * mm, 5 * mm],
    )
    admin_signature_block.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("BOX", (0, 0), (-1, -1), 0.5, lgray),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    sig_tbl = Table([[user_signature_block, admin_signature_block]], colWidths=[90 * mm, 90 * mm])
    sig_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("BOX", (0, 0), (-1, -1), 0.5, lgray),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, lgray),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(sig_tbl)

    # ── Audit Trail / Metadata Section ───────────────────────────────
    elements.append(Spacer(1, 5 * mm))
    elements.append(Paragraph("Audit Trail & Metadata", st_secttl))

    st_audit_label = _style("audit_lbl", fontSize=7, textColor=gray)
    st_audit_val = _style("audit_val", fontSize=7, textColor=dark, fontName="Helvetica-Bold")
    st_audit_link = _style("audit_link", fontSize=7, textColor=HexColor("#2563eb"))
    st_audit_hash = _style("audit_hash", fontSize=7, textColor=gray, fontName="Courier")

    audit_rows = [
        [Paragraph("Jenis Dokumen", st_audit_label),
         Paragraph("OTARUFINANCIAL — INCOME" if doc_source == "FINANCE" else "OTARUCHAIN — OPERATIONAL", st_audit_val)],
        [Paragraph("Status Akhir", st_audit_label),
         Paragraph(status, st_audit_val)],
    ]
    if original_url:
        url_display = original_url if len(original_url) <= 70 else original_url[:67] + "..."
        audit_rows.append([
            Paragraph("Tautan Dokumen Sumber", st_audit_label),
            Paragraph(f'<a href="{original_url}">{url_display}</a>', st_audit_link),
        ])
    if sha256_hash:
        audit_rows.append([
            Paragraph("SHA-256 Integrity Seal", st_audit_label),
            Paragraph(sha256_hash, st_audit_hash),
        ])
    audit_rows.append([
        Paragraph("Dicetak", st_audit_label),
        Paragraph(datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"), st_audit_val),
    ])

    audit_tbl = Table(audit_rows, colWidths=[45 * mm, 135 * mm])
    audit_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, lgray),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, lgray),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(audit_tbl)

    # ── Footer ───────────────────────────────────────────────────────
    elements.append(Spacer(1, 6 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e2e8f0")))
    elements.append(Spacer(1, 2 * mm))
    footer_brand = "Otaru Financial" if doc_source == "FINANCE" else BRAND_NAME
    elements.append(Paragraph(
        f"{footer_brand} \u00b7 Dokumen Resmi \u00b7 otaruchain.id \u00b7 Dicetak otomatis oleh sistem",
        st_footer,
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()

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

def generate_integrity_certificate(
    *,
    full_name: str,
    nik: str,
    badge_tier: str,
    month_year: str,
    verified_count: int,
    otaru_index: int,
    verification_hash: str,
) -> bytes:
    """Generate an official digital integrity certificate."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    import io
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        topMargin=25 * mm,
        bottomMargin=25 * mm,
        leftMargin=30 * mm,
        rightMargin=30 * mm,
    )
    styles = getSampleStyleSheet()

    def _style(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    black = HexColor("#0f172a")
    gray = HexColor("#64748b")
    
    if badge_tier.upper() == "PLATINUM":
        theme_color = HexColor("#4338ca") # Indigo
    elif badge_tier.upper() == "GOLD":
        theme_color = HexColor("#b45309") # Amber
    else:
        theme_color = HexColor("#475569") # Slate

    st_title = _style("cert_title", fontSize=28, textColor=theme_color, fontName="Helvetica-Bold", alignment=1, spaceAfter=20)
    st_subtitle = _style("cert_subtitle", fontSize=14, textColor=gray, alignment=1, spaceAfter=15)
    st_name = _style("cert_name", fontSize=24, textColor=black, fontName="Helvetica-Bold", alignment=1, spaceAfter=15)
    st_text = _style("cert_text", fontSize=12, textColor=black, alignment=1, leading=16, spaceAfter=10)
    st_hash = _style("cert_hash", fontSize=10, textColor=gray, fontName="Courier", alignment=1, spaceAfter=30)
    st_footer = _style("cert_footer", fontSize=9, textColor=gray, alignment=1)

    elements = []
    
    # Border could be drawn with page templates, but we'll keep it simple
    elements.append(Spacer(1, 15 * mm))
    
    elements.append(Paragraph(f"OtaruChain Integrity Certificate", st_title))
    elements.append(Paragraph("This certifies that", st_subtitle))
    elements.append(Paragraph(full_name.upper(), st_name))
    
    desc = f"has achieved the <b>{badge_tier.upper()} Integrity Badge</b> for the month of <b>{month_year}</b>."
    elements.append(Paragraph(desc, st_text))
    
    stats = f"Demonstrating outstanding operational consistency with <b>{verified_count}</b> verified documents "
    stats += f"and a financial trust score (Otaru Index) of <b>{otaru_index}</b>/1000."
    elements.append(Paragraph(stats, st_text))
    
    elements.append(Spacer(1, 20 * mm))
    
    elements.append(Paragraph(f"Verification Hash: {verification_hash}", st_hash))
    elements.append(Paragraph(f"Date Issued: {datetime.now().strftime('%Y-%m-%d')} | Powered by Otaru Ecosystem", st_footer))
    
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
