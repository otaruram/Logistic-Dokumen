"""
AI Text Summarizer Module
File: be/ai_summarizer.py

Advanced AI summarization menggunakan SumoPod dengan template khusus
"""

import re
import json
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime

class AITextSummarizer:
    """AI-powered text summarizer dengan context-aware prompting"""
    
    def __init__(self, sumopod_api_key: str):
        self.api_key = sumopod_api_key
        self.base_url = "https://api.sumopod.com/v1"
        
        # Template prompts untuk berbagai jenis dokumen
        self.summary_templates = {
            "invoice": """
Analisis dokumen invoice berikut dan buat ringkasan yang akurat dalam bahasa Indonesia:

{text}

Buat ringkasan dengan format:
"Invoice [nomor] dari [vendor] senilai Rp [jumlah] tanggal [tanggal]"

Jika informasi tidak lengkap, buat ringkasan terbaik yang bisa dengan informasi yang ada.
Pastikan menggunakan format mata uang Indonesia (Rp) dan tanggal format Indonesia.
Ringkasan maksimal 100 karakter.
""",
            
            "delivery_note": """
Analisis surat jalan/delivery note berikut dan buat ringkasan dalam bahasa Indonesia:

{text}

Buat ringkasan dengan format:
"Surat Jalan [nomor] kepada [penerima] berisi [jumlah] item"

Fokus pada informasi pengiriman, penerima, dan item yang dikirim.
Ringkasan maksimal 100 karakter.
""",
            
            "purchase_order": """
Analisis purchase order berikut dan buat ringkasan dalam bahasa Indonesia:

{text}

Buat ringkasan dengan format:
"PO [nomor] untuk [supplier/vendor] item [deskripsi singkat]"

Fokus pada nomor PO, supplier, dan item utama.
Ringkasan maksimal 100 karakter.
""",
            
            "receipt": """
Analisis receipt/struk berikut dan buat ringkasan dalam bahasa Indonesia:

{text}

Buat ringkasan dengan format:
"Struk [toko/merchant] Rp [total] pada [tanggal]"

Fokus pada merchant, total belanja, dan tanggal transaksi.
Ringkasan maksimal 100 karakter.
""",
            
            "generic": """
Analisis dokumen berikut dan buat ringkasan yang informatif dalam bahasa Indonesia:

{text}

Buat ringkasan yang menangkap informasi paling penting dari dokumen.
Gunakan bahasa yang jelas dan ringkas.
Jika ada nama perusahaan, tanggal, atau nomor penting, sertakan dalam ringkasan.
Maksimal 100 karakter.
"""
        }
    
    async def generate_smart_summary(self, 
                                   text: str, 
                                   document_type: str = "generic",
                                   extracted_data: Optional[Dict[str, Any]] = None) -> str:
        """Generate ringkasan cerdas menggunakan AI"""
        try:
            # Bersihkan text terlebih dahulu
            cleaned_text = self.clean_text_for_ai(text)
            
            # Pilih template yang sesuai
            template = self.summary_templates.get(document_type, self.summary_templates["generic"])
            prompt = template.format(text=cleaned_text)
            
            # Jika ada extracted data, coba buat rule-based summary terlebih dahulu
            if extracted_data and document_type != "generic":
                rule_based_summary = self.try_rule_based_summary(extracted_data, document_type)
                if rule_based_summary:
                    return rule_based_summary
            
            # Fallback ke AI summary
            ai_summary = await self.call_sumopod_ai(prompt)
            
            if ai_summary:
                # Post-process AI result
                return self.post_process_ai_summary(ai_summary, document_type)
            else:
                # Ultimate fallback
                return self.create_fallback_summary(text, document_type)
                
        except Exception as e:
            print(f"Error generating smart summary: {e}")
            return self.create_fallback_summary(text, document_type)
    
    def clean_text_for_ai(self, text: str) -> str:
        """Clean text untuk input AI yang optimal"""
        # Remove excess whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove special characters yang bisa confuse AI
        text = re.sub(r'[^\w\s.,;:/()\-]', '', text)
        
        # Limit length untuk efisiensi API
        if len(text) > 1000:
            # Ambil bagian awal dan akhir yang penting
            lines = text.split('\n')
            important_lines = []
            
            # Ambil 10 baris pertama
            important_lines.extend(lines[:10])
            
            # Ambil baris yang mengandung keyword penting
            keywords = ['total', 'jumlah', 'invoice', 'faktur', 'tanggal', 'date', 'no', 'nomor']
            for line in lines[10:]:
                if any(keyword.lower() in line.lower() for keyword in keywords):
                    important_lines.append(line)
                    if len(important_lines) >= 20:
                        break
            
            text = '\n'.join(important_lines)
        
        return text
    
    async def call_sumopod_ai(self, prompt: str) -> Optional[str]:
        """Call SumoPod AI untuk generate summary"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {
                        "role": "system",
                        "content": "Kamu adalah asisten AI yang ahli dalam membuat ringkasan dokumen bisnis. Selalu jawab dalam bahasa Indonesia dengan ringkas dan akurat."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                "max_tokens": 150,
                "temperature": 0.3  # Lower temperature untuk konsistensi
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=20
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("choices"):
                    return result["choices"][0]["message"]["content"].strip()
            else:
                print(f"SumoPod AI error: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"Error calling SumoPod AI: {e}")
        
        return None
    
    def try_rule_based_summary(self, extracted_data: Dict[str, Any], document_type: str) -> Optional[str]:
        """Coba buat summary menggunakan extracted data dengan rules"""
        try:
            if document_type == "invoice":
                return self._create_invoice_summary(extracted_data)
            elif document_type == "delivery_note":
                return self._create_delivery_summary(extracted_data)
            elif document_type == "purchase_order":
                return self._create_po_summary(extracted_data)
            elif document_type == "receipt":
                return self._create_receipt_summary(extracted_data)
                
        except Exception as e:
            print(f"Rule-based summary error: {e}")
        
        return None
    
    def _create_invoice_summary(self, data: Dict[str, Any]) -> Optional[str]:
        """Buat invoice summary dari extracted data"""
        parts = []
        
        # Start dengan "Invoice"
        if 'invoice_number' in data:
            parts.append(f"Invoice {data['invoice_number']}")
        else:
            parts.append("Invoice")
        
        # Vendor
        if 'vendor' in data:
            vendor = data['vendor'][:20] if len(data['vendor']) > 20 else data['vendor']
            parts.append(f"dari {vendor}")
        
        # Amount
        if 'total_amount' in data:
            amount = self._format_currency(data['total_amount'])
            parts.append(f"Rp {amount}")
        
        # Date
        if 'date' in data:
            date = self._format_date(data['date'])
            if date:
                parts.append(f"tgl {date}")
        
        summary = " ".join(parts)
        return summary if len(summary) <= 100 else summary[:97] + "..."
    
    def _create_delivery_summary(self, data: Dict[str, Any]) -> Optional[str]:
        """Buat delivery note summary"""
        parts = ["Surat Jalan"]
        
        if 'do_number' in data:
            parts.append(f"No.{data['do_number']}")
        
        if 'recipient' in data:
            recipient = data['recipient'][:15] if len(data['recipient']) > 15 else data['recipient']
            parts.append(f"ke {recipient}")
        
        summary = " ".join(parts)
        return summary if len(summary) <= 100 else summary[:97] + "..."
    
    def _create_po_summary(self, data: Dict[str, Any]) -> Optional[str]:
        """Buat PO summary"""
        parts = ["PO"]
        
        if 'po_number' in data:
            parts.append(f"No.{data['po_number']}")
        
        summary = " ".join(parts)
        return summary if len(summary) <= 100 else summary[:97] + "..."
    
    def _create_receipt_summary(self, data: Dict[str, Any]) -> Optional[str]:
        """Buat receipt summary"""
        parts = ["Struk"]
        
        if 'merchant' in data:
            merchant = data['merchant'][:15] if len(data['merchant']) > 15 else data['merchant']
            parts.append(merchant)
        
        if 'total_amount' in data:
            amount = self._format_currency(data['total_amount'])
            parts.append(f"Rp {amount}")
        
        summary = " ".join(parts)
        return summary if len(summary) <= 100 else summary[:97] + "..."
    
    def _format_currency(self, amount_str: str) -> str:
        """Format currency string"""
        # Remove non-numeric characters except decimal points
        cleaned = re.sub(r'[^\d.,]', '', amount_str)
        
        # Handle different decimal separators
        if ',' in cleaned and '.' in cleaned:
            # Assume comma is thousands separator
            cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            # Could be decimal separator in some locales
            parts = cleaned.split(',')
            if len(parts) == 2 and len(parts[1]) <= 2:
                # Likely decimal separator
                cleaned = cleaned.replace(',', '.')
            else:
                # Thousands separator
                cleaned = cleaned.replace(',', '')
        
        try:
            # Format as Indonesian currency
            amount = float(cleaned)
            if amount >= 1000000:
                return f"{amount/1000000:.1f}jt"
            elif amount >= 1000:
                return f"{amount/1000:.0f}rb"
            else:
                return f"{amount:.0f}"
        except:
            return cleaned
    
    def _format_date(self, date_str: str) -> Optional[str]:
        """Format date string"""
        try:
            # Try various date formats
            date_patterns = [
                r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',
                r'(\d{2,4})[/-](\d{1,2})[/-](\d{1,2})'
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, date_str)
                if match:
                    parts = match.groups()
                    # Assume dd/mm/yyyy or mm/dd/yyyy
                    if len(parts[2]) == 4:  # yyyy
                        return f"{parts[0]}/{parts[1]}"
                    else:  # yy
                        return f"{parts[0]}/{parts[1]}/{parts[2]}"
                        
        except Exception as e:
            print(f"Date formatting error: {e}")
        
        return None
    
    def post_process_ai_summary(self, ai_response: str, document_type: str) -> str:
        """Post-process AI response untuk consistency"""
        # Remove quotes jika ada
        summary = ai_response.strip('"\'')
        
        # Ensure maksimal 100 karakter
        if len(summary) > 100:
            summary = summary[:97] + "..."
        
        # Clean up extra spaces
        summary = re.sub(r'\s+', ' ', summary).strip()
        
        return summary
    
    def create_fallback_summary(self, text: str, document_type: str) -> str:
        """Create fallback summary jika AI gagal"""
        try:
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            
            if document_type == "invoice":
                # Look for invoice-specific terms
                for line in lines:
                    if any(term in line.upper() for term in ['INVOICE', 'FAKTUR', 'INV']):
                        return f"Invoice: {line[:80]}..." if len(line) > 80 else f"Invoice: {line}"
                return "Dokumen Invoice terdeteksi"
                
            elif document_type == "delivery_note":
                return "Surat Jalan terdeteksi - perlu verifikasi"
                
            elif document_type == "purchase_order":
                return "Purchase Order terdeteksi - perlu verifikasi"
                
            elif document_type == "receipt":
                return "Struk pembelian terdeteksi - perlu verifikasi"
            
            else:
                # Generic fallback - ambil line pertama yang meaningful
                for line in lines:
                    if len(line) > 5 and not line.isdigit():
                        return line[:90] + "..." if len(line) > 90 else line
                
                return "Dokumen terdeteksi - perlu verifikasi manual"
                
        except Exception as e:
            return "Dokumen terdeteksi"