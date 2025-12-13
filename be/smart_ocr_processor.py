"""
Smart OCR & Text Processing Module
File: be/smart_ocr_processor.py

Advanced OCR processing dengan AI untuk akurasi tinggi + Hybrid (API + Tesseract)
"""

import re
import json
from typing import Dict, List, Any, Optional, Tuple
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
import io
import base64
import requests
from datetime import datetime

# Import Tesseract untuk hybrid OCR (optional untuk Render)
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
    print("✅ Tesseract available for hybrid OCR")
except ImportError:
    TESSERACT_AVAILABLE = False
    print("⚠️ Pytesseract not available - API-only mode (Render deployment)")

class SmartOCRProcessor:
    """Advanced OCR dengan preprocessing dan AI enhancement"""
    
    def __init__(self, ocr_api_key: str):
        self.ocr_api_key = ocr_api_key
        self.ocr_api_url = "https://api.ocr.space/parse/image"
        
        # Enhanced OCR patterns untuk berbagai jenis dokumen
        self.document_patterns = {
            "invoice": {
                "indicators": ["INVOICE", "FAKTUR", "TAGIHAN", "BILL", "INV"],
                "extract_patterns": {
                    "invoice_number": [
                        r"(?:INVOICE|INV|FAKTUR)\s*(?:NO|NUMBER|#)?\s*:?\s*([A-Z0-9/-]+)",
                        r"(?:NO|NUMBER|NOMOR)\s*(?:INVOICE|INV|FAKTUR)?\s*:?\s*([A-Z0-9/-]+)"
                    ],
                    "total_amount": [
                        r"(?:TOTAL|JUMLAH|AMOUNT)\s*:?\s*(?:RP\.?|IDR)?\s*([\d,.]+)",
                        r"(?:RP\.?|IDR)\s*([\d,.]+)\s*(?:TOTAL|JUMLAH)?"
                    ],
                    "date": [
                        r"(?:DATE|TANGGAL|TGL)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
                        r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"
                    ],
                    "vendor": [
                        r"(?:PT|CV|UD|TOKO)\s+([A-Z\s]{3,30})",
                        r"(?:VENDOR|SUPPLIER)\s*:?\s*([A-Z\s]+)"
                    ]
                }
            },
            "delivery_note": {
                "indicators": ["SURAT JALAN", "DELIVERY", "PENGIRIMAN", "DO"],
                "extract_patterns": {
                    "do_number": [
                        r"(?:DO|SURAT JALAN)\s*(?:NO|NUMBER)?\s*:?\s*([A-Z0-9/-]+)"
                    ],
                    "recipient": [
                        r"(?:KEPADA|TO|PENERIMA)\s*:?\s*([A-Z\s]+)"
                    ],
                    "items": [
                        r"(\d+)\s+(PCS|UNIT|KG|LITER)\s+([A-Z\s]+)"
                    ]
                }
            },
            "purchase_order": {
                "indicators": ["PO", "PURCHASE ORDER", "PESANAN"],
                "extract_patterns": {
                    "po_number": [
                        r"(?:PO|PURCHASE ORDER)\s*(?:NO|NUMBER)?\s*:?\s*([A-Z0-9/-]+)"
                    ]
                }
            }
        }
    
    def preprocess_image(self, image_np: np.ndarray) -> Image.Image:
        """Enhanced image preprocessing untuk OCR yang lebih akurat"""
        try:
            # Convert numpy array to PIL Image
            image = Image.fromarray(image_np)
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # 1. Enhance contrast
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.5)
            
            # 2. Enhance sharpness
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(1.3)
            
            # 3. Adjust brightness slightly
            enhancer = ImageEnhance.Brightness(image)
            image = enhancer.enhance(1.1)
            
            # 4. Apply slight gaussian blur to smooth noise
            image = image.filter(ImageFilter.GaussianBlur(radius=0.5))
            
            # 5. Resize untuk OCR optimal (1000-2000px width)
            if image.width < 800:
                # Upscale small images
                scale = 1200 / image.width
                new_size = (int(image.width * scale), int(image.height * scale))
                image = image.resize(new_size, Image.Resampling.LANCZOS)
            elif image.width > 2500:
                # Downscale very large images
                scale = 2000 / image.width
                new_size = (int(image.width * scale), int(image.height * scale))
                image = image.resize(new_size, Image.Resampling.LANCZOS)
            
            return image
            
        except Exception as e:
            print(f"Error preprocessing image: {e}")
            # Fallback: return original
            return Image.fromarray(image_np)
    
    async def enhanced_ocr_extract(self, image_np: np.ndarray) -> str:
        """🔥 HYBRID OCR: API first, then Tesseract fallback"""
        try:
            # 🌐 STEP 1: Try API OCR first (primary method)
            print("🔥 Trying API OCR first...")
            api_result = await self._api_ocr_extract(image_np)
            
            if api_result and api_result.strip() and not api_result.startswith("[ERROR"):
                print("✅ API OCR successful!")
                return api_result
            else:
                print("⚠️ API OCR failed or returned empty result")
                raise Exception("API OCR failed or empty result")
        
        except Exception as api_error:
            print(f"🔄 API OCR failed: {api_error}")
            
            # 🖥️ STEP 2: Fallback to Tesseract VPS OCR (if available)
            if TESSERACT_AVAILABLE:
                print("🔧 Switching to Tesseract VPS OCR...")
                try:
                    tesseract_result = self._tesseract_ocr_extract(image_np)
                    if tesseract_result and tesseract_result.strip():
                        print("✅ Tesseract OCR successful!")
                        return tesseract_result
                    else:
                        print("⚠️ Tesseract OCR returned empty result")
                except Exception as tesseract_error:
                    print(f"❌ Tesseract OCR failed: {tesseract_error}")
            else:
                print("❌ Tesseract not available - API-only deployment (Render)")
            
            # 🆘 Final fallback - return basic error with fallback text
            return "[ERROR] API OCR failed - Please try again or use a clearer image"

    async def _api_ocr_extract(self, image_np: np.ndarray) -> str:
        """API OCR extraction (original method)"""
        try:
            # Preprocess image
            processed_image = self.preprocess_image(image_np)
            
            # Convert to base64
            img_byte_arr = io.BytesIO()
            processed_image.save(img_byte_arr, format='JPEG', quality=95)
            img_byte_arr = img_byte_arr.getvalue()
            base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
            
            # Enhanced OCR parameters
            payload = {
                'apikey': self.ocr_api_key,
                'base64Image': f'data:image/jpeg;base64,{base64_image}',
                'language': 'eng',
                'isOverlayRequired': True,  # Get position info
                'detectOrientation': True,  # Auto rotate
                'scale': True,
                'OCREngine': 2,  # Use engine 2 for better accuracy
                'isTable': True   # Better table detection
            }
            
            print("📡 API OCR processing...")
            response = requests.post(self.ocr_api_url, data=payload, timeout=45)
            result = response.json()
            
            if result.get('IsErroredOnProcessing', False):
                error_msg = result.get('ErrorMessage', 'Unknown API error')
                return f"[ERROR] API: {error_msg}"
            
            # Extract text from all pages
            all_text = ""
            if 'ParsedResults' in result and result['ParsedResults']:
                for parsed_result in result['ParsedResults']:
                    if 'ParsedText' in parsed_result:
                        all_text += parsed_result['ParsedText'] + "\n"
            
            return all_text.strip() if all_text else "[ERROR] No text extracted by API"
            
        except Exception as e:
            print(f"API OCR error: {e}")
            return f"[ERROR] API exception: {str(e)}"
    
    def _tesseract_ocr_extract(self, image_np: np.ndarray) -> str:
        """Tesseract VPS OCR extraction (fallback)"""
        try:
            # Preprocess image for Tesseract
            processed_image = self.preprocess_image(image_np)
            
            # Configure Tesseract for better accuracy
            custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/:()- '
            
            # Extract text using Tesseract
            print("🖥️ Tesseract VPS processing...")
            text = pytesseract.image_to_string(processed_image, config=custom_config)
            
            # Clean up extracted text
            cleaned_text = self._clean_tesseract_text(text)
            
            return cleaned_text
            
        except Exception as e:
            print(f"Tesseract OCR error: {e}")
            return f"[ERROR] Tesseract exception: {str(e)}"
    
    def _clean_tesseract_text(self, text: str) -> str:
        """Clean and improve Tesseract extracted text"""
        if not text:
            return ""
        
        # Remove extra whitespace and normalize
        lines = []
        for line in text.split('\n'):
            line = line.strip()
            if line:  # Skip empty lines
                lines.append(line)
        
        return '\n'.join(lines)
    
    def post_process_ocr_text(self, raw_text: str) -> str:
        """Clean up OCR text dengan pattern correction"""
        try:
            text = raw_text
            
            # 1. Fix common OCR mistakes
            ocr_corrections = {
                r'\b0\b': 'O',  # Zero to O in text
                r'\bO\b': '0',  # O to zero in numbers context
                r'(?<=\d)\s+(?=\d)': '',  # Remove spaces in numbers
                r'([A-Z])\s+([A-Z])\s+([A-Z])': r'\1\2\3',  # Fix spaced uppercase
                r'\s{2,}': ' ',  # Multiple spaces to single
                r'[\r\n]+': '\n',  # Fix line breaks
            }
            
            for pattern, replacement in ocr_corrections.items():
                text = re.sub(pattern, replacement, text)
            
            # 2. Fix Indonesian specific terms
            indonesian_fixes = {
                'TANGGAL': ['TANGCAL', 'TANGGAI', 'TANGGA1'],
                'INVOICE': ['INV0ICE', 'INV01CE', 'INVO1CE'],
                'JUMLAH': ['JUMIAH', 'JUML4H', 'JUMLA4'],
                'TOTAL': ['T0TAL', 'TOTA1', 'TOT4L'],
                'FAKTUR': ['FAKIUR', 'F4KTUR', 'FAKIUR']
            }
            
            for correct, mistakes in indonesian_fixes.items():
                for mistake in mistakes:
                    text = text.replace(mistake, correct)
            
            return text.strip()
            
        except Exception as e:
            print(f"Post-processing error: {e}")
            return raw_text
    
    def detect_document_type(self, text: str) -> str:
        """Deteksi jenis dokumen berdasarkan keywords"""
        text_upper = text.upper()
        
        for doc_type, config in self.document_patterns.items():
            indicators = config["indicators"]
            for indicator in indicators:
                if indicator in text_upper:
                    return doc_type
        
        return "unknown"
    
    def extract_structured_data(self, text: str, doc_type: str) -> Dict[str, Any]:
        """Extract structured data berdasarkan jenis dokumen"""
        if doc_type not in self.document_patterns:
            return {}
        
        patterns = self.document_patterns[doc_type]["extract_patterns"]
        extracted = {}
        
        for field, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    extracted[field] = match.group(1).strip()
                    break
        
        return extracted
    
    def generate_smart_summary(self, text: str, extracted_data: Dict[str, Any], doc_type: str) -> str:
        """Generate ringkasan cerdas berdasarkan data yang diekstrak"""
        try:
            if doc_type == "invoice":
                return self._generate_invoice_summary(extracted_data, text)
            elif doc_type == "delivery_note":
                return self._generate_delivery_summary(extracted_data, text)
            elif doc_type == "purchase_order":
                return self._generate_po_summary(extracted_data, text)
            else:
                return self._generate_generic_summary(text)
                
        except Exception as e:
            print(f"Error generating summary: {e}")
            return self._generate_generic_summary(text)
    
    def _generate_invoice_summary(self, data: Dict[str, Any], text: str) -> str:
        """Generate summary untuk invoice"""
        summary_parts = []
        
        # Invoice number
        if 'invoice_number' in data:
            summary_parts.append(f"Invoice {data['invoice_number']}")
        
        # Vendor
        if 'vendor' in data:
            summary_parts.append(f"dari {data['vendor']}")
        
        # Amount
        if 'total_amount' in data:
            amount = data['total_amount'].replace(',', '.')
            summary_parts.append(f"senilai Rp {amount}")
        
        # Date
        if 'date' in data:
            summary_parts.append(f"tanggal {data['date']}")
        
        if summary_parts:
            return " ".join(summary_parts)
        else:
            # Fallback dengan AI pattern
            return self._ai_extract_invoice_summary(text)
    
    def _generate_delivery_summary(self, data: Dict[str, Any], text: str) -> str:
        """Generate summary untuk surat jalan"""
        summary_parts = ["Surat Jalan"]
        
        if 'do_number' in data:
            summary_parts.append(f"No. {data['do_number']}")
        
        if 'recipient' in data:
            summary_parts.append(f"kepada {data['recipient']}")
        
        # Count items
        items = re.findall(r'(\d+)\s+(PCS|UNIT|KG|LITER|BOX)', text.upper())
        if items:
            total_items = sum(int(item[0]) for item in items)
            summary_parts.append(f"berisi {total_items} item")
        
        return " ".join(summary_parts)
    
    def _generate_po_summary(self, data: Dict[str, Any], text: str) -> str:
        """Generate summary untuk purchase order"""
        summary_parts = ["Purchase Order"]
        
        if 'po_number' in data:
            summary_parts.append(f"No. {data['po_number']}")
        
        return " ".join(summary_parts)
    
    def _generate_generic_summary(self, text: str) -> str:
        """Generate summary generic untuk dokumen tidak dikenal"""
        # Ambil 3 baris pertama yang meaningful
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        meaningful_lines = []
        
        for line in lines[:5]:
            # Skip lines yang hanya angka atau terlalu pendek
            if len(line) > 5 and not line.isdigit() and not re.match(r'^\d+[\s.,]*$', line):
                meaningful_lines.append(line)
                if len(meaningful_lines) >= 2:
                    break
        
        if meaningful_lines:
            return " - ".join(meaningful_lines[:2])
        else:
            return "Dokumen terdeteksi namun perlu verifikasi manual"
    
    def _ai_extract_invoice_summary(self, text: str) -> str:
        """AI-powered fallback untuk extract invoice summary"""
        try:
            # Simple pattern-based extraction
            lines = text.split('\n')
            
            # Look for amounts
            amount_pattern = r'(?:RP\.?|IDR)\s*([\d,.]+)|(?:TOTAL|JUMLAH)\s*:?\s*(?:RP\.?|IDR)?\s*([\d,.]+)'
            for line in lines:
                match = re.search(amount_pattern, line.upper())
                if match:
                    amount = match.group(1) or match.group(2)
                    return f"Invoice senilai Rp {amount}"
            
            # Fallback: first meaningful line
            for line in lines:
                if len(line.strip()) > 10 and any(word in line.upper() for word in ['INVOICE', 'FAKTUR', 'TAGIHAN']):
                    return line.strip()
            
            return "Invoice - verifikasi manual diperlukan"
            
        except Exception as e:
            return "Dokumen invoice terdeteksi"