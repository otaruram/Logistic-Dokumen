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
        
        should_reset = False
        if not last_reset or now.date() > last_reset.date():
            should_reset = True

        if should_reset:
            new_balance = max(user.creditBalance, CreditService.DAILY_LIMIT) if user.creditBalance > CreditService.DAILY_LIMIT else CreditService.DAILY_LIMIT
            await prisma.user.update(
                where={"email": user_email},
                data={"creditBalance": new_balance, "lastCreditReset": now}
            )
