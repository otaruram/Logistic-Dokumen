from datetime import datetime
from typing import Optional
import logging

class CreditService:
    DAILY_CREDIT_LIMIT = 3

    @staticmethod
    async def ensure_default_credits(user_email: str, prisma):
        """Pastikan user punya kredit. Reset hanya jika tanggal terakhir reset < hari ini."""
        try:
            if not prisma: return False
            
            # Gunakan 'now()' yang konsisten untuk perbandingan
            now = datetime.now()
            today_date = now.date()

            user = await prisma.user.find_unique(where={"email": user_email})

            if not user:
                # USER BARU: Buat dengan saldo 3
                await prisma.user.create(
                    data={
                        "email": user_email,
                        "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                        "tier": "starter",
                        "lastCreditReset": now
                    }
                )
                return True
            else:
                # USER LAMA: Cek tanggal reset terakhir
                should_reset = False
                
                if not user.lastCreditReset:
                    # Jika data tanggal kosong, wajib reset
                    should_reset = True
                else:
                    # Bandingkan tanggal saja (abaikan jam)
                    last_reset_date = user.lastCreditReset.date()
                    # Reset CUMA jika last_reset_date < hari ini (kemarin/lusa)
                    if last_reset_date < today_date:
                        should_reset = True
                
                if should_reset:
                    print(f"🔄 DAILY RESET: {user_email} kembali ke {CreditService.DAILY_CREDIT_LIMIT}")
                    await prisma.user.update(
                        where={"email": user_email},
                        data={
                            "creditBalance": CreditService.DAILY_CREDIT_LIMIT, 
                            "lastCreditReset": now
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
            # Pastikan logic reset jalan dulu
            await CreditService.ensure_default_credits(user_email, prisma)
            
            # Ambil data terbaru setelah potensi reset
            user = await prisma.user.find_unique(where={"email": user_email})
            return user.creditBalance if user else 3
        except Exception:
            return 3

    @staticmethod
    async def deduct_credits(user_email: str, amount: int, description: str, prisma) -> Optional[int]:
        try:
            if not prisma: return 3

            # 1. Cek User & Reset Harian (PENTING)
            await CreditService.ensure_default_credits(user_email, prisma)
            user = await prisma.user.find_unique(where={"email": user_email})
            
            if not user: return None
            
            # 2. Validasi Saldo
            if user.creditBalance < amount:
                print(f"⛔ SALDO KURANG: User {user_email} punya {user.creditBalance}")
                return None

            # 3. Potong Saldo
            new_balance = user.creditBalance - amount
            await prisma.user.update(
                where={"id": user.id},
                data={"creditBalance": new_balance}
            )

            # 4. Catat Log Transaksi
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
            print(f"Error deduct: {e}")
            return None
