def make_dummy_png(kind: str) -> bytes:
    """Generate a dummy document PNG (slip_gaji or invoice) for OCR beta testing."""
    import io as _io
    try:
        from PIL import Image as PilImage, ImageDraw, ImageFont
    except ImportError:
        PilImage = None

    width, height = 1080, 1520
    if PilImage:
        img = PilImage.new("RGB", (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        try:
            font_big = ImageFont.truetype("arial.ttf", 44)
            font_med = ImageFont.truetype("arial.ttf", 28)
            font_sm  = ImageFont.truetype("arial.ttf", 26)
        except Exception:
            font_big = font_med = font_sm = ImageFont.load_default()
        draw.text((70, 80), "OTARU BETA DUMMY DOCUMENT", fill=(17, 24, 39), font=font_big)
        label = "SLIP GAJI" if kind == "slip_gaji" else "INVOICE"
        draw.text((70, 150), f"TYPE: {label}", fill=(51, 65, 85), font=font_med)
        draw.text((70, 195), "Dummy resmi beta testing OCR Otaru Financial", fill=(100, 116, 139), font=font_med)
        draw.rectangle([60, 250, 1020, 1370], outline=(203, 213, 225), width=3)
        draw.text((90, 310), "DATA UTAMA", fill=(15, 23, 42), font=font_big)
        if kind == "slip_gaji":
            rows = [
                "Nama Karyawan : Dummy User",
                "Periode Gaji  : 2026-05",
                "Gaji Pokok    : Rp 5.500.000",
                "Tunjangan     : Rp   750.000",
                "Potongan      : Rp   250.000",
                "Take Home Pay : Rp 6.000.000",
            ]
        else:
            rows = [
                "Vendor        : PT Dummy Supplier",
                "No. Invoice   : INV-2026-00042",
                "Tanggal       : 2026-05-10",
                "Subtotal      : Rp 12.000.000",
                "PPN 11%       : Rp  1.320.000",
                "Total         : Rp 13.320.000",
            ]
        for i, row in enumerate(rows):
            draw.text((90, 390 + i * 50), row, fill=(30, 41, 59), font=font_sm)
        draw.text((90, 730), "Dokumen ini dipakai untuk simulasi OCR beta Otaru Financial.", fill=(100, 116, 139), font=font_sm)
        draw.text((90, 1330), "Kode Template: Otaru Beta Dummy v1", fill=(100, 116, 139), font=font_sm)
        buf = _io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    else:
        # Fallback: minimal white PNG via raw bytes
        import struct, zlib
        def _png(w, h):
            def _chunk(t, d):
                c = zlib.crc32(t + d) & 0xffffffff
                return struct.pack(">I", len(d)) + t + d + struct.pack(">I", c)
            raw = b"".join(b"\x00" + b"\xff" * (w * 3) for _ in range(h))
            return (b"\x89PNG\r\n\x1a\n"
                    + _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                    + _chunk(b"IDAT", zlib.compress(raw))
                    + _chunk(b"IEND", b""))
        return _png(200, 280)
