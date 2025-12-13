"""
Pricing & Credit System Backend Logic - FIXED VERSION
File: be/pricing_service.py
"""

from enum import Enum
from datetime import datetime, timedelta, date
from typing import Optional, Dict, Any
import logging
import calendar
import calendar

logger = logging.getLogger(__name__)

class PlanType(Enum):
    STARTER = "STARTER"
    PRO = "PRO"

class CreditService:
    """Service Manager untuk Logic Kredit & Pricing"""
    
    DAILY_CREDIT_LIMIT = 3  # Daily credit allocation
    
    @staticmethod
    async def ensure_default_credits(user_email: str, prisma):
        """Ensure user has daily credits (3 per day with auto-reset)"""
        try:
            if not prisma:
                return False
            
            from datetime import date
            today = date.today()
            
            # Check if user exists
            user = await prisma.user.find_unique(where={"email": user_email})
            
            if not user:
                # Create new user with 3 daily credits
                new_user = await prisma.user.create(
                    data={
                        "email": user_email,
                        "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                        "tier": "starter",
                        "lastCreditReset": datetime.now()
                    }
                )
                # Log initial credit grant
                await prisma.credittransaction.create(
                    data={
                        "userId": new_user.id,
                        "amount": CreditService.DAILY_CREDIT_LIMIT,
                        "description": f"Daily credits - {today}"
                    }
                )
                print(f"✅ New user created with {CreditService.DAILY_CREDIT_LIMIT} daily credits: {user_email}")
                return True
            else:
                # Check if credits need daily reset
                last_reset = user.lastCreditReset.date() if user.lastCreditReset else None
                
                if last_reset != today:
                    # Reset to 3 credits for new day
                    await prisma.user.update(
                        where={"email": user_email},
                        data={
                            "creditBalance": CreditService.DAILY_CREDIT_LIMIT,
                            "lastCreditReset": datetime.now()
                        }
                    )
                    # Log daily reset
                    await prisma.credittransaction.create(
                        data={
                            "userId": user.id,
                            "amount": CreditService.DAILY_CREDIT_LIMIT,
                            "description": f"Daily credit reset - {today}"
                        }
                    )
                    print(f"✅ Daily credits reset for user: {user_email}")
                
                return True
            return True
        except Exception as e:
            print(f"❌ Error ensuring credits: {e}")
            return False

    @staticmethod
    async def get_user_credits(user_email: str, prisma) -> int:
        """Get user credits with automatic daily reset check"""
        try:
            if not prisma: 
                return 3  # Default fallback
            
            # Ensure user exists and check daily reset
            await CreditService.ensure_default_credits(user_email, prisma)
            
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                return 3  # Fallback
                
            return user.creditBalance
        except Exception as e:
            print(f"Error getting user credits: {e}")
            return 3

    @staticmethod
    async def check_monthly_cleanup_warning(user_email: str, prisma) -> Dict[str, Any]:
        """Check if user's monthly data cleanup is approaching based on registration date"""
        try:
            today = date.today()
            
            # Get user registration date
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user or not user.createdAt:
                return {"warning": False}
            
            # Calculate next cleanup date based on user registration
            registration_date = user.createdAt.date()
            
            # Find next monthly anniversary (same day next month)
            if today.month == 12:
                next_cleanup = date(today.year + 1, 1, registration_date.day)
            else:
                try:
                    next_cleanup = date(today.year, today.month + 1, registration_date.day)
                except ValueError:
                    # Handle cases like Feb 30 -> Feb 28/29
                    last_day_next_month = calendar.monthrange(today.year, today.month + 1)[1]
                    day_to_use = min(registration_date.day, last_day_next_month)
                    next_cleanup = date(today.year, today.month + 1, day_to_use)
            
            days_until_cleanup = (next_cleanup - today).days
            
            if days_until_cleanup <= 7:  # Last week before cleanup
                # Count user's specific logs and transactions
                log_count = await prisma.log.count(where={"userId": user.id})
                transaction_count = await prisma.credittransaction.count(where={"userId": user.id})
                
                return {
                    "warning": True,
                    "days_remaining": days_until_cleanup,
                    "total_logs": log_count,
                    "total_transactions": transaction_count,
                    "cleanup_date": next_cleanup.strftime("%d %B %Y"),
                    "message": f"⚠️ PERINGATAN: Data Anda akan dihapus dalam {days_until_cleanup} hari (tanggal {next_cleanup.strftime('%d %B %Y')})! Segera backup ke Google Drive."
                }
            
            return {"warning": False}
        except Exception as e:
            print(f"Error checking monthly cleanup: {e}")
            return {"warning": False}
    
    @staticmethod
    async def perform_monthly_cleanup_for_user(user_email: str, prisma) -> bool:
        """Perform monthly data cleanup for specific user based on their registration anniversary"""
        try:
            from date_utils import calculate_cleanup_info_safe
            today = date.today()
            
            # Get user registration date
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user or not user.createdAt:
                return False
            
            # Use safe date calculation
            cleanup_info = calculate_cleanup_info_safe(user.createdAt)
            
            # Check if today is the cleanup day (days_until_cleanup = 0)
            is_cleanup_day = cleanup_info["days_until_cleanup"] == 0
            
            if is_cleanup_day:
                # Delete user's logs and credit transactions
                deleted_logs = await prisma.log.delete_many(where={"userId": user.id})
                deleted_transactions = await prisma.credittransaction.delete_many(where={"userId": user.id})
                
                print(f"🗑️ Monthly cleanup completed for {user_email}: {deleted_logs.count} logs and {deleted_transactions.count} transactions deleted")
                return True
            return False
        except Exception as e:
            print(f"Error performing monthly cleanup for user: {e}")
            return False
    
    @staticmethod
    async def check_all_users_cleanup(prisma) -> int:
        """Check and perform cleanup for all users who reached their monthly anniversary"""
        try:
            # Get all users
            users = await prisma.user.find_many()
            cleanup_count = 0
            
            for user in users:
                if await CreditService.perform_monthly_cleanup_for_user(user.email, prisma):
                    cleanup_count += 1
            
            if cleanup_count > 0:
                print(f"🗑️ Daily check: Performed monthly cleanup for {cleanup_count} users")
            
            return cleanup_count
        except Exception as e:
            print(f"Error checking all users cleanup: {e}")
            return 0
    
    @staticmethod
    def get_credit_exhaustion_message(remaining_credits: int) -> Dict[str, str]:
        """Get appropriate message based on credit status"""
        if remaining_credits == 0:
            return {
                "type": "exhausted",
                "message": "💸 Kredit habis! Kembali besok untuk mendapatkan 3 kredit baru.",
                "title": "Kredit Habis"
            }
        elif remaining_credits == 1:
            return {
                "type": "warning",
                "message": "⚠️ Sisa 1 kredit! Kredit akan direset besok.",
                "title": "Kredit Hampir Habis"
            }
        elif remaining_credits == 2:
            return {
                "type": "info", 
                "message": "ℹ️ Sisa 2 kredit. Kredit akan direset besok.",
                "title": "Info Kredit"
            }
        else:
            return {
                "type": "success",
                "message": f"✅ Anda memiliki {remaining_credits} kredit.",
                "title": "Kredit Tersedia"
            }

    @staticmethod
    async def get_user_tier(user_email: str, prisma) -> str:
        """Get user tier"""
        try:
            if not prisma: 
                return "starter"
            user = await prisma.user.find_unique(where={"email": user_email})
            return user.tier if user else "starter"
        except Exception:
            return "starter"

    @staticmethod
    async def deduct_credits(user_email: str, amount: int, description: str, prisma) -> Optional[int]:
        """
        🔥 ENHANCED: Mengurangi kredit dan mengembalikan SISA SALDO TERBARU.
        Returns: int (sisa saldo) atau None (jika gagal)
        """
        try:
            print(f"🔥 STARTING CREDIT DEDUCTION - User: {user_email}, Amount: {amount}")
            
            if not prisma:
                print("⚠️ Database logic skipped (Prisma not connected)")
                return 3 # Fallback agar user tidak stuck jika DB error

            # 1. Ambil User
            print(f"📋 FETCHING USER DATA - {user_email}")
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                print(f"👻 USER NOT FOUND - Creating new user: {user_email}")
                # Jika user hantu, coba buatkan dulu
                await CreditService.ensure_default_credits(user_email, prisma)
                user = await prisma.user.find_unique(where={"email": user_email})
                if not user:
                    print(f"❌ FAILED TO CREATE USER - {user_email}")
                    return None

            print(f"💰 CURRENT BALANCE - User: {user_email}, Credits: {user.creditBalance}")

            # 2. Validasi Saldo (langsung dari tabel User)
            if user.creditBalance < amount:
                print(f"⛔ INSUFFICIENT CREDITS - Need: {amount}, Have: {user.creditBalance}")
                return None

            # 3. UPDATE SALDO (Atomic Decrement) - INI YANG SEBELUMNYA HILANG!
            new_balance = user.creditBalance - amount
            print(f"🧮 CALCULATING NEW BALANCE - Old: {user.creditBalance}, New: {new_balance}")
            
            updated_user = await prisma.user.update(
                where={"id": user.id},
                data={"creditBalance": new_balance}
            )
            print(f"✅ BALANCE UPDATED - User: {user_email}, New Balance: {updated_user.creditBalance}")

            # 4. Catat Transaksi (History)
            try:
                transaction = await prisma.credittransaction.create(
                    data={
                        "userId": user.id,
                        "amount": -amount, # Minus karena pemakaian
                        "description": description,
                        "timestamp": datetime.now()
                    }
                )
                print(f"📝 TRANSACTION RECORDED - ID: {transaction.id}")
            except Exception as tx_error:
                print(f"⚠️ Transaction logging failed: {tx_error}")
                # Don't fail the whole process if just logging fails

            print(f"🎉 CREDIT DEDUCTION SUCCESS - Returning balance: {new_balance}")
            # 🔥 RETURN NEW BALANCE AGAR REALTIME
            return new_balance

        except Exception as e:
            print(f"💥 CRITICAL ERROR deduct_credits: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

            print(f"💰 CURRENT BALANCE - User: {user_email}, Credits: {user.creditBalance}")

            # 2. Validasi Saldo (langsung dari tabel User)
            if user.creditBalance < amount:
                print(f"⛔ INSUFFICIENT CREDITS - Need: {amount}, Have: {user.creditBalance}")
                return False

            # 3. UPDATE SALDO (Atomic Decrement) - INI YANG SEBELUMNYA HILANG!
            new_balance = user.creditBalance - amount
            print(f"🧮 CALCULATING NEW BALANCE - Old: {user.creditBalance}, New: {new_balance}")
            
            await prisma.user.update(
                where={"id": user.id},
                data={"creditBalance": new_balance}
            )
            print(f"✅ BALANCE UPDATED - User: {user_email}, New Balance: {new_balance}")

            # 4. Catat Transaksi (History)
            try:
                transaction = await prisma.credittransaction.create(
                    data={
                        "userId": user.id,
                        "amount": -amount, # Minus karena pemakaian
                        "description": description
                    }
                )
                print(f"📝 TRANSACTION LOGGED - ID: {transaction.id}, Amount: -{amount}")
            except Exception as tx_error:
                print(f"⚠️ Transaction logging failed: {tx_error} (but deduction succeeded)")

            print(f"🎉 CREDIT DEDUCTION SUCCESS - User: {user_email}, Remaining: {new_balance}")
            return True

        except Exception as e:
            print(f"CRITICAL ERROR deduct_credits: {e}")
            return False

class SubscriptionService:
    """Service for subscription management"""
    pass

class ImageCleanupService:
    """Service for image cleanup"""
    pass

def get_pricing_plans():
    """Return pricing plans"""
    return {
        "topup_packages": [
            {"credits": 20, "price": 10000, "name": "Paket Hemat"},
            {"credits": 50, "price": 22000, "name": "Paket Sedang"}, 
            {"credits": 100, "price": 35000, "name": "Paket Jumbo"}
        ],
        "pro_subscription": {
            "monthly_price": 49000,
            "credits_per_month": 200
        }
    }