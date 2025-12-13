"""
Integration file untuk menambahkan pricing system ke main.py
File: be/pricing_integration.py

Instructions untuk integrasi:
1. Import modules ini di main.py
2. Add pricing endpoints 
3. Modify scan endpoint untuk check credits
4. Add admin endpoints
"""

from typing import Dict, Any
from datetime import datetime
from fastapi import HTTPException
from pricing_service import CreditService
from pricing_endpoints import add_pricing_endpoints

class ScanCreditChecker:
    """Class untuk integrasi credit checking dengan scan endpoint"""
    
    @staticmethod
    async def check_and_deduct_scan_credit(user_email: str, prisma) -> Dict[str, Any]:
        """
        Check credit dan kurangi jika scan diizinkan
        Returns: {"allowed": bool, "message": str, "remaining": int}
        """
        try:
            # Check eligibility
            eligibility = await CreditService.check_scan_eligibility(user_email, prisma)
            
            if not eligibility["allowed"]:
                return {
                    "allowed": False,
                    "message": eligibility["reason"],
                    "remaining": eligibility["remaining_credits"]
                }
            
            # Deduct credit
            success = await CreditService.deduct_credit(
                user_email, 
                f"Scan Dokumen - {datetime.now().strftime('%Y-%m-%d %H:%M')}", 
                prisma
            )
            
            if not success:
                return {
                    "allowed": False,
                    "message": "Gagal memproses credit",
                    "remaining": 0
                }
            
            return {
                "allowed": True,
                "message": "Credit berhasil dipotong",
                "remaining": eligibility["remaining_credits"] - 1
            }
            
        except Exception as e:
            return {
                "allowed": False,
                "message": f"Error checking credit: {str(e)}",
                "remaining": 0
            }

# Contoh integrasi dengan main.py:

"""
# Di main.py, tambahkan import:
from pricing_integration import ScanCreditChecker
from pricing_endpoints import add_pricing_endpoints

# Di bagian setup app, tambahkan:
# Add pricing endpoints
add_pricing_endpoints(app, prisma, get_user_email_from_token)

# Modifikasi scan endpoint:
@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    try:
        user_email = get_user_email_from_token(authorization)
        
        # CHECK CREDIT FIRST - TAMBAHKAN INI
        credit_check = await ScanCreditChecker.check_and_deduct_scan_credit(user_email, prisma)
        if not credit_check["allowed"]:
            return {
                "status": "error",
                "message": credit_check["message"],
                "remaining_credits": credit_check["remaining"],
                "error_type": "insufficient_credits"
            }
        
        # Lanjutkan dengan proses scan normal...
        # ... existing scan code ...
        
        # Di akhir response, tambahkan info credit:
        return {
            "status": "success",
            "data": scan_result_data,
            "remaining_credits": credit_check["remaining"]  # TAMBAHKAN INI
        }
        
    except Exception as e:
        # Handle error...
"""

# Contoh modifikasi untuk frontend:

"""
// Di frontend (Index.tsx atau component scan), modify handleScan:

const handleScan = async () => {
  try {
    // ... existing code ...
    
    const response = await fetch(`${API_URL}/scan`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData,
    });

    const result = await response.json();

    if (result.status === "success") {
      // Show success message with remaining credits
      toast.success(`Scan berhasil! Sisa credit: ${result.remaining_credits}`);
      
      // Update UI dengan data scan
      // ... existing success handling ...
      
    } else if (result.error_type === "insufficient_credits") {
      // Redirect ke pricing page
      toast.error(result.message);
      
      // Show upgrade prompt
      if (window.confirm("Credit habis! Upgrade ke Pro atau beli credit?")) {
        window.location.href = "/pricing";
      }
      
    } else {
      toast.error(result.message);
    }
    
  } catch (error) {
    toast.error("Terjadi kesalahan");
  }
};
"""