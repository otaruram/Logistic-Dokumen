import pytesseract
from PIL import Image
from openai import OpenAI
import httpx
from typing import Tuple, Optional
import time
import os
import random
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
openai_client = None
try:
    if settings.OPENAI_API_KEY:
        # Tambahkan timeout lebih lama (30 detik) untuk koneksi lambat
        http_client = httpx.Client(timeout=30.0)
        
        openai_client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
            http_client=http_client
        )
        print("✅ OpenAI client initialized")
except Exception as e:
    print(f"⚠️ OpenAI Client Init Failed: {e}")

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
                print(f"⚠️ Groq API Key {idx+1} Init Failed: {e}")
        
        if groq_clients:
            print(f"✅ Groq fallback initialized with {len(groq_clients)} API key(s)")
except Exception as e:
    print(f"⚠️ Groq Setup Failed: {e}")

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
        """Try OpenAI first, fallback to Groq if OpenAI fails"""
        
        # Try OpenAI first
        if openai_client:
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "Fix OCR typos. Return only corrected text."},
                        {"role": "user", "content": text}
                    ],
                    temperature=0.3
                )
                print("✅ Enhanced with OpenAI")
                return response.choices[0].message.content.strip()
            except Exception as e:
                print(f"⚠️ OpenAI Enhancement Error: {e}")
                print("🔄 Trying Groq fallback...")
        
        # Fallback to Groq if OpenAI failed or not available
        if groq_clients:
            # Try each Groq key in random order
            groq_keys_shuffled = groq_clients.copy()
            random.shuffle(groq_keys_shuffled)
            
            for idx, client in enumerate(groq_keys_shuffled):
                try:
                    response = client.chat.completions.create(
                        model=settings.GROQ_MODEL,
                        messages=[
                            {"role": "system", "content": "Fix OCR typos. Return only corrected text."},
                            {"role": "user", "content": text}
                    ],
                        temperature=0.3
                    )
                    print(f"✅ Enhanced with Groq (key {idx+1})")
                    return response.choices[0].message.content.strip()
                except Exception as e:
                    print(f"⚠️ Groq key {idx+1} failed: {e}")
                    continue
        
        # If all failed, return original text
        print("⚠️ All AI enhancement failed, returning original text")
        return text
    
    @staticmethod
    async def process_image(image_path: str, use_ai_enhancement: bool = True) -> dict:
        raw_text, confidence, processing_time = await OCRService.extract_text_tesseract(image_path)
        
        enhanced_text = raw_text
        # Hanya panggil AI jika ada teks hasil OCR
        if use_ai_enhancement and raw_text and "Error" not in raw_text:
            enhanced_text = await OCRService.enhance_with_openai(raw_text)
        
        return {
            "raw_text": raw_text,
            "enhanced_text": enhanced_text,
            "confidence_score": confidence,
            "processing_time": processing_time
        }