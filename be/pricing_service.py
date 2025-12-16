from enum import Enum
from datetime import datetime, date
from typing import Optional, Dict, Any
import logging
import calendar

logger = logging.getLogger(__name__)

class CreditService:
    """Service Manager untuk Logic Kredit & Pricing - CLEAN VERSION"""

    DAILY_CREDIT_LIMIT = 3

    @staticmethod
    async def ensure_default_credits(user_email: str, prisma):
        """Ensure user has daily credits (3 per day with auto-reset)"""
        try:
            if not prisma: return False
            today = date.today()
            user = await prisma.user.find_unique(where={"email": user_email})

            if not user:
                # User Baru
                await prisma.user.create(
                    data={
                        "email": user_email,
                        "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                        "tier": "starter",
                        "lastCreditReset": datetime.now()
                    }
                )
                return True
            else:
                # User Lama: Cek Reset Harian
                last_reset = user.lastCreditReset.date() if user.lastCreditReset else None
                if last_reset != today:
                    await prisma.user.update(
                        where={"email": user_email},
                        data={"creditBalance": CreditService.DAILY_CREDIT_LIMIT, "lastCreditReset": datetime.now()}
                    )
                return True
        except Exception as e:
            print(f"❌ Error ensuring credits: {e}")
            return False

    @staticmethod
    async def get_user_credits(user_email: str, prisma) -> int:
        try:
            if not prisma: return 3
            await CreditService.ensure_default_credits(user_email, prisma)
            user = await prisma.user.find_unique(where={"email": user_email})
            return user.creditBalance if user else 3
        except Exception:
            return 3

    @staticmethod
    async def deduct_credits(user_email: str, amount: int, description: str, prisma) -> Optional[int]:
        """
        🔥 FIXED: Mengurangi kredit dan mengembalikan SISA SALDO TERBARU (Integer).
        Returns: int (sisa saldo) atau None (jika gagal/saldo kurang)
        """
        try:
            if not prisma: return 3 # Fallback offline mode

            # 1. Ambil User & Pastikan Ada
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                await CreditService.ensure_default_credits(user_email, prisma)
                user = await prisma.user.find_unique(where={"email": user_email})
                if not user: return None
            
            # 2. Validasi Saldo
            if user.creditBalance < amount:
                print(f"⛔ SALDO KURANG - User: {user_email}, Punya: {user.creditBalance}, Butuh: {amount}")
                return None

            # 3. Update Saldo (Kurangi)
            new_balance = user.creditBalance - amount
            await prisma.user.update(
                where={"id": user.id},
                data={"creditBalance": new_balance}
            )

            # 4. Catat Transaksi (Log)
            try:
                await prisma.credittransaction.create(
                    data={
                        "userId": user.id,
                        "amount": -amount,
                        "description": description,
                        "timestamp": datetime.now()
                    }
                )
            except Exception as e:
                print(f"⚠️ Gagal catat history transaksi: {e}")

            print(f"✅ DEDUCT SUKSES: {user_email}, Sisa: {new_balance}")
            return new_balance

        except Exception as e:
            print(f"💥 CRITICAL ERROR deduct_credits: {str(e)}")
            return None
            
    # --- Helper Lainnya ---
    @staticmethod
    def get_pricing_plans():
        return {
            "topup_packages": [
                {"credits": 20, "price": 10000, "name": "Paket Hemat"},
                {"credits": 50, "price": 22000, "name": "Paket Sedang"}, 
                {"credits": 100, "price": 35000, "name": "Paket Jumbo"}
            ],
            "pro_subscription": {"monthly_price": 49000, "credits_per_month": 200}
        }
    
    @staticmethod
    async def check_all_users_cleanup(prisma):
        # Placeholder untuk logic cleanup
        return 0

    @staticmethod
    async def get_user_tier(user_email: str, prisma) -> str:
        try:
            if not prisma: return "starter"
            user = await prisma.user.find_unique(where={"email": user_email})
            return user.tier if user else "starter"
        except Exception:
            return "starter"
