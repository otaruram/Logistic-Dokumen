from datetime import datetime
from prisma import Prisma

class CreditService:
    DAILY_LIMIT = 3

    @staticmethod
    async def ensure_daily_credits(user_email: str, prisma: Prisma):
        """
        Logic: Reset harian ke 3 kredit jika saldo < 3.
        """
        try:
            user = await prisma.user.find_unique(where={"email": user_email})
            now = datetime.now()

            if not user:
                return None

            last_reset = user.lastCreditReset
            should_reset = False

            if not last_reset or last_reset.date() < now.date():
                should_reset = True

            if should_reset:
                new_balance = user.creditBalance
                if user.creditBalance < CreditService.DAILY_LIMIT:
                    new_balance = CreditService.DAILY_LIMIT
                
                await prisma.user.update(
                    where={"email": user_email},
                    data={
                        "creditBalance": new_balance,
                        "lastCreditReset": now
                    }
                )
                return new_balance
            
            return user.creditBalance
        except Exception as e:
            print(f"⚠️ Error ensuring credits: {e}")
            return 0

    @staticmethod
    async def deduct_credit(user_email: str, prisma: Prisma) -> bool:
        try:
            await CreditService.ensure_daily_credits(user_email, prisma)
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user or user.creditBalance < 1:
                return False
            
            await prisma.user.update(
                where={"email": user_email},
                data={"creditBalance": user.creditBalance - 1}
            )
            return True
        except Exception as e:
            print(f"❌ Deduct Error: {e}")
            return False
