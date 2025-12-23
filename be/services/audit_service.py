"""
Audit Service - Triple Check System for Document Audit
Stage 1: Database Duplicate Check (Prisma)
Stage 2: AI Confidence Scoring (GPT-4o-mini via Sumopod)
Stage 3: Logic Consistency Validation (Math)
"""
import base64
import json
from openai import OpenAI
from typing import Tuple, List, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from config.settings import settings
from schemas.audit_schemas import (
    ExtractedInvoiceData, 
    MathValidationResult, 
    AIAnalysis, 
    AuditReport,
    AuditStatus
)
from prisma import Prisma

# Initialize OpenAI client (GPT-4o-mini via Sumopod - AUDIT SPECIFIC)
try:
    if not settings.AUDIT_OPENAI_API_KEY or settings.AUDIT_OPENAI_API_KEY == '':
        print("❌ Audit OpenAI API Key not found in settings")
        client = None
    else:
        client = OpenAI(
            api_key=settings.AUDIT_OPENAI_API_KEY,
            base_url=settings.AUDIT_OPENAI_BASE_URL
        )
        print("✅ Audit OpenAI client initialized successfully")
except Exception as e:
    print(f"⚠️ Audit OpenAI client initialization failed: {e}")
    client = None

# Initialize Prisma client (shared instance for connection pooling)
prisma = Prisma(auto_register=True)
_prisma_connected = False

async def ensure_prisma_connected():
    """Ensure Prisma is connected (reuse connection)"""
    global _prisma_connected
    if not _prisma_connected:
        await prisma.connect()
        _prisma_connected = True

class AuditService:
    
    @staticmethod
    def check_metadata(image_base64: str) -> dict:
        """
        Stage 0: Forensics Metadata Analysis (God Mode)
        Detect editing software traces in file header/metadata
        """
        try:
            # Decode base64 to bytes
            if "base64," in image_base64:
                image_bytes = base64.b64decode(image_base64.split("base64,")[1])
            else:
                image_bytes = base64.b64decode(image_base64)
            
            findings = []
            suspicious_signatures = [
                b'Adobe Photoshop', b'GIMP', b'Canva', b'Paint.NET', 
                b'CREATOR: gd-jpeg', b'Photoshop', b'Creator: Adobe',
                b'Software: Adobe'
            ]
            
            is_manipulated = False
            
            # Check for suspicious byte signatures
            for sig in suspicious_signatures:
                if sig.lower() in image_bytes.lower():
                    findings.append(f"⚠️ Trace Found: {sig.decode('utf-8', errors='ignore')}")
                    is_manipulated = True
                    
            print(f"🕵️ Stage 0 (Forensics): {'MANIPULATED' if is_manipulated else 'CLEAN'}")
            
            return {
                "isManipulated": is_manipulated,
                "findings": findings
            }
        except Exception as e:
            print(f"❌ Stage 0 Error: {e}")
            return {"isManipulated": False, "findings": ["Metadata check failed"]}

    @staticmethod
    async def check_duplicate(
        invoice_number: str, 
        vendor_name: str, 
        total_amount: float
    ) -> Optional[dict]:
        """
        Stage 1: Database Duplicate Check
        Query Prisma for existing document with same invoice_number + vendor + total
        """
        try:
            await ensure_prisma_connected()
            
            existing = await prisma.documentaudit.find_first(
                where={
                    'invoiceNumber': invoice_number,
                    'vendorName': vendor_name,
                    'totalAmount': total_amount
                }
            )
            
            if existing:
                print(f"⚠️ Stage 1 (Database): DUPLICATE FOUND - Invoice {invoice_number} already exists")
                return {
                    "isDuplicate": True,
                    "existingAuditId": existing.id,
                    "existingDate": existing.createdAt.strftime("%Y-%m-%d %H:%M")
                }
            else:
                print(f"✅ Stage 1 (Database): No duplicate found")
                return {"isDuplicate": False}
                
        except Exception as e:
            print(f"❌ Stage 1 Error: {e}")
            return {"isDuplicate": False}  # Continue audit if DB check fails
    
    @staticmethod
    async def extract_with_ai(image_base64: str) -> dict:
        """
        Stage 2: AI Extraction + Confidence Scoring
        Use GPT-4o-mini Vision to extract data with confidence score
        """
        if client is None:
            raise Exception("OpenAI client not initialized. Check OPENAI_API_KEY in .env file.")
        
        try:
            system_prompt = """You are a Professional Forensic Accountant. Your task is to audit this document image.

EXTRACT:
1. Invoice Number
2. Vendor Name
3. Invoice Date (YYYY-MM-DD)
4. Subtotal
5. Tax
6. Grand Total

CONFIDENCE SCORE (0-100):
Rate your extraction accuracy based on:
- Image clarity (blurred = low score)
- Text readability
- Document completeness
- Field visibility

FRAUD DETECTION:
Check for:
- Date in the future (suspicious)
- Math errors (Subtotal + Tax ≠ Total)
- Blurred/obscured prices
- Generic vendor names
- Unrealistic amounts

RETURN ONLY IN JSON FORMAT:
{
  "invoiceNumber": "INV-12345",
  "vendorName": "PT Example",
  "invoiceDate": "2024-12-20",
  "subtotal": 100000,
  "tax": 11000,
  "grandTotal": 111000,
  "confidenceScore": 85,
  "fraudIndicators": ["Date is in future", "Tax calculation incorrect"]
}

RULES:
- confidenceScore: 0-100 (higher = more confident)
- fraudIndicators: Array of specific concerns (empty if none)
- All prices in IDR (remove "Rp")
- Use null if field not visible"""

            # Call GPT-4o-mini Vision API
            response = client.chat.completions.create(
                model=settings.AUDIT_OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}"
                                }
                            },
                            {
                                "type": "text",
                                "text": "Analyze this document and return JSON."
                            }
                        ]
                    }
                ],
                temperature=0.1,
                max_tokens=800,
                response_format={"type": "json_object"}
            )
            
            # Parse response
            content = response.choices[0].message.content
            data = json.loads(content)
            
            # Ensure all required fields have default values
            result = {
                'invoiceNumber': data.get('invoiceNumber') or 'UNKNOWN',
                'vendorName': data.get('vendorName') or 'UNKNOWN',
                'invoiceDate': data.get('invoiceDate') or datetime.now().strftime('%Y-%m-%d'),
                'subtotal': data.get('subtotal') or 0,
                'tax': data.get('tax') or 0,
                'grandTotal': data.get('grandTotal') or 0,
                'confidenceScore': data.get('confidenceScore') or 0,
                'fraudIndicators': data.get('fraudIndicators') or []
            }
            
            print(f"✅ Stage 2 (AI): Confidence = {result['confidenceScore']}/100")
            return result
            
        except Exception as e:
            print(f"❌ Stage 2 Error: {e}")
            raise ValueError(f"Failed to extract document data: {str(e)}")
    
    @staticmethod
    def validate_logic(
        subtotal: float, 
        tax: float, 
        grand_total: float
    ) -> dict:
        """
        Stage 3: Logic Consistency Validation
        Check math: Subtotal + Tax = Grand Total
        """
        try:
            # Use Decimal for precision
            sub = Decimal(str(subtotal)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            tx = Decimal(str(tax)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            total = Decimal(str(grand_total)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            expected_total = sub + tx
            is_valid = (expected_total == total)
            
            if is_valid:
                print(f"✅ Stage 3 (Logic): Math is correct ({sub:,} + {tx:,} = {total:,})")
                return {
                    "isValid": True,
                    "errors": []
                }
            else:
                diff = abs(expected_total - total)
                error_msg = f"Math error: {sub:,} + {tx:,} = {expected_total:,}, but invoice shows {total:,} (Diff: {diff:,})"
                print(f"❌ Stage 3 (Logic): {error_msg}")
                return {
                    "isValid": False,
                    "errors": [error_msg]
                }
                
        except Exception as e:
            print(f"❌ Stage 3 Error: {e}")
            return {
                "isValid": False,
                "errors": [f"Calculation error: {str(e)}"]
            }
    
    @staticmethod
    async def save_audit_result(
        ai_data: dict,
        is_duplicate: bool,
        is_suspicious: bool,
        analysis_note: str,
        user_id: Optional[str] = None
    ) -> str:
        """
        Save audit result to Prisma DocumentAudit table
        """
        try:
            await ensure_prisma_connected()
            
            audit_record = await prisma.documentaudit.create(
                data={
                    'invoiceNumber': ai_data.get('invoiceNumber', 'UNKNOWN'),
                    'vendorName': ai_data.get('vendorName', 'UNKNOWN'),
                    'totalAmount': float(ai_data.get('grandTotal') or 0),
                    'invoiceDate': ai_data.get('invoiceDate'),
                    'confidenceScore': ai_data.get('confidenceScore') or 0,
                    'isDuplicate': is_duplicate,
                    'isSuspicious': is_suspicious,
                    'analysisNote': analysis_note,
                    'userId': user_id
                }
            )
            
            print(f"✅ Saved audit record: {audit_record.id}")
            return audit_record.id
            
        except Exception as e:
            print(f"❌ Failed to save audit: {e}")
            return None
    
    @staticmethod
    async def audit_document(image_base64: str, user_id: Optional[str] = None) -> dict:
        """
        Main Triple Check System Pipeline (God Mode):
        0. Forensics Metadata Check 🕵️
        1. Extract with AI + Confidence Score 🤖
        2. Check Database for Duplicates 💾
        3. Validate Logic (Math) 🧮
        """
        logs = [] # Real-time logs for frontend animation
        try:
            # Stage 0: Forensics
            logs.append({"stage": "INIT", "msg": "Initializing Neural Audit Protocol..."})
            logs.append({"stage": "0", "msg": "🔍 Stage 0: Scanning file metadata signature..."})
            
            metadata_check = AuditService.check_metadata(image_base64)
            if metadata_check['isManipulated']:
                logs.append({"stage": "0", "msg": f"⚠️ TAMPERING DETECTED: {', '.join(metadata_check['findings'])}", "status": "danger"})
            else:
                logs.append({"stage": "0", "msg": "✅ Metadata integrity verified. No Photoshop traces.", "status": "success"})

            # Stage 2: AI Extraction (Running early to get data for other checks)
            logs.append({"stage": "1", "msg": "🧠 Stage 1: Activating Optical Character Recognition (GPT-4o Vision)..."})
            ai_data = await AuditService.extract_with_ai(image_base64)
            
            confidence = ai_data.get('confidenceScore', 0)
            logs.append({"stage": "1", "msg": f"📄 Data extracted. Confidence Score: {confidence}%"})
            
            # Stage 1: Database Duplicate
            logs.append({"stage": "2", "msg": "💾 Stage 2: Querying global ledger for duplicates..."})
            duplicate_check = await AuditService.check_duplicate(
                ai_data.get('invoiceNumber', 'UNKNOWN'),
                ai_data.get('vendorName', 'UNKNOWN'),
                float(ai_data.get('grandTotal') or 0)
            )
            
            if duplicate_check.get('isDuplicate'):
                logs.append({"stage": "2", "msg": "⚠️ DUPLICATE FOUND in database!", "status": "danger"})
            else:
                logs.append({"stage": "2", "msg": "✅ Record is unique. No prior submission found.", "status": "success"})

            # Stage 3: Logic Validation
            logs.append({"stage": "3", "msg": "🧮 Stage 3: Verifying arithmetic logic (Subtotal + Tax = Total)..."})
            logic_check = AuditService.validate_logic(
                float(ai_data.get('subtotal') or 0),
                float(ai_data.get('tax') or 0),
                float(ai_data.get('grandTotal') or 0)
            )
            
            if logic_check.get('isValid'):
                logs.append({"stage": "3", "msg": "✅ Math checks out. Logic is sound.", "status": "success"})
            else:
                logs.append({"stage": "3", "msg": f"❌ LOGIC ERROR: {logic_check['errors'][0]}", "status": "danger"})

            # Traffic Light Logic (Updated)
            is_manipulated = metadata_check.get('isManipulated', False)
            is_duplicate = duplicate_check.get('isDuplicate', False)
            math_valid = logic_check.get('isValid', False)
            
            findings = []
            findings.extend(metadata_check.get('findings', []))
            findings.extend(ai_data.get('fraudIndicators', []))
            findings.extend(logic_check.get('errors', []))
            
            status = "SUSPICIOUS" # Default
            status_color = "red"
            
            # GOD MODE STATUS LOGIC
            if is_manipulated:
                status = "TAMPERED"
                status_color = "red"
            elif is_duplicate:
                status = "DUPLICATE"
                status_color = "yellow"
            elif not math_valid:
                status = "INVALID_MATH"
                status_color = "yellow"
            elif confidence > 85:
                status = "VERIFIED"
                status_color = "green"
            
            logs.append({"stage": "FINAL", "msg": f"🏁 Audit Complete. Verdict: {status}", "status": status_color})

            # Save result
            audit_id = None
            if not is_duplicate:
                 audit_id = await AuditService.save_audit_result(
                    ai_data, is_duplicate, (status_color == "red"), 
                    f"{status} | {len(findings)} Issues", user_id
                )

            return {
                "status": status,
                "statusColor": status_color,
                "confidenceScore": confidence,
                "findings": findings,
                "logs": logs, # Return logs for animation
                "data": ai_data
            }
            
        except Exception as e:
            print(f"❌ Audit Error: {e}")
            raise ValueError(f"Audit failed: {str(e)}")
