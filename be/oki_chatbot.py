# oki_chatbot.py - OKi AI Chatbot Service using SumoPoD API

import requests
import json
import os
from typing import List, Dict

class OKiChatbot:
    """OKi AI Assistant for PDF document analysis"""
    
    def __init__(self, api_key: str = None, mode: str = 'sumopod_only'):
        # Support BYOK (Bring Your Own Key)
        self.api_key = api_key or os.getenv("SUMOPOD_API_KEY")
        self.base_url = os.getenv("SUMOPOD_BASE_URL", "https://ai.sumopod.com/v1")
        self.mode = mode
        
        # Detect API key type and set appropriate base_url and model
        if self.api_key:
            if self.api_key.startswith("sk-") and "sumopod" in self.api_key.lower():
                # SumoPoD API key
                self.base_url = "https://ai.sumopod.com/v1"
                self.model = "gpt-4o"
            elif self.api_key.startswith("sk-"):
                # OpenAI API key
                self.base_url = "https://api.openai.com/v1"
                self.model = "gpt-4o-mini"  # Use cheaper model for OpenAI
            else:
                # Unknown format, assume OpenAI compatible
                self.base_url = os.getenv("SUMOPOD_BASE_URL", "https://ai.sumopod.com/v1")
                self.model = "gpt-4o"
        else:
            raise ValueError("API Key not provided. Use BYOK or set SUMOPOD_API_KEY environment variable")
    
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
            
            # Call SumoPoD API with proper error handling
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": api_messages,
                "temperature": 0.7,
                "max_tokens": 500,
                "stream": False  # Explicitly disable streaming
            }
            
            # Debug logging
            print(f"API Request URL: {self.base_url}/chat/completions")
            print(f"API Key prefix: {self.api_key[:10]}...")
            print(f"Model: {self.model}")
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            # Enhanced error handling
            if response.status_code != 200:
                error_detail = "Unknown error"
                try:
                    error_data = response.json()
                    error_detail = error_data.get('error', {}).get('message', str(error_data))
                except:
                    error_detail = response.text[:200]
                
                if response.status_code == 401:
                    raise Exception(f"API Key tidak valid atau expired. Periksa BYOK settings.")
                elif response.status_code == 400:
                    raise Exception(f"Format request tidak valid: {error_detail}")
                elif response.status_code == 429:
                    raise Exception(f"Rate limit exceeded. Tunggu beberapa saat.")
                else:
                    raise Exception(f"API error ({response.status_code}): {error_detail}")
            
            result = response.json()
            
            # Validate response structure
            if 'choices' not in result or len(result['choices']) == 0:
                raise Exception("Invalid API response: no choices returned")
            
            if 'message' not in result['choices'][0] or 'content' not in result['choices'][0]['message']:
                raise Exception("Invalid API response: missing message content")
                
            assistant_message = result["choices"][0]["message"]["content"]
            
            return assistant_message
            
        except requests.exceptions.Timeout:
            return "Maaf, response AI timeout. Silakan coba lagi."
        except requests.exceptions.ConnectionError:
            return "Maaf, tidak dapat terhubung ke AI service. Periksa koneksi internet."
        except requests.exceptions.RequestException as e:
            if "401" in str(e):
                return "API Key tidak valid. Silakan periksa BYOK settings di profile."
            elif "429" in str(e):
                return "Rate limit exceeded. Tunggu sebentar sebelum mencoba lagi."
            else:
                return f"Error koneksi AI: {str(e)[:100]}"
        except (KeyError, IndexError) as e:
            return f"Format response AI tidak valid: {str(e)}"
        except Exception as e:
            error_msg = str(e)
            if "API Key tidak valid" in error_msg:
                return "API Key tidak valid. Silakan periksa BYOK settings di profile."
            elif "Format request tidak valid" in error_msg:
                return f"Request error: {error_msg}"
            else:
                return f"Chat error: {error_msg[:100]}"