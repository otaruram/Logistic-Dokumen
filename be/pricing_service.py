from datetime import datetime
import pytz

WIB = pytz.timezone('Asia/Jakarta')

class CreditService:
    DAILY_LIMIT = 3

    @staticmethod
    async def ensure_daily_credits(user_email: str, prisma):
        """
        LOGIKA HARIAN (PASTI 3):
        Cek tanggal hari ini vs tanggal reset terakhir.
        Jika beda hari -> ISI ULANG JADI 3.
        """
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user: return

        now = datetime.now(WIB)
        
        # Ambil tanggal terakhir reset (convert ke WIB)
        last_reset = user.lastCreditReset.replace(tzinfo=pytz.utc).astimezone(WIB) if user.lastCreditReset else None
        
        should_reset = False

        # 1. Jika User Lama tapi belum pernah ada record reset (kasus migrasi)
        if not last_reset:
            should_reset = True
        # 2. Jika tanggal hari ini LEBIH BARU dari tanggal terakhir reset
        elif now.date() > last_reset.date():
            should_reset = True

        if should_reset:
            # Fitur Safety: Hanya reset jika saldo di bawah 3
            # (Misal: Kemarin 0, hari ini jadi 3. Kemarin sisa 1, hari ini jadi 3)
            if user.creditBalance < CreditService.DAILY_LIMIT:
                print(f"🔄 DAILY RESET: {user_email} saldo direset ke {CreditService.DAILY_LIMIT}")
                await prisma.user.update(
                    where={"email": user_email},
                    data={
                        "creditBalance": CreditService.DAILY_LIMIT,
                        "lastCreditReset": now
                    }
                )
            else:
                # Kalau saldo dia 5 (misal user premium), jangan diturunin, cuma update tanggalnya
                await prisma.user.update(where={"email": user_email}, data={"lastCreditReset": now})
