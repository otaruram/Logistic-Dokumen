"""
Stamp Service — Enterprise Document Overlay Engine (v2)

Downloads the original uploaded document image, composites a professional
institutional-grade stamp + admin digital signature overlay using Pillow,
then returns stamped JPEG bytes for re-upload to ImageKit.

Key design principles (Bank Indonesia / OJK compliance):
• 0-degree rotation only — no slanted text or crooked borders
• Fixed bounding boxes for signature blocks (120×60px scaled)
• Transparent PNG layering — stamp uses alpha blending (multiply feel)
• A4-proportion layout with strict 15mm equivalent margins
• Source-aware header band (OtaruChain vs OtaruFinancial)
• Original document reference link in audit trail
• SHA-256 cryptographic seal rendered in monospace
"""

import io
import os
import base64
from datetime import datetime, timezone
from typing import Optional

import requests
from PIL import Image, ImageDraw, ImageFont


# ── Constants ─────────────────────────────────────────────────────────────────

_MARGIN_RATIO = 0.03          # 3% of shortest edge ≈ 15mm on A4
_STAMP_SIZE_RATIO = 0.18      # Stamp diameter = 18% of image width
_SIG_BOX_W_RATIO = 0.15       # Signature box width = 15% of image width
_SIG_BOX_H_RATIO = 0.075      # Signature box height = 7.5% of image width
_HEADER_H_RATIO = 0.045       # Header band height = 4.5% of image height
_FOOTER_H_RATIO = 0.06        # Footer/audit trail height = 6% of image height


def _download_image(url: str) -> Optional[Image.Image]:
    """Download an image from URL and return as PIL Image (RGBA)."""
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code != 200:
            return None
        return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception as e:
        print(f"[StampService] Failed to download image: {e}")
        return None


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Get a font, falling back to default if system fonts unavailable."""
    families = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "arialbd.ttf" if bold else "arial.ttf",
        "Arial Bold.ttf" if bold else "Arial.ttf",
    ]
    for fam in families:
        try:
            return ImageFont.truetype(fam, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _get_mono_font(size: int) -> ImageFont.FreeTypeFont:
    """Get a monospace font for SHA-256 hash display."""
    monos = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "cour.ttf",
        "Courier New.ttf",
    ]
    for fam in monos:
        try:
            return ImageFont.truetype(fam, size)
        except OSError:
            continue
    return ImageFont.load_default()


# ── Header Band ───────────────────────────────────────────────────────────────

def _draw_header_band(
    draw: ImageDraw.ImageDraw,
    img_w: int,
    header_h: int,
    source: str = "CHAIN",
) -> None:
    """Draw a full-width contextual header band at the top of the image."""
    if source == "FINANCE":
        bg_color = (6, 78, 59, 230)       # Emerald-900
        accent_color = (16, 185, 129)       # Emerald-500
        text = "💰 SURAT PERSETUJUAN KASBON KARYAWAN — OTARUFINANCIAL"
    else:
        bg_color = (30, 41, 59, 230)       # Slate-800
        accent_color = (100, 116, 139)      # Slate-500
        text = "🧾 DOKUMEN RESMI BUKTI OPERASIONAL — OTARUCHAIN"

    # Background rectangle
    draw.rectangle([(0, 0), (img_w, header_h)], fill=bg_color)
    # Accent line at bottom of header
    draw.rectangle([(0, header_h - 3), (img_w, header_h)], fill=accent_color)

    # Header text
    font_size = max(12, header_h // 3)
    font = _get_font(font_size, bold=True)
    text_y = (header_h - font_size) // 2
    draw.text((int(img_w * 0.03), text_y), text, fill=(255, 255, 255, 255), font=font)


# ── Koperasi Stamp ────────────────────────────────────────────────────────────

# ── Color presets ─────────────────────────────────────────────────────────────

_STAMP_COLORS: dict[str, tuple[int, int, int]] = {
    "red":    (180, 10, 10),
    "blue":   (0, 60, 160),
    "black":  (20, 20, 20),
    "green":  (0, 110, 40),
    "white":  (230, 230, 230),
    "gold":   (180, 140, 0),
}

def _resolve_color(stamp_color: str) -> tuple[int, int, int]:
    return _STAMP_COLORS.get(stamp_color.lower(), _STAMP_COLORS["red"])


def _draw_spotlight(canvas: Image.Image, cx: int, cy: int, radius: int,
                    color: tuple[int, int, int] = (255, 255, 255)) -> None:
    """Paint a soft radial glow behind a stamp element so it reads on dark backgrounds."""
    from PIL import ImageFilter
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    r, g, b = color
    # Inner bright core
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
              fill=(r, g, b, 60))
    # Outer feathered ring
    d.ellipse([cx - radius * 2, cy - radius * 2, cx + radius * 2, cy + radius * 2],
              fill=(r, g, b, 20))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=radius // 2))
    canvas.alpha_composite(glow)


def _tint_rgba(img: Image.Image, tint: tuple[int, int, int]) -> Image.Image:
    """Multiply every RGB channel of an RGBA image by a tint color."""
    r, g, b, a = img.split()
    tr, tg, tb = [v / 255.0 for v in tint]
    import PIL.ImageChops as chops
    r = r.point(lambda x: int(x * tr))
    g = g.point(lambda x: int(x * tg))
    b = b.point(lambda x: int(x * tb))
    return Image.merge("RGBA", (r, g, b, a))


def _create_koperasi_stamp(diameter: int = 280, stamp_color: str = "red", stamp_name: str = "KOPERASI MITRA SEJAHTERA") -> Image.Image:
    """Generate a transparent circular koperasi official stamp with alpha blending."""
    stamp = Image.new("RGBA", (diameter, diameter), (0, 0, 0, 0))
    draw = ImageDraw.Draw(stamp)

    cx, cy = diameter // 2, diameter // 2
    ink = _resolve_color(stamp_color)
    ink_alpha_outer = 160
    ink_alpha_inner = 140
    ink_alpha_text = 190
    green_alpha = 200

    pad = int(diameter * 0.04)
    inner_pad = int(diameter * 0.13)

    # Outer circle
    draw.ellipse(
        [pad, pad, diameter - pad, diameter - pad],
        outline=(*ink, ink_alpha_outer), width=max(3, diameter // 70),
    )
    # Inner circle
    draw.ellipse(
        [inner_pad, inner_pad, diameter - inner_pad, diameter - inner_pad],
        outline=(*ink, ink_alpha_inner), width=max(2, diameter // 120),
    )

    # Text sizing relative to stamp diameter
    fs_large = max(10, diameter // 18)
    fs_medium = max(8, diameter // 22)
    fs_small = max(7, diameter // 26)

    font_l = _get_font(fs_large, bold=True)
    font_m = _get_font(fs_medium, bold=True)
    font_s = _get_font(fs_small)

    # Top text: split stamp_name into two lines
    words = stamp_name.upper().split()
    mid = (len(words) + 1) // 2
    line1 = " ".join(words[:mid])
    line2 = " ".join(words[mid:])
    draw.text((cx, pad + int(diameter * 0.10)), line1,
              fill=(*ink, ink_alpha_text), font=font_l, anchor="mt")
    if line2:
        draw.text((cx, pad + int(diameter * 0.10) + fs_large + 2), line2,
                  fill=(*ink, ink_alpha_text), font=font_l, anchor="mt")

    # Center: ✓ VERIFIED
    draw.text((cx, cy - 2), "✓ VERIFIED",
              fill=(0, 120, 50, green_alpha), font=font_l, anchor="mm")

    # Bottom text
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    draw.text((cx, diameter - inner_pad - fs_small - 4), "OTARUCHAIN",
              fill=(*ink, ink_alpha_text), font=font_m, anchor="mm")
    draw.text((cx, diameter - pad - fs_small - 2), timestamp,
              fill=(*ink, 150), font=font_s, anchor="mm")

    return stamp


# ── Signature Block ───────────────────────────────────────────────────────────

def _make_transparent(img: Image.Image, threshold: int = 220, softness: int = 30) -> Image.Image:
    """Remove white/bright background from a signature image with soft anti-aliased edges.

    Uses per-pixel luminance-based alpha to preserve ink strokes fully while
    smoothly fading near-white pixels rather than cutting them off hard.

    Args:
        threshold: Pixels brighter than this (0-255 luminance) start fading.
        softness:  Range below threshold over which alpha transitions 0→255.
                   Larger = smoother edge; 0 = hard cut.
    """
    img = img.convert("RGBA")
    r, g, b, a = img.split()

    import struct

    pixels_r = list(r.getdata())
    pixels_g = list(g.getdata())
    pixels_b = list(b.getdata())
    pixels_a = list(a.getdata())

    new_a = []
    low = threshold - softness
    for i, (rv, gv, bv, av) in enumerate(zip(pixels_r, pixels_g, pixels_b, pixels_a)):
        # Luminance (perceptual)
        lum = int(0.299 * rv + 0.587 * gv + 0.114 * bv)
        if lum >= threshold:
            new_a.append(0)
        elif lum <= low:
            new_a.append(av)  # Keep original alpha (fully opaque ink)
        else:
            # Linear gradient in the softness band
            fade = int(av * (threshold - lum) / max(softness, 1))
            new_a.append(fade)

    r2 = r.copy()
    g2 = g.copy()
    b2 = b.copy()
    a2 = a.copy()
    a2.putdata(new_a)
    result = Image.merge("RGBA", (r2, g2, b2, a2))
    return result


def _create_signature_block(
    signature_data: Optional[str],
    box_w: int = 120,
    box_h: int = 60,
    label: str = "TTD Admin",
    stamp_color: str = "red",
) -> Image.Image:
    """Create a structured signature bounding box with the signature inside.

    The block has a thin border, label, and the signature image is
    alpha-composited inside — no white background bleed.
    """
    block = Image.new("RGBA", (box_w, box_h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(block)
    ink = _resolve_color(stamp_color)

    # Draw thin colored border for the bounding box
    draw.rectangle(
        [(0, 0), (box_w - 1, box_h - 1)],
        outline=(*ink, 140), width=1,
    )

    # Label at top-left inside the box
    label_font = _get_font(max(8, box_h // 7))
    draw.text((4, 2), label, fill=(*ink, 200), font=label_font)

    # Place signature image inside the box
    if signature_data:
        try:
            if "," in signature_data:
                signature_data = signature_data.split(",", 1)[1]
            sig_bytes = base64.b64decode(signature_data)
            sig_img = Image.open(io.BytesIO(sig_bytes)).convert("RGBA")
            
            # Make white background transparent
            sig_img = _make_transparent(sig_img)

            # Fit signature inside the box with padding
            padding = max(8, box_h // 6)
            inner_w = box_w - (padding * 2)
            inner_h = box_h - padding - max(12, box_h // 5)  # Account for label
            sig_img.thumbnail((inner_w, inner_h), Image.LANCZOS)

            # Center the signature in the box
            sig_x = (box_w - sig_img.width) // 2
            sig_y = max(12, box_h // 5) + (inner_h - sig_img.height) // 2
            block.paste(sig_img, (sig_x, sig_y), sig_img)
        except Exception as e:
            print(f"[StampService] Failed to decode signature: {e}")
            # Draw placeholder text
            draw.text((box_w // 2, box_h // 2 + 4), "(TTD)",
                      fill=(150, 150, 150, 150), font=label_font, anchor="mm")

    return block


# ── Footer / Audit Trail ──────────────────────────────────────────────────────

def _draw_audit_footer(
    draw: ImageDraw.ImageDraw,
    img_w: int,
    img_h: int,
    footer_h: int,
    sha256_hash: str = "",
    original_url: str = "",
    source: str = "CHAIN",
) -> None:
    """Draw an audit trail footer band at the bottom of the image."""
    footer_y = img_h - footer_h

    # Semi-transparent dark background
    draw.rectangle([(0, footer_y), (img_w, img_h)], fill=(15, 23, 42, 220))

    # Accent line at top of footer
    if source == "FINANCE":
        accent = (16, 185, 129)
    else:
        accent = (100, 116, 139)
    draw.rectangle([(0, footer_y), (img_w, footer_y + 2)], fill=accent)

    fs = max(9, footer_h // 5)
    fs_small = max(7, footer_h // 7)
    font = _get_font(fs)
    font_mono = _get_mono_font(fs_small)
    margin = int(img_w * 0.03)

    # Line 1: Document type
    y = footer_y + 6
    source_label = "OTARUFINANCIAL — INCOME" if source == "FINANCE" else "OTARUCHAIN — OPERATIONAL"
    draw.text((margin, y), f"Audit Trail  |  {source_label}", fill=(200, 200, 200, 255), font=font)

    # Line 2: Original document link
    y += fs + 4
    if original_url:
        url_display = original_url if len(original_url) <= 80 else original_url[:77] + "..."
        draw.text((margin, y), f"Tautan Dokumen Sumber: {url_display}",
                  fill=(148, 163, 184, 255), font=font)
    else:
        draw.text((margin, y), "Tautan Dokumen Sumber: (tidak tersedia)",
                  fill=(148, 163, 184, 200), font=font)

    # Line 3: SHA-256 hash in monospace
    y += fs + 4
    if sha256_hash:
        draw.text((margin, y), f"SHA-256: {sha256_hash}",
                  fill=(148, 163, 184, 230), font=font_mono)

    # Line 4: Timestamp
    y += fs_small + 4
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    draw.text((margin, y), f"Dicetak: {ts}  |  Otaru Ecosystem",
              fill=(100, 116, 139, 200), font=font)


# ── Public API ────────────────────────────────────────────────────────────────

def stamp_original_image(
    original_image_url: str,
    admin_signature_b64: Optional[str] = None,
    stamp_applied: bool = True,
    sha256_hash: str = "",
    source: str = "CHAIN",
    doc_type: str = "receipt",
    nominal: int = 0,
    coords: Optional[dict] = None,
    stamp_color: str = "red",
    stamp_name: str = "KOPERASI MITRA SEJAHTERA",
) -> Optional[bytes]:
    """
    Download original image, overlay institutional-grade stamp + signature,
    return stamped JPEG bytes.

    Returns None if the original image cannot be downloaded.
    """
    # 1. Download original
    original = _download_image(original_image_url)
    if original is None:
        return None

    img_w, img_h = original.size
    margin = int(min(img_w, img_h) * _MARGIN_RATIO)

    # Calculate component sizes relative to image
    header_h = max(36, int(img_h * _HEADER_H_RATIO))
    footer_h = max(60, int(img_h * _FOOTER_H_RATIO))
    stamp_diameter = max(140, int(img_w * _STAMP_SIZE_RATIO))
    sig_box_w = max(120, int(img_w * _SIG_BOX_W_RATIO))
    sig_box_h = max(60, int(img_w * _SIG_BOX_H_RATIO))
    materai_w = max(80, int(img_w * 0.1))
    materai_h = int(materai_w * 1.33)  # Aspect ratio roughly 3:4

    # 2. Create extended canvas (original + header + footer)
    new_h = img_h + header_h + footer_h
    canvas = Image.new("RGBA", (img_w, new_h), (255, 255, 255, 255))

    # Paste original image below header
    canvas.paste(original, (0, header_h), original)

    draw = ImageDraw.Draw(canvas)

    # 3. Draw contextual header band
    _draw_header_band(draw, img_w, header_h, source)

    # Default positions — stamp bottom-right, TTD centered on stamp
    stamp_x = img_w - stamp_diameter - margin - 10
    stamp_y = header_h + img_h - stamp_diameter - margin - 20
    stamp_cx = stamp_x + stamp_diameter // 2
    stamp_cy = stamp_y + stamp_diameter // 2

    # TTD always centered on stamp so they overlap (nempel)
    sig_x = stamp_cx - sig_box_w // 2
    sig_y = stamp_cy - sig_box_h // 2

    # Materai (for >= 1M): vertically aligned with stamp, to its left
    materai_x = max(margin, stamp_x - materai_w - 20)
    materai_y = stamp_y + (stamp_diameter - materai_h) // 2

    # Override with coords if provided
    materai_rotation = 0.0
    if coords:
        if "materai" in coords and coords["materai"]:
            materai_x = int(coords["materai"]["x"])
            materai_y = int(coords["materai"]["y"]) + header_h
            materai_rotation = float(coords["materai"].get("rotation", 0))
        if "ttd" in coords and coords["ttd"]:
            sig_x = int(coords["ttd"]["x"])
            sig_y = int(coords["ttd"]["y"]) + header_h
        if "stamp" in coords and coords["stamp"]:
            stamp_x = int(coords["stamp"]["x"])
            stamp_y = int(coords["stamp"]["y"]) + header_h

    # Materai disabled (sementara dinonaktifkan)
    if False and nominal >= 1000000:
        try:
            materai_path = os.path.join(os.path.dirname(__file__), '../../fe/public/meterai_10000.png')
            if os.path.exists(materai_path):
                materai_img = Image.open(materai_path).convert("RGBA")
                # Remove white/near-white background from materai image
                materai_img = _make_transparent(materai_img, threshold=245, softness=10)
                materai_img = materai_img.resize((materai_w, materai_h), Image.LANCZOS)
                if materai_rotation != 0:
                    materai_img = materai_img.rotate(-materai_rotation, expand=True, resample=Image.BICUBIC)
                cx = materai_x + materai_w // 2 - materai_img.width // 2
                cy = materai_y + materai_h // 2 - materai_img.height // 2
                canvas.paste(materai_img, (cx, cy), materai_img)
        except Exception as e:
            print(f"[StampService] Failed to load materai: {e}")

    # 5. Place admin signature (Layer 2 - Middle)
    if admin_signature_b64:
        _draw_spotlight(canvas, sig_x + sig_box_w // 2, sig_y + sig_box_h // 2,
                        max(sig_box_w, sig_box_h) // 2 + 20, _resolve_color(stamp_color))
        sig_block = _create_signature_block(
            admin_signature_b64, sig_box_w, sig_box_h, label="TTD Admin", stamp_color=stamp_color
        )
        canvas.paste(sig_block, (sig_x, sig_y), sig_block)

    # 6. Overlay koperasi stamp (Layer 3 - Top)
    if stamp_applied:
        _draw_spotlight(canvas, stamp_x + stamp_diameter // 2, stamp_y + stamp_diameter // 2,
                        stamp_diameter // 2 + 20, _resolve_color(stamp_color))
        stamp = _create_koperasi_stamp(stamp_diameter, stamp_color=stamp_color, stamp_name=stamp_name)
        canvas.paste(stamp, (stamp_x, stamp_y), stamp)

    # 6. Draw audit trail footer band
    _draw_audit_footer(
        draw, img_w, new_h, footer_h,
        sha256_hash=sha256_hash,
        original_url=original_image_url,
        source=source,
    )

    # 7. Convert to JPEG bytes
    output = io.BytesIO()
    rgb_canvas = Image.new("RGB", canvas.size, (255, 255, 255))
    rgb_canvas.paste(canvas, mask=canvas.split()[3] if canvas.mode == "RGBA" else None)
    rgb_canvas.save(output, format="JPEG", quality=94)
    return output.getvalue()


def stamp_preview_image(
    original_image_url: str,
    admin_signature_b64: Optional[str] = None,
    stamp_applied: bool = True,
    nominal: int = 0,
    coords: Optional[dict] = None,
    max_preview_width: int = 800,
    stamp_color: str = "red",
    stamp_name: str = "KOPERASI MITRA SEJAHTERA",
) -> Optional[dict]:
    """
    Generate a low-resolution preview JPEG suitable for the drag-and-drop UI.

    The preview is identical to the final stamp_original_image rendering but
    downscaled to ``max_preview_width`` pixels wide so it loads quickly in the
    browser.  Returns:
        {
          "image_b64": "<base64 JPEG>",
          "orig_w": <full-res canvas width>,
          "orig_h": <full-res canvas height>,
          "preview_w": <preview width>,
          "preview_h": <preview height>,
          "scale": <preview_w / orig_w>   # frontend must divide coords by this
        }
    as a dict, or None on failure.
    """
    original = _download_image(original_image_url)
    if original is None:
        return None

    img_w, img_h = original.size
    margin = int(min(img_w, img_h) * _MARGIN_RATIO)

    header_h = max(36, int(img_h * _HEADER_H_RATIO))
    footer_h = max(60, int(img_h * _FOOTER_H_RATIO))
    stamp_diameter = max(140, int(img_w * _STAMP_SIZE_RATIO))
    sig_box_w = max(120, int(img_w * _SIG_BOX_W_RATIO))
    sig_box_h = max(60, int(img_w * _SIG_BOX_H_RATIO))
    materai_w = max(80, int(img_w * 0.1))
    materai_h = int(materai_w * 1.33)

    new_h = img_h + header_h + footer_h
    canvas = Image.new("RGBA", (img_w, new_h), (255, 255, 255, 255))
    canvas.paste(original, (0, header_h), original)
    draw = ImageDraw.Draw(canvas)
    _draw_header_band(draw, img_w, header_h)

    # Default positions — stamp bottom-right, TTD centered on stamp
    stamp_x = img_w - stamp_diameter - margin - 10
    stamp_y = header_h + img_h - stamp_diameter - margin - 20
    stamp_cx = stamp_x + stamp_diameter // 2
    stamp_cy = stamp_y + stamp_diameter // 2

    # TTD always centered on stamp so they overlap (nempel)
    sig_x = stamp_cx - sig_box_w // 2
    sig_y = stamp_cy - sig_box_h // 2

    # Materai (for >= 1M): vertically aligned with stamp, to its left
    materai_x = max(margin, stamp_x - materai_w - 20)
    materai_y = stamp_y + (stamp_diameter - materai_h) // 2

    if coords:
        if coords.get("materai"):
            materai_x = int(coords["materai"]["x"])
            materai_y = int(coords["materai"]["y"]) + header_h
        if coords.get("ttd"):
            sig_x = int(coords["ttd"]["x"])
            sig_y = int(coords["ttd"]["y"]) + header_h
        if coords.get("stamp"):
            stamp_x = int(coords["stamp"]["x"])
            stamp_y = int(coords["stamp"]["y"]) + header_h

    materai_rotation = float((coords or {}).get("materai", {}).get("rotation", 0) if coords else 0)

    # Materai disabled (sementara dinonaktifkan)
    if False and nominal >= 1000000:
        pass  # noqa

    if admin_signature_b64:
        _draw_spotlight(canvas, sig_x + sig_box_w // 2, sig_y + sig_box_h // 2,
                        max(sig_box_w, sig_box_h) // 2 + 20, _resolve_color(stamp_color))
        sig_block = _create_signature_block(admin_signature_b64, sig_box_w, sig_box_h, label="TTD Admin", stamp_color=stamp_color)
        canvas.paste(sig_block, (sig_x, sig_y), sig_block)

    if stamp_applied:
        _draw_spotlight(canvas, stamp_x + stamp_diameter // 2, stamp_y + stamp_diameter // 2,
                        stamp_diameter // 2 + 20, _resolve_color(stamp_color))
        stamp = _create_koperasi_stamp(stamp_diameter, stamp_color=stamp_color, stamp_name=stamp_name)
        canvas.paste(stamp, (stamp_x, stamp_y), stamp)

    orig_w, orig_h = canvas.size
    if orig_w > max_preview_width:
        scale = max_preview_width / orig_w
        preview_w = max_preview_width
        preview_h = int(orig_h * scale)
        canvas = canvas.resize((preview_w, preview_h), Image.LANCZOS)
    else:
        scale = 1.0
        preview_w, preview_h = orig_w, orig_h

    rgb = Image.new("RGB", canvas.size, (255, 255, 255))
    rgb.paste(canvas, mask=canvas.split()[3] if canvas.mode == "RGBA" else None)
    buf = io.BytesIO()
    rgb.save(buf, format="JPEG", quality=82)
    image_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "image_b64": image_b64,
        "orig_w": orig_w,
        "orig_h": orig_h,
        "preview_w": preview_w,
        "preview_h": preview_h,
        "scale": round(preview_w / orig_w, 6),
        # Default component positions in original-canvas space (before header offset)
        "default_coords": {
            "materai": {"x": materai_x, "y": materai_y - header_h, "w": materai_w, "h": materai_h},
            "ttd": {"x": sig_x, "y": sig_y - header_h, "w": sig_box_w, "h": sig_box_h},
            "stamp": {"x": stamp_x, "y": stamp_y - header_h, "w": stamp_diameter, "h": stamp_diameter},
        },
    }
