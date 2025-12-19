from datetime import datetime
from prisma import Prisma

class CreditService:
    DAILY_LIMIT = 3

    @staticmethod
    async def ensure_daily_credits(user_email: str, prisma: Prisma):
        """Lazy Reset: Top-up ke 3 kredit jika hari berganti dan saldo < 3."""
        try:
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user: return None
            
            now = datetime.now()
            last_reset = user.lastCreditReset
            
            # Reset jika belum pernah reset atau sudah ganti tanggal
            if not last_reset or last_reset.date() < now.date():
                new_balance = user.creditBalance
                if user.creditBalance < CreditService.DAILY_LIMIT:
                    new_balance = CreditService.DAILY_LIMIT
                
                await prisma.user.update(
                    where={"email": user_email},
                    data={"creditBalance": new_balance, "lastCreditReset": now}
                )
                return new_balance
            return user.creditBalance
        except Exception as e:
            print(f"⚠️ Credit Service Error: {e}")
            return 0

    @staticmethod
    async def deduct_credit(user_email: str, prisma: Prisma) -> bool:
        """Potong 1 kredit setelah memastikan reset harian sudah dicek."""
        try:
            await CreditService.ensure_daily_credits(user_email, prisma)
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user or user.creditBalance < 1: return False
            
            await prisma.user.update(
                where={"email": user_email},
                data={"creditBalance": user.creditBalance - 1}
            )
            return True
        except: return False
