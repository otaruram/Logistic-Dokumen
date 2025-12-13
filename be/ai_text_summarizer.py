"""
AI Text Summarizer Module
File: be/ai_summarizer.py

Advanced AI-powered text summarization using SumoPod API
"""

import json
import re
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime

class AITextSummarizer:
    """AI-powered text summarization dengan SumoPod API"""
    
    def __init__(self, sumopod_api_key: str):
        self.api_key = sumopod_api_key
        self.api_url = "https://rest.sumopod.ai/api/v1/chat/completions"
        
        # Document-specific prompts untuk berbagai jenis dokumen
        self.document_prompts = {
            "invoice": {
                "system_prompt": """Anda adalah ahli analisis dokumen invoice/faktur. 
                Buat ringkasan singkat dan informatif dalam bahasa Indonesia untuk dokumen invoice.
                Format ringkasan: [Jenis Dokumen] - [Info Utama] - [Nominal jika ada] - [Tanggal jika ada]
                Contoh: "Invoice INV/2024/001 dari PT ABC senilai Rp 1,500,000 tanggal 15 Des 2024"
                Maksimal 150 karakter.""",
                "extraction_focus": ["nomor invoice", "vendor/penerbit", "total amount", "tanggal", "items utama"]
            },
            "delivery_note": {
                "system_prompt": """Anda adalah ahli analisis surat jalan/delivery note.
                Buat ringkasan singkat dalam bahasa Indonesia untuk dokumen surat jalan.
                Format: [Jenis Dokumen] - [Nomor] - [Penerima] - [Jumlah item]
                Contoh: "Surat Jalan SJ/2024/001 kepada PT XYZ berisi 25 item"
                Maksimal 150 karakter.""",
                "extraction_focus": ["nomor surat jalan", "penerima", "pengirim", "jumlah dan jenis item"]
            },
            "purchase_order": {
                "system_prompt": """Anda adalah ahli analisis purchase order/pesanan.
                Buat ringkasan singkat dalam bahasa Indonesia untuk dokumen PO.
                Format: [Jenis Dokumen] - [Nomor PO] - [Vendor] - [Info tambahan]
                Contoh: "Purchase Order PO/2024/001 kepada PT DEF"
                Maksimal 150 karakter.""",
                "extraction_focus": ["nomor PO", "vendor", "requestor", "items yang dipesan"]
            },
            "receipt": {
                "system_prompt": """Anda adalah ahli analisis bukti pembayaran/kuitansi.
                Buat ringkasan singkat dalam bahasa Indonesia untuk bukti pembayaran.
                Format: [Jenis Dokumen] - [Dari/Ke siapa] - [Nominal] - [Untuk keperluan apa]
                Contoh: "Kuitansi pembayaran Rp 500,000 untuk sewa kantor"
                Maksimal 150 karakter.""",
                "extraction_focus": ["nominal pembayaran", "pihak yang membayar/menerima", "keperluan pembayaran"]
            },
            "unknown": {
                "system_prompt": """Anda adalah ahli analisis dokumen umum.
                Buat ringkasan singkat dalam bahasa Indonesia untuk dokumen ini.
                Fokus pada informasi yang paling penting dan relevan.
                Format: [Jenis/topik dokumen] - [Info utama yang terdeteksi]
                Maksimal 150 karakter.""",
                "extraction_focus": ["jenis dokumen", "informasi utama", "tanggal", "nominal jika ada"]
            }
        }
    
    async def generate_intelligent_summary(
        self, 
        text: str, 
        doc_type: str, 
        structured_data: Dict[str, Any]
    ) -> str:
        """Generate AI-powered summary berdasarkan jenis dokumen"""
        try:
            # Validasi input
            if not text or text.startswith("[ERROR"):
                return "Tidak dapat membuat ringkasan dari teks yang rusak"
            
            # Pilih prompt berdasarkan jenis dokumen
            prompt_config = self.document_prompts.get(doc_type, self.document_prompts["unknown"])
            
            # Build context dengan structured data
            context_info = self._build_context_info(structured_data, doc_type)
            
            # Create user prompt
            user_prompt = self._create_analysis_prompt(text, context_info, prompt_config)
            
            # Call SumoPod AI
            ai_response = await self._call_sumopod_ai(
                system_prompt=prompt_config["system_prompt"],
                user_prompt=user_prompt
            )
            
            if ai_response and not ai_response.startswith("[ERROR"):
                # Post-process AI response
                clean_summary = self._clean_ai_response(ai_response)
                return clean_summary
            else:
                # Fallback ke rule-based summary
                return self._generate_fallback_summary(text, doc_type, structured_data)
                
        except Exception as e:
            print(f"AI summarization error: {e}")
            return self._generate_fallback_summary(text, doc_type, structured_data)
    
    def _build_context_info(self, structured_data: Dict[str, Any], doc_type: str) -> str:
        """Build context information dari structured data"""
        if not structured_data:
            return ""
        
        context_parts = []
        
        # Format structured data berdasarkan jenis dokumen
        if doc_type == "invoice":
            if 'invoice_number' in structured_data:
                context_parts.append(f"Nomor Invoice: {structured_data['invoice_number']}")
            if 'vendor' in structured_data:
                context_parts.append(f"Vendor: {structured_data['vendor']}")
            if 'total_amount' in structured_data:
                context_parts.append(f"Total: Rp {structured_data['total_amount']}")
            if 'date' in structured_data:
                context_parts.append(f"Tanggal: {structured_data['date']}")
                
        elif doc_type == "delivery_note":
            if 'do_number' in structured_data:
                context_parts.append(f"No. DO: {structured_data['do_number']}")
            if 'recipient' in structured_data:
                context_parts.append(f"Penerima: {structured_data['recipient']}")
                
        elif doc_type == "purchase_order":
            if 'po_number' in structured_data:
                context_parts.append(f"No. PO: {structured_data['po_number']}")
        
        return " | ".join(context_parts) if context_parts else ""
    
    def _create_analysis_prompt(self, text: str, context_info: str, prompt_config: Dict) -> str:
        """Create comprehensive analysis prompt untuk AI"""
        # Truncate text jika terlalu panjang
        max_text_length = 2000
        display_text = text[:max_text_length] + "..." if len(text) > max_text_length else text
        
        prompt_parts = [
            "Analisis dokumen berikut dan buat ringkasan yang akurat:",
            "",
            "TEKS DOKUMEN:",
            display_text,
            ""
        ]
        
        if context_info:
            prompt_parts.extend([
                "DATA TERSTRUKTUR:",
                context_info,
                ""
            ])
        
        prompt_parts.extend([
            "FOKUS EKSTRAKSI:",
            ", ".join(prompt_config["extraction_focus"]),
            "",
            "Buat ringkasan yang singkat, akurat, dan informatif."
        ])
        
        return "\n".join(prompt_parts)
    
    async def _call_sumopod_ai(self, system_prompt: str, user_prompt: str) -> str:
        """Call SumoPod AI API dengan error handling"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json',
            }
            
            payload = {
                'model': 'gpt-4o-mini',  # Model yang cost-effective
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'max_tokens': 200,  # Limit untuk summary singkat
                'temperature': 0.3,  # Low temperature untuk konsistensi
                'stream': False
            }
            
            print("Calling SumoPod AI for intelligent summary...")
            response = requests.post(
                self.api_url, 
                headers=headers, 
                json=payload, 
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result['choices'][0]['message']['content'].strip()
                print("AI summary generated successfully")
                return ai_response
            else:
                print(f"SumoPod AI error: {response.status_code} - {response.text}")
                return f"[ERROR AI: {response.status_code}]"
                
        except requests.Timeout:
            print("SumoPod AI timeout")
            return "[ERROR AI: Timeout]"
        except Exception as e:
            print(f"SumoPod AI call failed: {e}")
            return f"[ERROR AI: {str(e)}]"
    
    def _clean_ai_response(self, ai_response: str) -> str:
        """Clean dan format AI response"""
        try:
            # Remove extra whitespace dan newlines
            clean_response = re.sub(r'\s+', ' ', ai_response).strip()
            
            # Remove quotes jika AI memberikan response dalam quotes
            if clean_response.startswith('"') and clean_response.endswith('"'):
                clean_response = clean_response[1:-1]
            
            # Ensure maksimal 150 karakter
            if len(clean_response) > 150:
                # Cut di akhir kata terdekat
                truncated = clean_response[:147]
                last_space = truncated.rfind(' ')
                if last_space > 100:  # Pastikan tidak terlalu pendek
                    clean_response = truncated[:last_space] + "..."
                else:
                    clean_response = truncated + "..."
            
            return clean_response
            
        except Exception as e:
            print(f"Error cleaning AI response: {e}")
            return ai_response[:150] + "..." if len(ai_response) > 150 else ai_response
    
    def _generate_fallback_summary(self, text: str, doc_type: str, structured_data: Dict) -> str:
        """Generate fallback summary jika AI gagal"""
        try:
            # Gunakan structured data jika ada
            if structured_data:
                if doc_type == "invoice":
                    parts = ["Invoice"]
                    if 'invoice_number' in structured_data:
                        parts.append(f"No. {structured_data['invoice_number']}")
                    if 'vendor' in structured_data:
                        parts.append(f"dari {structured_data['vendor']}")
                    if 'total_amount' in structured_data:
                        amount = structured_data['total_amount'].replace(',', '.')
                        parts.append(f"Rp {amount}")
                    return " ".join(parts)
                    
                elif doc_type == "delivery_note":
                    parts = ["Surat Jalan"]
                    if 'do_number' in structured_data:
                        parts.append(f"No. {structured_data['do_number']}")
                    if 'recipient' in structured_data:
                        parts.append(f"kepada {structured_data['recipient']}")
                    return " ".join(parts)
            
            # Fallback ke text-based extraction
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            
            # Cari line yang mengandung info penting
            for line in lines[:5]:
                if len(line) > 10 and not line.isdigit():
                    # Check for document indicators
                    if any(indicator in line.upper() for indicator in ['INVOICE', 'FAKTUR', 'SURAT JALAN', 'DELIVERY']):
                        return line[:147] + "..." if len(line) > 150 else line
            
            # Last resort: first meaningful line
            for line in lines[:3]:
                if len(line) > 10:
                    return line[:147] + "..." if len(line) > 150 else line
            
            return "Dokumen berhasil dipindai - verifikasi manual diperlukan"
            
        except Exception as e:
            return "Dokumen terdeteksi namun perlu verifikasi"