import pytesseract
from PIL import Image
from openai import OpenAI
import httpx
from typing import Tuple, Optional
import time
import os
from config.settings import settings

# --- PERBAIKAN JALUR TESSERACT (HARDCODE WINDOWS) ---
# Kita paksa cek lokasi default Windows jika setting env gagal
DEFAULT_WIN_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

if os.path.exists(settings.TESSERACT_CMD):
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
elif os.path.exists(DEFAULT_WIN_PATH):
    print(f"⚠️ Menggunakan jalur Tesseract default Windows: {DEFAULT_WIN_PATH}")
    pytesseract.pytesseract.tesseract_cmd = DEFAULT_WIN_PATH
else:
    # Biarkan default "tesseract" jika tidak ketemu, tapi print warning
    pytesseract.pytesseract.tesseract_cmd = "tesseract"

# --- OPENAI SETUP ---
client = None
try:
    if settings.OPENAI_API_KEY:
        # Tambahkan timeout lebih lama (30 detik) untuk koneksi lambat
        http_client = httpx.Client(timeout=30.0)
        
        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
            http_client=http_client
        )
except Exception as e:
    print(f"⚠️ OpenAI Client Init Failed: {e}")

class OCRService:
    
    @staticmethod
    async def extract_text_tesseract(image_path: str) -> Tuple[str, float, float]:
        start_time = time.time()
        try:
            # Cek final apakah exe ada
            cmd = pytesseract.pytesseract.tesseract_cmd
            if not os.path.exists(cmd) and cmd != "tesseract":
                print(f"❌ Tesseract EXE not found at: {cmd}")
                return "⚠️ Error: Tesseract OCR tidak ditemukan di laptop ini. Silakan install.", 0.0, 0.0

            img = Image.open(image_path)
            
            # OCR Process
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            text = pytesseract.image_to_string(img)
            
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            return text.strip(), avg_confidence, time.time() - start_time
            
        except ImportError:
             return "⚠️ Error: Library Tesseract belum terinstall (pip install pytesseract)", 0.0, 0.0
        except Exception as e:
            # Tangkap error spesifik 'tesseract is not installed'
            if "not installed" in str(e) or "not found" in str(e):
                return "⚠️ Tesseract tidak ditemukan. Install dari: https://github.com/UB-Mannheim/tesseract/wiki", 0.0, 0.0
            print(f"❌ Tesseract Error: {str(e)}")
            return "", 0.0, 0.0
    
    @staticmethod
    async def enhance_with_openai(text: str) -> str:
        if not client:
            return text
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Fix OCR typos. Return only corrected text."},
                    {"role": "user", "content": text}
                ],
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️ OpenAI Enhancement Error: {e}")
            return text # Kembalikan teks asli jika AI gagal (koneksi error)
    
    @staticmethod
    async def process_image(image_path: str, use_ai_enhancement: bool = True) -> dict:
        raw_text, confidence, processing_time = await OCRService.extract_text_tesseract(image_path)
        
        enhanced_text = raw_text
        # Hanya panggil AI jika ada teks hasil OCR
        if use_ai_enhancement and raw_text and client and "Error" not in raw_text:
            enhanced_text = await OCRService.enhance_with_openai(raw_text)
        
        return {
            "raw_text": raw_text,
            "enhanced_text": enhanced_text,
            "confidence_score": confidence,
            "processing_time": processing_time
        }