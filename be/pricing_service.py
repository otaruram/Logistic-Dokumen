from datetime import datetime
import pytz

# Timezone Jakarta
WIB = pytz.timezone('Asia/Jakarta')

class CreditService:
    DAILY_LIMIT = 3

    @staticmethod
    async def ensure_daily_credits(user_email: str, prisma):
        """
        RESET HARIAN:
        Cek apakah hari ini user sudah login? Jika tanggal terakhir reset < hari ini,
        reset kredit jadi 3.
        """
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: return

        now = datetime.now(WIB)
        
        # Konversi lastCreditReset ke WIB
        last_reset = user.lastCreditReset.replace(tzinfo=pytz.utc).astimezone(WIB) if user.lastCreditReset else None

        should_reset = False
        
        # Jika belum pernah reset, atau tanggalnya beda (sudah ganti hari)
        if not last_reset:
            should_reset = True
        elif last_reset.date() < now.date():
            should_reset = True

        if should_reset:
            # Cek saldo sekarang
            current_balance = user.creditBalance
            
            # Hanya reset ke 3 jika saldo di bawah 3.
            # Kalau user punya banyak (misal beli), jangan dipotong.
            if current_balance < CreditService.DAILY_LIMIT:
                print(f"🔄 HARI BARU: Resetting daily credits buat {user_email}")
                await prisma.user.update(
                    where={"email": user_email},
                    data={
                        "creditBalance": CreditService.DAILY_LIMIT,
                        "lastCreditReset": now
                    }
                )
