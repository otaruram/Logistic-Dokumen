# File: be/pricing_service.py

# ... (Import lainnya tetap sama)
from datetime import datetime, date
from typing import Optional

class CreditService:
    DAILY_CREDIT_LIMIT = 3

    # ... (Method ensure_default_credits tetap sama) ...
    # ... (Method get_user_credits tetap sama) ...

    @staticmethod
    async def deduct_credits(user_email: str, amount: int, description: str, prisma) -> Optional[int]:
        """
        🔥 FIXED: Mengurangi kredit dan mengembalikan SISA SALDO TERBARU.
        Returns: int (sisa saldo) atau None (jika gagal)
        """
        try:
            if not prisma: return 3 # Fallback offline

            # 1. Ambil User & Pastikan Ada
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                await CreditService.ensure_default_credits(user_email, prisma)
                user = await prisma.user.find_unique(where={"email": user_email})
            
            # 2. Validasi Saldo
            if user.creditBalance < amount:
                print(f"⛔ SALDO KURANG - User: {user_email}, Punya: {user.creditBalance}")
                return None

            # 3. Update Saldo (Kurangi)
            new_balance = user.creditBalance - amount
            await prisma.user.update(
                where={"id": user.id},
                data={"creditBalance": new_balance}
            )

            # 4. Catat Transaksi (Log)
            try:
                await prisma.credittransaction.create(
                    data={
                        "userId": user.id,
                        "amount": -amount,
                        "description": description,
                        "timestamp": datetime.now()
                    }
                )
            except Exception as e:
                print(f"⚠️ Gagal catat history transaksi: {e}")

            print(f"✅ DEDUCT SUKSES: {user_email}, Sisa: {new_balance}")
            return new_balance

        except Exception as e:
            print(f"💥 CRITICAL ERROR deduct_credits: {str(e)}")
            return None
    
    # ... (Sisa method lain biarkan seperti semula) ...
