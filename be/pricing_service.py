From datetime import datetime
from prisma import Prisma

class CreditService:
    DAILY_LIMIT = 3

    @staticmethod
    async def ensure_daily_credits(user_email: str, prisma: Prisma):
        """
        Cek apakah user perlu di-reset kreditnya hari ini.
        Menggunakan konsep 'Lazy Reset': Hanya reset saat user aktif.
        """
        try:
            # 1. Ambil data user
            user = await prisma.user.find_unique(where={"email": user_email})
            now = datetime.now()

            # Jika user belum ada, return None (biar di-handle main.py buat create baru)
            if not user:
                return None

            # 2. Logika Reset:
            # - Jika lastCreditReset kosong (user lama) ATAU
            # - Jika tanggal terakhir reset < hari ini
            last_reset = user.lastCreditReset
            should_reset = False

            if not last_reset:
                should_reset = True
            elif last_reset.date() < now.date():
                should_reset = True

            # 3. Eksekusi Reset (HANYA JIKA SALDO DI BAWAH LIMIT)
            # Ini fitur safety: Kalau user punya 100 kredit (hasil beli), jangan di-reset jadi 3!
            if should_reset:
                new_balance = user.creditBalance
                
                # Hanya top-up ke 3 jika saldo habis/sedikit. 
                # Jika saldo > 3 (misal user Premium), biarkan saja.
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
        """Mengurangi 1 kredit secara transaksional"""
        try:
            # Pastikan saldo update dulu sebelum dipotong
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
