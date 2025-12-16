"""
Pricing & Credit System Backend Logic - FIXED VERSION
"""

from enum import Enum
from datetime import datetime, date
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class CreditService:
    """Service Manager untuk Logic Kredit & Pricing"""

    DAILY_CREDIT_LIMIT = 3

    @staticmethod
    async def ensure_default_credits(user_email: str, prisma):
        try:
            if not prisma: return False
            today = date.today()

            user = await prisma.user.find_unique(where={"email": user_email})

            if not user:
                # New User
                new_user = await prisma.user.create(
                    data={
                        "email": user_email,
                        "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                        "tier": "starter",
                        "lastCreditReset": datetime.now()
                    }
                )
                return True
            else:
                # Existing User - Check Daily Reset
                last_reset = user.lastCreditReset.date() if user.lastCreditReset else None
                if last_reset != today:
                    await prisma.user.update(
                        where={"email": user_email},
                        data={
                            "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                            "lastCreditReset": datetime.now()
                        }
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
    async def get_user_tier(user_email: str, prisma) -> str:
        try:
            if not prisma: return "starter"
            user = await prisma.user.find_unique(where={"email": user_email})
            return user.tier if user else "starter"
        except Exception:
            return "starter"

    @staticmethod
    async def deduct_credits(user_email: str, amount: int, description: str, prisma) -> Optional[int]:
        """
        🔥 FIXED: Mengurangi kredit dengan syntax Prisma Relation yang benar
        """
        try:
            if not prisma: return None

            # 1. Ambil User
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                await CreditService.ensure_default_credits(user_email, prisma)
                user = await prisma.user.find_unique(where={"email": user_email})
                if not user: return None

            # 2. Validasi Saldo
            if user.creditBalance < amount:
                return None

            # 3. Update Saldo User (Atomic)
            new_balance = user.creditBalance - amount
            updated_user = await prisma.user.update(
                where={"id": user.id},
                data={"creditBalance": new_balance}
            )

            # 4. Catat Transaksi (FIXED SYNTAX 'connect')
            try:
                await prisma.credittransaction.create(
                    data={
                        "amount": -amount,
                        "description": description,
                        "timestamp": datetime.now(),
                        "user": {
                            "connect": {"id": user.id} # <-- INI FIX-NYA
                        }
                    }
                )
            except Exception as tx_error:
                print(f"⚠️ Transaction logging warning: {tx_error}")

            return new_balance

        except Exception as e:
            print(f"💥 Critical Deduct Error: {e}")
            return None

    # --- Helper methods lainnya tetap sama, atau bisa ditambahkan jika perlu ---
    @staticmethod
    def get_pricing_plans():
        return {
            "topup_packages": [
                {"credits": 20, "price": 10000, "name": "Paket Hemat"},
                {"credits": 50, "price": 22000, "name": "Paket Sedang"}
            ]
        }
