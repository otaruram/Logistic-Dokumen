from datetime import datetime
import pytz

# Timezone Jakarta
WIB = pytz.timezone('Asia/Jakarta')

class CreditService:
    DAILY_LIMIT = 3

    @staticmethod
    async def ensure_daily_credits(user_email: str, prisma):
        """
        Logika Reset Harian Sederhana:
        Jika hari ini beda tanggal dengan terakhir reset, kembalikan saldo ke 3.
        """
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: return

        now = datetime.now(WIB)
        
        # Ambil tanggal terakhir reset (convert ke WIB)
        last_reset = user.lastCreditReset.replace(tzinfo=pytz.utc).astimezone(WIB) if user.lastCreditReset else None
        
        should_reset = False

        # Jika user baru (belum pernah reset)
        if not last_reset:
            should_reset = True
        # Jika tanggalnya beda (sudah ganti hari)
        elif last_reset.date() < now.date():
            should_reset = True

        if should_reset:
            # Hanya reset jika saldo kurang dari limit harian (3)
            # Biar kalau user punya saldo banyak (misal bonus), gak hangus.
            if user.creditBalance < CreditService.DAILY_LIMIT:
                print(f"🔄 DAILY RESET: Mengembalikan kredit {user_email} menjadi {CreditService.DAILY_LIMIT}")
                await prisma.user.update(
                    where={"email": user_email},
                    data={
                        "creditBalance": CreditService.DAILY_LIMIT,
                        "lastCreditReset": now
                    }
                )
            else:
                # Cuma update tanggal reset biar gak dicek lagi hari ini
                await prisma.user.update(where={"email": user_email}, data={"lastCreditReset": now})
