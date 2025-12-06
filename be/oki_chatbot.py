# oki_chatbot.py - OKi AI Chatbot Service using SumoPoD API

import requests
import json
import os
from typing import List, Dict

class OKiChatbot:
    """OKi AI Assistant for PDF document analysis"""
    
    def __init__(self):
        self.api_key = os.getenv("SUMOPOD_API_KEY")
        self.base_url = os.getenv("SUMOPOD_BASE_URL", "https://ai.sumopod.com/v1")
        self.model = "gpt-4o-mini"  # SumoPoD model
        
        if not self.api_key:
            raise ValueError("SUMOPOD_API_KEY not found in environment variables")
    
    def chat(self, messages: List[Dict[str, str]], pdf_text: str = "") -> str:
        """
        Send chat request to SumoPoD API
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            pdf_text: Optional PDF text context
            
        Returns:
            Assistant response text
        """
        try:
            # Build system prompt
            system_prompt = """Kamu adalah OKi, asisten AI yang membantu menganalisis dokumen logistik dan supply chain.

Tugas kamu:
1. Membantu user memahami isi dokumen PDF yang mereka upload
2. Menjawab pertanyaan tentang nomor dokumen, tanggal, penerima, pengirim, barang, dll
3. Memberikan ringkasan dokumen jika diminta
4. Berbicara dalam bahasa Indonesia yang ramah dan profesional

Jika user upload PDF, kamu akan mendapat teks ekstraksi dari PDF tersebut.
Jawab dengan singkat, jelas, dan to the point."""

            if pdf_text:
                system_prompt += f"\n\nDOKUMEN PDF YANG DIUPLOAD:\n{pdf_text[:4000]}"
            
            # Prepare messages for API
            api_messages = [{"role": "system", "content": system_prompt}]
            api_messages.extend(messages)
            
            # Call SumoPoD API
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": api_messages,
                "temperature": 0.7,
                "max_tokens": 500
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            response.raise_for_status()
            
            result = response.json()
            assistant_message = result["choices"][0]["message"]["content"]
            
            return assistant_message
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"SumoPoD API error: {str(e)}")
        except (KeyError, IndexError) as e:
            raise Exception(f"Invalid API response format: {str(e)}")
        except Exception as e:
            raise Exception(f"Chat error: {str(e)}")
