import pytesseract
from PIL import Image
from openai import OpenAI
import httpx
from typing import Tuple, Optional
import time
import os
import random
import json
import re
from config.settings import settings

# --- TESSERACT PATH ---
DEFAULT_WIN_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

if os.path.exists(settings.TESSERACT_CMD):
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
elif os.path.exists(DEFAULT_WIN_PATH):
    pytesseract.pytesseract.tesseract_cmd = DEFAULT_WIN_PATH
else:
    pytesseract.pytesseract.tesseract_cmd = "tesseract"

# --- OPENAI SETUP ---
openai_client = None
try:
    if settings.OPENAI_API_KEY:
        openai_client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
            http_client=httpx.Client(timeout=30.0)
        )
        print("OpenAI client initialized")
except Exception as e:
    print(f"OpenAI Client Init Failed: {e}")

# --- GROQ SETUP (BACKUP) ---
groq_clients = []
try:
    if settings.groq_api_keys:
        for idx, key in enumerate(settings.groq_api_keys):
            try:
                client = OpenAI(
                    api_key=key,
                    base_url=settings.GROQ_BASE_URL,
                    http_client=httpx.Client(timeout=30.0)
                )
                groq_clients.append(client)
            except Exception as e:
                print(f"Groq API Key {idx+1} Init Failed: {e}")
        if groq_clients:
            print(f"Groq fallback initialized with {len(groq_clients)} API key(s)")
except Exception as e:
    print(f"Groq Setup Failed: {e}")


STRUCTURED_EXTRACTION_PROMPT = """You are an OCR post-processor for Indonesian financial documents. You can handle ALL types:
- Invoice / Faktur (Bank Indonesia standard, corporate invoice)
- Surat Jalan / Delivery Order
- Struk EDC / Mesin POS (DEBIT/CREDIT card receipt)
- Bon / Nota Manual (handwritten or printed store receipt)
- Kuitansi (payment acknowledgement)
- Nota Toko / Kasir (cashier receipt, minimarket, warung)
- QRIS / E-wallet receipt (GoPay, OVO, Dana, LinkAja, ShopeePay)
- Faktur Pajak (tax invoice with NPWP)

Extract these fields from the OCR text and return ONLY a valid JSON object:
{
  "doc_type": "<one of: invoice|surat_jalan|struk_edc|bon_manual|kuitansi|nota_toko|qris|faktur_pajak|unknown>",
  "nomor_dokumen": "<string: invoice/receipt/SJ/transaction number, null if not found>",
  "tanggal_terbit": "<string: document issue date in YYYY-MM-DD, null if not found>",
  "tanggal_jatuh_tempo": "<string: due/payment date in YYYY-MM-DD, null if not found — mainly for invoice/kuitansi>",
  "nama_penjual": "<string: seller/merchant/toko/bank name, null if not found>",
  "nama_klien": "<string: buyer/recipient/customer name, null if not found>",
  "nominal_subtotal": <integer IDR subtotal before tax, null if not found>,
  "nominal_ppn": <integer IDR PPN/tax amount, null if not found>,
  "nominal_total": <integer IDR grand total — REQUIRED, extract from Total/Jumlah/Grand Total/Amount/Tagihan>,
  "metode_bayar": "<string: TUNAI/DEBIT/KREDIT/TRANSFER/QRIS/OVO/GOPAY/DANA/null>",
  "terminal_id": "<string: EDC terminal ID or merchant ID, null if not applicable>",
  "no_referensi": "<string: approval/authorization/reference/trace number for EDC or transfer, null if not found>",
  "confidence": "<'high' if 4+ fields non-null, 'medium' if 2-3 fields non-null, 'low' if 0-1 fields non-null>"
}

Extraction rules by document type:
- invoice/faktur_pajak: nomor_dokumen=Invoice No./No.Faktur, nama_klien=Kepada/Bill To/Yth., tanggal_jatuh_tempo=Jatuh Tempo/Due Date, nominal_ppn=PPN 11%
- surat_jalan: nomor_dokumen=No.SJ/Nomor Surat Jalan, nama_klien=Penerima/Kepada, tanggal_terbit=Tanggal SJ
- struk_edc: nomor_dokumen=No.Transaksi/Trace, terminal_id=TID/MID, no_referensi=Approval/Auth Code, metode_bayar=DEBIT/CREDIT, nama_penjual=Merchant Name
- bon_manual/nota_toko: nama_penjual=nama toko di header, tanggal_terbit=Tanggal/Tgl, nominal_total=Total/Jumlah
- kuitansi: nama_klien=Yang Membayar/Dari, nama_penjual=Yang Menerima, nominal_total=Telah Diterima/Sebesar Rp
- qris: metode_bayar=QRIS, no_referensi=ID Transaksi/Order ID, nama_penjual=Merchant

General rules:
- nominal values: integer IDR, strip all dots/commas ("1.500.000" → 1500000)
- dates: normalize to YYYY-MM-DD; if only DD/MM/YYYY given, convert it
- If field not found: use null, never empty string
- confidence counts: doc_type + nomor_dokumen + nama_penjual + nominal_total + any other non-null field
- Return ONLY the JSON object, no explanation"""


def _normalize_date(raw_date: str) -> str:
    """Normalize various date formats to YYYY-MM-DD."""
    parts = re.split(r'[/\-\.]', raw_date.strip())
    if len(parts) == 3:
        try:
            if len(parts[2]) == 4:  # DD/MM/YYYY
                return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            elif len(parts[0]) == 4:  # YYYY-MM-DD
                return raw_date.strip()
        except Exception:
            pass
    return raw_date.strip()


def _regex_fallback_extraction(text: str) -> dict:
    """Regex-based universal extraction as fallback when AI fails."""
    result: dict = {
        "doc_type": "unknown",
        "nomor_dokumen": None,
        "tanggal_terbit": None,
        "tanggal_jatuh_tempo": None,
        "nama_penjual": None,
        "nama_klien": None,
        "nominal_subtotal": None,
        "nominal_ppn": None,
        "nominal_total": None,
        "metode_bayar": None,
        "terminal_id": None,
        "no_referensi": None,
        "confidence": "low",
    }

    # ── Document type detection ──────────────────────────────────────────────
    text_lower = text.lower()
    if re.search(r'faktur\s*pajak|npwp|pkp', text_lower):
        result["doc_type"] = "faktur_pajak"
    elif re.search(r'surat\s*jalan|delivery\s*order|\bsj\b', text_lower):
        result["doc_type"] = "surat_jalan"
    elif re.search(r'tid\s*:|mid\s*:|terminal\s*id|approval\s*code|auth\s*code|debit|kredit\s*card', text_lower):
        result["doc_type"] = "struk_edc"
    elif re.search(r'qris|gopay|ovo\b|dana\b|shopeepay|linkaja|e-?wallet', text_lower):
        result["doc_type"] = "qris"
    elif re.search(r'kuitansi|telah\s*diterima\s*dari|yang\s*membayar', text_lower):
        result["doc_type"] = "kuitansi"
    elif re.search(r'invoice|faktur|bill\s*to|due\s*date|jatuh\s*tempo', text_lower):
        result["doc_type"] = "invoice"
    elif re.search(r'\bkasir\b|\bstruk\b|\bnota\b|\bbon\b|minimarket|indomaret|alfamart', text_lower):
        result["doc_type"] = "nota_toko"
    else:
        result["doc_type"] = "bon_manual"

    # ── Nominal total ────────────────────────────────────────────────────────
    nominal_patterns = [
        r'(?:grand\s*total|total\s*tagihan|total\s*bayar|total\s*pembayaran)[:\s]*Rp\.?\s*([\d.,]+)',
        r'(?:total|jumlah|amount|tagihan)[:\s]*Rp\.?\s*([\d.,]+)',
        r'(?:telah\s*diterima|sebesar\s*Rp)[:\s]*Rp?\.?\s*([\d.,]+)',
        r'Rp\.?\s*([\d.,]+)',
        r'(?:total|jumlah)[:\s]*([\d.,]+)',
    ]
    for pat in nominal_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            raw = match.group(1).replace('.', '').replace(',', '').strip()
            if raw.isdigit() and len(raw) >= 3:
                result["nominal_total"] = int(raw)
                break

    # ── Subtotal + PPN ───────────────────────────────────────────────────────
    sub_match = re.search(r'(?:subtotal|sub\s*total|dpp)[:\s]*Rp?\.?\s*([\d.,]+)', text, re.IGNORECASE)
    if sub_match:
        raw = sub_match.group(1).replace('.', '').replace(',', '')
        if raw.isdigit():
            result["nominal_subtotal"] = int(raw)

    ppn_match = re.search(r'(?:ppn|vat|tax)[\s\d%]*[:\s]*Rp?\.?\s*([\d.,]+)', text, re.IGNORECASE)
    if ppn_match:
        raw = ppn_match.group(1).replace('.', '').replace(',', '')
        if raw.isdigit():
            result["nominal_ppn"] = int(raw)

    # ── Document number ──────────────────────────────────────────────────────
    doc_num_patterns = [
        r'(?:no\.?\s*faktur|invoice\s*no\.?|no\.?\s*invoice)[:\s]*([A-Z0-9/\-\.]+)',
        r'(?:no\.?\s*sj|nomor\s*sj|surat\s*jalan\s*no\.?)[:\s]*([A-Z0-9/\-\.]+)',
        r'(?:no\.?\s*kuitansi|receipt\s*no\.?)[:\s]*([A-Z0-9/\-\.]+)',
        r'(?:no\.?\s*transaksi|transaction\s*id)[:\s]*([A-Z0-9/\-\.]+)',
        r'(?:no\.|nomor)[:\s]*([A-Z0-9/\-\.]{5,25})',
    ]
    for pat in doc_num_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            result["nomor_dokumen"] = match.group(1).strip()[:50]
            break

    # ── Seller / merchant name ───────────────────────────────────────────────
    seller_patterns = [
        r'(?:merchant|toko|nama\s*toko|penjual|dari\s*:)[:\s]*([^\n]{3,60})',
        r'^([A-Z][^\n]{3,50})(?:\s*\n)',  # first line often merchant name
        r'(?:PT\.|CV\.|UD\.|Toko\s|PD\.\s)([^\n]{2,50})',
    ]
    for pat in seller_patterns:
        match = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
        if match:
            result["nama_penjual"] = match.group(1).strip()[:100]
            break

    # ── Client / buyer name ──────────────────────────────────────────────────
    client_patterns = [
        r'(?:kepada\s*yth\.?|kepada|penerima|customer|client|bill\s*to|ditujukan\s*kepada|yang\s*membayar)[:\s]*([^\n]{3,80})',
        r'(?:PT\.|CV\.|UD\.|Toko\s|PD\.\s)([^\n]{2,50})',
    ]
    for pat in client_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            result["nama_klien"] = match.group(1).strip()[:100]
            break

    # ── Dates ────────────────────────────────────────────────────────────────
    issue_date_patterns = [
        r'(?:tanggal|tgl\.?|date|tanggal\s*terbit)[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})',
    ]
    for pat in issue_date_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            result["tanggal_terbit"] = _normalize_date(match.group(1))
            break

    due_date_patterns = [
        r'(?:jatuh\s*tempo|due\s*date|tgl\.?\s*tempo|batas\s*pembayaran)[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'(?:jatuh\s*tempo|due\s*date)[:\s]*(\d{4}-\d{2}-\d{2})',
    ]
    for pat in due_date_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            result["tanggal_jatuh_tempo"] = _normalize_date(match.group(1))
            break

    # ── Payment method ───────────────────────────────────────────────────────
    pay_match = re.search(
        r'\b(tunai|cash|debit|kredit|credit|transfer|qris|gopay|ovo|dana|shopeepay|linkaja)\b',
        text, re.IGNORECASE
    )
    if pay_match:
        result["metode_bayar"] = pay_match.group(1).upper()

    # ── EDC-specific ─────────────────────────────────────────────────────────
    tid_match = re.search(r'(?:tid|terminal\s*id|mid|merchant\s*id)[:\s]*([A-Z0-9]{4,20})', text, re.IGNORECASE)
    if tid_match:
        result["terminal_id"] = tid_match.group(1).strip()

    ref_match = re.search(
        r'(?:approval|auth\s*code|authorization|kode\s*autorisasi|trace|ref(?:erence)?)[:\s#]*([A-Z0-9]{4,20})',
        text, re.IGNORECASE
    )
    if ref_match:
        result["no_referensi"] = ref_match.group(1).strip()

    # ── Confidence score ─────────────────────────────────────────────────────
    core_keys = ["nomor_dokumen", "nama_penjual", "nama_klien", "nominal_total",
                 "tanggal_terbit", "metode_bayar", "no_referensi", "terminal_id"]
    found = sum(1 for k in core_keys if result.get(k) is not None)
    result["confidence"] = "high" if found >= 4 else ("medium" if found >= 2 else "low")
    return result


class OCRService:

    @staticmethod
    async def extract_text_tesseract(image_path: str) -> Tuple[str, float, float]:
        start_time = time.time()
        try:
            cmd = pytesseract.pytesseract.tesseract_cmd
            if not os.path.exists(cmd) and cmd != "tesseract":
                return "Error: Tesseract OCR tidak ditemukan.", 0.0, 0.0

            img = Image.open(image_path)

            # ── Pre-processing: reduce RAM usage ──
            # 1. Convert to grayscale (reduces memory ~66%, improves OCR)
            if img.mode != "L":
                img = img.convert("L")

            # 2. Resize large images (max 1500px on longest side — balanced speed/quality)
            MAX_DIM = 1500
            w, h = img.size
            if max(w, h) > MAX_DIM:
                ratio = MAX_DIM / max(w, h)
                img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
                print(f"📐 Resized image from {w}x{h} → {img.size[0]}x{img.size[1]}")

            # Single Tesseract call — extract text + confidence from data dict
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT, lang='ind+eng')
            text = " ".join(w for w in data['text'] if w.strip())

            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

            return text.strip(), avg_confidence, time.time() - start_time

        except Exception as e:
            if "not installed" in str(e) or "not found" in str(e):
                return "Tesseract tidak ditemukan.", 0.0, 0.0
            print(f"Tesseract Error: {str(e)}")
            return "", 0.0, 0.0

    @staticmethod
    async def enhance_with_openai(text: str) -> str:
        """Fix OCR typos using AI."""
        clients_to_try = []
        if openai_client:
            clients_to_try.append(("OpenAI", openai_client, "gpt-4o-mini"))
        if groq_clients:
            shuffled = groq_clients.copy()
            random.shuffle(shuffled)
            for i, c in enumerate(shuffled):
                clients_to_try.append((f"Groq-{i+1}", c, settings.GROQ_MODEL))

        for name, client, model in clients_to_try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "Fix OCR typos in this Indonesian logistics document. Return only corrected text."},
                        {"role": "user", "content": text}
                    ],
                    temperature=0.2
                )
                print(f"Enhanced with {name}")
                return response.choices[0].message.content.strip()
            except Exception as e:
                print(f"{name} enhancement failed: {e}")
                continue

        return text

    @staticmethod
    async def extract_fields_structured(text: str) -> dict:
        """
        Extract structured financial fields from OCR text.
        Uses OpenAI JSON mode first, falls back to regex.
        Returns: {nominal_total, nama_klien, nomor_surat_jalan, tanggal_jatuh_tempo, confidence}
        """
        clients_to_try = []
        if openai_client:
            clients_to_try.append(("OpenAI", openai_client, "gpt-4o-mini"))
        if groq_clients:
            shuffled = groq_clients.copy()
            random.shuffle(shuffled)
            for i, c in enumerate(shuffled):
                clients_to_try.append((f"Groq-{i+1}", c, settings.GROQ_MODEL))

        for name, client, model in clients_to_try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": STRUCTURED_EXTRACTION_PROMPT},
                        {"role": "user", "content": f"OCR TEXT:\n{text[:3000]}"}
                    ],
                    temperature=0.1,
                    response_format={"type": "json_object"} if "gpt" in model else None
                )
                raw = response.choices[0].message.content.strip()
                # Parse JSON
                json_match = re.search(r'\{.*\}', raw, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group())
                    print(f"Structured extraction with {name}: confidence={parsed.get('confidence', 'unknown')}")
                    return parsed
            except Exception as e:
                print(f"{name} structured extraction failed: {e}")
                continue

        # All AI failed, use regex fallback
        print("All AI failed, using regex fallback for field extraction")
        return _regex_fallback_extraction(text)

    @staticmethod
    async def process_image(image_path: str, use_ai_enhancement: bool = True) -> dict:
        raw_text, confidence, processing_time = await OCRService.extract_text_tesseract(image_path)

        enhanced_text = raw_text
        if use_ai_enhancement and raw_text and "Error" not in raw_text:
            enhanced_text = await OCRService.enhance_with_openai(raw_text)

        # Structured field extraction
        structured_fields = {}
        if enhanced_text and "Error" not in enhanced_text:
            structured_fields = await OCRService.extract_fields_structured(enhanced_text)

        return {
            "raw_text": raw_text,
            "enhanced_text": enhanced_text,
            "confidence_score": confidence,
            "processing_time": processing_time,
            "structured_fields": structured_fields
        }