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


STRUCTURED_EXTRACTION_PROMPT = """You are an OCR post-processor for Indonesian logistics documents (Surat Jalan / Delivery Orders / Invoices).

Extract these specific fields from the given OCR text and return ONLY a valid JSON object:
{
  "nominal_total": <integer in IDR, no dots/commas, e.g. 1500000>,
  "nama_klien": "<string: company/person name, null if not found>",
  "nomor_surat_jalan": "<string: document/delivery order number, null if not found>",
  "tanggal_jatuh_tempo": "<string: due date in YYYY-MM-DD format, null if not found>",
  "confidence": "<string: 'high' if 3+ fields found, 'medium' if 2 fields, 'low' if 0-1 fields>"
}

Rules:
- nominal_total: Look for keywords like Total, Jumlah, Grand Total, Amount, Nominal followed by Rp or numbers
- nama_klien: Look for Penerima, Kepada, Customer, Client, PT., CV., UD., Toko, or company names
- nomor_surat_jalan: Look for No., Nomor, SJ, SJ-, SJ/, No.SJ, Nomor Surat Jalan, Invoice No.
- tanggal_jatuh_tempo: Look for Jatuh Tempo, Due Date, Tgl. Tempo, Batas Pembayaran
- If a field is truly not present, use null (not empty string)
- Return ONLY the JSON object, no explanation"""


def _regex_fallback_extraction(text: str) -> dict:
    """Regex-based fuzzy extraction as fallback when AI fails."""
    result = {
        "nominal_total": None,
        "nama_klien": None,
        "nomor_surat_jalan": None,
        "tanggal_jatuh_tempo": None,
        "confidence": "low"
    }

    # Nominal patterns
    nominal_patterns = [
        r'(?:total|jumlah|grand\s*total|amount|nominal)[:\s]*Rp\.?\s*([\d.,]+)',
        r'Rp\.?\s*([\d.,]+)',
        r'(?:total|jumlah)[:\s]*([\d.,]+)',
    ]
    for pat in nominal_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            raw = match.group(1).replace('.', '').replace(',', '')
            if raw.isdigit() and len(raw) >= 4:
                result["nominal_total"] = int(raw)
                break

    # Surat Jalan number patterns
    sj_patterns = [
        r'(?:no\.?\s*sj|nomor\s*sj|surat\s*jalan\s*no\.?|invoice\s*no\.?)[:\s]*([A-Z0-9/\-\.]+)',
        r'\bSJ[/\-]([A-Z0-9/\-\.]+)',
        r'(?:no\.|nomor)[:\s]*([A-Z0-9/\-\.]{5,20})',
    ]
    for pat in sj_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            result["nomor_surat_jalan"] = match.group(0).strip()[:50]
            break

    # Client name patterns
    client_patterns = [
        r'(?:kepada|penerima|customer|client|ditujukan\s*kepada)[:\s]*([^\n]{3,60})',
        r'(?:PT\.|CV\.|UD\.|Toko\s|PD\.)\s*([^\n]{2,40})',
    ]
    for pat in client_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            result["nama_klien"] = match.group(1).strip()[:100]
            break

    # Due date patterns
    date_patterns = [
        r'(?:jatuh\s*tempo|due\s*date|tgl\.?\s*tempo|batas\s*pembayaran)[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'(?:jatuh\s*tempo|due\s*date)[:\s]*(\d{4}-\d{2}-\d{2})',
    ]
    for pat in date_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            raw_date = match.group(1)
            # Normalize to YYYY-MM-DD
            parts = re.split(r'[/\-\.]', raw_date)
            if len(parts) == 3:
                try:
                    if len(parts[2]) == 4:  # DD/MM/YYYY
                        result["tanggal_jatuh_tempo"] = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                    else:  # YYYY-MM-DD
                        result["tanggal_jatuh_tempo"] = raw_date
                except:
                    result["tanggal_jatuh_tempo"] = raw_date
            break

    # Determine confidence
    found = sum(1 for v in result.values() if v is not None and v != "low")
    result["confidence"] = "high" if found >= 3 else ("medium" if found >= 2 else "low")
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
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            text = pytesseract.image_to_string(img, lang='ind+eng')

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