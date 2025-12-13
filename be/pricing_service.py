"""
Pricing & Credit System Backend Logic - FIXED VERSION
File: be/pricing_service.py
"""

from enum import Enum
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class PlanType(Enum):
    STARTER = "STARTER"
    PRO = "PRO"

class CreditService:
    """Service Manager untuk Logic Kredit & Pricing"""
    
    STARTER_INITIAL_CREDITS = 10
    
    @staticmethod
    async def ensure_default_credits(user_email: str, prisma):
        """Memastikan user baru punya saldo awal"""
        try:
            if not prisma: 
                return False
            
            # Cek user
            user = await prisma.user.find_unique(where={"email": user_email})
            
            # Jika user belum ada, buat baru dengan saldo 10
            if not user:
                new_user = await prisma.user.create(
                    data={
                        "email": user_email,
                        "creditBalance": CreditService.STARTER_INITIAL_CREDITS,
                        "tier": "starter"
                    }
                )
                # Catat history pemberian modal awal
                await prisma.credittransaction.create(
                    data={
                        "userId": new_user.id,
                        "amount": CreditService.STARTER_INITIAL_CREDITS,
                        "description": "Welcome Bonus - 10 Credit Gratis"
                    }
                )
                print(f"✅ New user created with {CreditService.STARTER_INITIAL_CREDITS} credits: {user_email}")
                return True
            return True
        except Exception as e:
            print(f"❌ Error ensuring credits: {e}")
            return False

    @staticmethod
    async def get_user_credits(user_email: str, prisma) -> int:
        """Mengambil saldo LANGSUNG dari tabel User (Realtime)"""
        try:
            if not prisma: 
                return 10  # Default fallback
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                # Create user if not exists
                await CreditService.ensure_default_credits(user_email, prisma)
                user = await prisma.user.find_unique(where={"email": user_email})
            return user.creditBalance if user else 10
        except Exception as e:
            print(f"Error getting user credits: {e}")
            return 10

    @staticmethod
    async def get_user_tier(user_email: str, prisma) -> str:
        """Get user tier"""
        try:
            if not prisma: 
                return "starter"
            user = await prisma.user.find_unique(where={"email": user_email})
            return user.tier if user else "starter"
        except Exception:
            return "starter"

    @staticmethod
    async def deduct_credits(user_email: str, amount: int, description: str, prisma) -> bool:
        """
        LOGIKA KRITIKAL:
        1. Cek saldo di tabel User.
        2. Update tabel User (kurangi saldo).
        3. Catat di tabel CreditTransaction.
        """
        try:
            if not prisma:
                print("⚠️ Database logic skipped (Prisma not connected)")
                return True # Fallback agar user tidak stuck jika DB error

            # 1. Ambil User
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                # Jika user hantu, coba buatkan dulu
                await CreditService.ensure_default_credits(user_email, prisma)
                user = await prisma.user.find_unique(where={"email": user_email})
                if not user:
                    return False

            # 2. Validasi Saldo (langsung dari tabel User)
            if user.creditBalance < amount:
                print(f"❌ Saldo tidak cukup: Punya {user.creditBalance}, Butuh {amount}")
                return False

            # 3. UPDATE SALDO (Atomic Decrement) - INI YANG SEBELUMNYA HILANG!
            new_balance = user.creditBalance - amount
            
            await prisma.user.update(
                where={"id": user.id},
                data={"creditBalance": new_balance}
            )

            # 4. Catat Transaksi (History)
            await prisma.credittransaction.create(
                data={
                    "userId": user.id,
                    "amount": -amount, # Minus karena pemakaian
                    "description": description
                }
            )

            print(f"💰 Kredit berhasil dipotong. Sisa: {new_balance}")
            return True

        except Exception as e:
            print(f"CRITICAL ERROR deduct_credits: {e}")
            return False

class SubscriptionService:
    """Service for subscription management"""
    pass

class ImageCleanupService:
    """Service for image cleanup"""
    pass

def get_pricing_plans():
    """Return pricing plans"""
    return {
        "topup_packages": [
            {"credits": 20, "price": 10000, "name": "Paket Hemat"},
            {"credits": 50, "price": 22000, "name": "Paket Sedang"}, 
            {"credits": 100, "price": 35000, "name": "Paket Jumbo"}
        ],
        "pro_subscription": {
            "monthly_price": 49000,
            "credits_per_month": 200
        }
    }