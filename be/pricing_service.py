from datetime import datetime, date
from typing import Optional
import logging

class CreditService:
    DAILY_CREDIT_LIMIT = 3

    @staticmethod
    async def ensure_default_credits(user_email: str, prisma):
        """Pastikan user punya 3 kredit setiap hari baru"""
        try:
            if not prisma: return False
            today = date.today()
            user = await prisma.user.find_unique(where={"email": user_email})

            if not user:
                # USER BARU: Kasih 3 Kredit
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
                # USER LAMA: Cek apakah hari sudah berganti?
                last_reset = user.lastCreditReset.date() if user.lastCreditReset else None
                
                # Jika hari beda, RESET JADI 3 (Bukan ditambah, tapi diset ke limit harian)
                if last_reset != today:
                    print(f"🔄 Resetting credits for {user_email} to {CreditService.DAILY_CREDIT_LIMIT}")
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
    async def deduct_credits(user_email: str, amount: int, description: str, prisma) -> Optional[int]:
        """Potong kredit dan return sisa saldo"""
        try:
            if not prisma: return 3

            # 1. Pastikan user valid & kredit harian sudah reset
            await CreditService.ensure_default_credits(user_email, prisma)
            user = await prisma.user.find_unique(where={"email": user_email})
            
            if not user: return None
            
            # 2. Validasi Saldo
            if user.creditBalance < amount:
                print(f"⛔ SALDO KURANG: {user.creditBalance}")
                return None

            # 3. Update Saldo
            new_balance = user.creditBalance - amount
            await prisma.user.update(
                where={"id": user.id},
                data={"creditBalance": new_balance}
            )

            # 4. Catat Transaksi
            try:
                await prisma.credittransaction.create(
                    data={
                        "userId": user.id,
                        "amount": -amount,
                        "description": description,
                        "timestamp": datetime.now()
                    }
                )
            except Exception: pass

            return new_balance

        except Exception as e:
            print(f"Error deduct: {str(e)}")
            return None
    
    # Helper lain biarkan kosong/default
    @staticmethod
    async def check_all_users_cleanup(prisma): return 0
