from datetime import datetime
import pytz

WIB = pytz.timezone('Asia/Jakarta')

class CreditService:
    DAILY_LIMIT = 3

    @staticmethod
    async def ensure_daily_credits(user_email: str, prisma):
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: return

        now = datetime.now(WIB)
        last_reset = user.lastCreditReset.replace(tzinfo=pytz.utc).astimezone(WIB) if user.lastCreditReset else None
        
        # Reset jika hari sudah berganti
        if not last_reset or now.date() > last_reset.date():
            if user.creditBalance < CreditService.DAILY_LIMIT:
                await prisma.user.update(
                    where={"email": user_email},
                    data={"creditBalance": CreditService.DAILY_LIMIT, "lastCreditReset": now}
                )
            else:
                await prisma.user.update(where={"email": user_email}, data={"lastCreditReset": now})
