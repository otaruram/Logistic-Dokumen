"""
Pricing & Credit System Backend Logic
File: be/pricing_service.py
"""

from enum import Enum
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os
import logging

logger = logging.getLogger(__name__)

class PlanType(Enum):
    STARTER = "STARTER"
    PRO = "PRO"

class CreditService:
    """Service untuk mengelola credit dan pricing logic"""
    
    # Konfigurasi Pricing
    STARTER_INITIAL_CREDITS = 10
    PRO_MONTHLY_CREDITS = 200
    DAILY_SYSTEM_LIMIT = 500
    FREE_TIER_DAILY_LIMIT_THRESHOLD = 450
    
    # Pricing Configuration
    PRICING_CONFIG = {
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
    
    @staticmethod
    async def check_scan_eligibility(user_email: str, prisma) -> Dict[str, Any]:
        """
        Cek apakah user boleh melakukan scan
        Returns: {"allowed": bool, "reason": str, "remaining_credits": int}
        """
        try:
            # 1. Get user data
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                return {"allowed": False, "reason": "User tidak ditemukan", "remaining_credits": 0}
            
            # 2. Cek saldo credit
            if user.creditBalance < 1:
                return {
                    "allowed": False, 
                    "reason": "Credit habis. Silakan top up atau upgrade ke Pro.",
                    "remaining_credits": 0
                }
            
            # 3. Cek limit sistem harian (khusus STARTER)
            if user.planType == PlanType.STARTER.value:
                today_scans = await CreditService._get_today_system_scans(prisma)
                if today_scans >= CreditService.FREE_TIER_DAILY_LIMIT_THRESHOLD:
                    return {
                        "allowed": False,
                        "reason": "Server sedang penuh. Upgrade ke Pro untuk jalur prioritas.",
                        "remaining_credits": user.creditBalance
                    }
            
            return {
                "allowed": True,
                "reason": "OK",
                "remaining_credits": user.creditBalance
            }
            
        except Exception as e:
            logger.error(f"Error checking scan eligibility: {e}")
            return {"allowed": False, "reason": "Terjadi kesalahan sistem", "remaining_credits": 0}
    
    @staticmethod
    async def ensure_user_default_credits(user_email: str, default_credits: int = 10, prisma = None):
        """
        Memastikan user baru mendapat default credits
        """
        try:
            if not prisma:
                print("⚠️ Database not available for credit initialization")
                return False
                
            # Check if user exists
            existing_user = await prisma.user.find_unique(where={"email": user_email})
            
            if not existing_user:
                # Create new user with default credits
                new_user = await prisma.user.create(
                    data={
                        "email": user_email,
                        "creditBalance": default_credits,
                        "planType": "starter"
                    }
                )
                
                # Log the credit grant
                await prisma.credittransaction.create(
                    data={
                        "userId": new_user.id,
                        "amount": default_credits,
                        "description": f"Welcome bonus - {default_credits} free credits"
                    }
                )
                
                print(f"✅ New user created with {default_credits} default credits: {user_email}")
                return True
            else:
                print(f"ℹ️ Existing user: {user_email}")
                return True
                
        except Exception as e:
            print(f"❌ Failed to ensure default credits: {e}")
            return False
    
    @staticmethod
    async def _get_today_system_scans(prisma) -> int:
        """Hitung total scan di seluruh sistem hari ini"""
        try:
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            
            count = await prisma.credittransaction.count(
                where={
                    "amount": -1,  # Hanya transaksi scan
                    "createdAt": {
                        "gte": today_start
                    }
                }
            )
            return count
            
        except Exception as e:
            logger.error(f"Error getting today's scans: {e}")
            return 0
    
    @staticmethod
    async def get_user_plan_info(user_email: str, prisma) -> Dict[str, Any]:
        """Get informasi lengkap paket user"""
        try:
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                return {"error": "User tidak ditemukan"}
            
            plan_info = {
                "email": user.email,
                "plan_type": user.planType,
                "credit_balance": user.creditBalance,
                "subscription_end_date": user.subscriptionEndDate,
                "is_pro_active": False
            }
            
            # Cek status PRO
            if user.planType == PlanType.PRO.value and user.subscriptionEndDate:
                plan_info["is_pro_active"] = user.subscriptionEndDate > datetime.now()
                if not plan_info["is_pro_active"]:
                    # Auto downgrade to STARTER if subscription expired
                    await prisma.user.update(
                        where={"email": user_email},
                        data={"planType": PlanType.STARTER.value}
                    )
                    plan_info["plan_type"] = PlanType.STARTER.value
            
            return plan_info
            
        except Exception as e:
            logger.error(f"Error getting user plan info: {e}")
            return {"error": "Terjadi kesalahan sistem"}

class ImageCleanupService:
    """Service untuk cleanup foto expired"""
    
    @staticmethod
    async def cleanup_expired_images(prisma):
        """
        Hapus foto user STARTER yang sudah > 7 hari
        Jalankan sebagai cron job setiap malam
        """
        try:
            seven_days_ago = datetime.now() - timedelta(days=7)
            
            # Cari foto yang perlu dihapus
            expired_scans = await prisma.scanhistory.find_many(
                where={
                    "user": {
                        "planType": PlanType.STARTER.value
                    },
                    "createdAt": {
                        "lt": seven_days_ago
                    },
                    "isImageExpired": False,
                    "imagePath": {
                        "not": None
                    }
                },
                include={"user": True}
            )
            
            cleanup_count = 0
            for scan in expired_scans:
                try:
                    # Hapus file fisik
                    if scan.imagePath and os.path.exists(scan.imagePath):
                        os.remove(scan.imagePath)
                    
                    # Update database
                    await prisma.scanhistory.update(
                        where={"id": scan.id},
                        data={
                            "isImageExpired": True,
                            "imagePath": None
                        }
                    )
                    cleanup_count += 1
                    
                except Exception as e:
                    logger.error(f"Error cleaning up scan {scan.id}: {e}")
            
            logger.info(f"Cleaned up {cleanup_count} expired images")
            return cleanup_count
            
        except Exception as e:
            logger.error(f"Error in cleanup_expired_images: {e}")
            return 0

class SubscriptionService:
    """Service untuk mengelola langganan PRO"""
    
    @staticmethod
    async def process_monthly_reset(prisma):
        """
        Reset credit bulanan untuk user PRO
        Jalankan sebagai cron job setiap hari
        """
        try:
            today = datetime.now().date()
            
            # Cari user PRO yang hari ini adalah tanggal reset-nya
            pro_users = await prisma.user.find_many(
                where={
                    "planType": PlanType.PRO.value,
                    "subscriptionEndDate": {
                        "gte": datetime.now()
                    }
                }
            )
            
            reset_count = 0
            for user in pro_users:
                # Cek apakah hari ini adalah tanggal reset bulanan
                if user.subscriptionEndDate:
                    # Assume subscription started 1 month before end date
                    # This logic can be improved with a separate subscription_start_date field
                    day_of_month = user.subscriptionEndDate.day
                    if today.day == day_of_month:
                        # Reset credit
                        await prisma.user.update(
                            where={"id": user.id},
                            data={"creditBalance": CreditService.PRO_MONTHLY_CREDITS}
                        )
                        
                        # Catat transaksi
                        await prisma.credittransaction.create(
                            data={
                                "userId": user.id,
                                "amount": CreditService.PRO_MONTHLY_CREDITS,
                                "description": "Reset Bulanan Pro"
                            }
                        )
                        reset_count += 1
            
            logger.info(f"Reset credit for {reset_count} PRO users")
            return reset_count
            
        except Exception as e:
            logger.error(f"Error in process_monthly_reset: {e}")
            return 0

def get_pricing_plans():
    """Return pricing plans configuration"""
    return {
        "plans": [
            {
                "name": "Starter",
                "price": 0,
                "credits": 10,
                "period": "Gratis",
                "features": [
                    "10 Kredit gratis",
                    "Akses OCR basic",
                    "Chat dengan Oki",
                    "Dukungan email"
                ]
            },
            {
                "name": "Power",
                "price": 25000,
                "credits": 50,
                "period": "Per bulan",
                "features": [
                    "50 Kredit per bulan",
                    "Akses OCR advanced",
                    "Chat unlimited dengan Oki",
                    "Priority support",
                    "Export ke Excel"
                ]
            },
            {
                "name": "Mega",
                "price": 45000,
                "credits": 120,
                "period": "Per bulan",
                "features": [
                    "120 Kredit per bulan",
                    "Semua fitur Power",
                    "API access",
                    "Bulk processing",
                    "Custom templates"
                ]
            },
            {
                "name": "Pro",
                "price": 75000,
                "credits": 200,
                "period": "Per bulan",
                "features": [
                    "200 Kredit per bulan",
                    "Semua fitur Mega",
                    "White-label solution",
                    "Dedicated support",
                    "Custom integrations"
                ]
            }
        ]
    }

async def ensure_user_default_credits(user_email: str, prisma):
    """Ensure new user gets 10 default credits"""
    try:
        user = await prisma.user.find_unique(where={"email": user_email})
        if not user:
            logger.warning(f"User {user_email} not found for credit allocation")
            return False
            
        # Check if user already has credit transactions
        existing_credits = await prisma.credittransaction.find_many(
            where={"userId": user.id}
        )
        
        if not existing_credits:
            # First time user - give 10 credits
            await prisma.credittransaction.create(
                data={
                    "userId": user.id,
                    "amount": 10,
                    "description": "Welcome Bonus - 10 Credit Gratis"
                }
            )
            logger.info(f"Gave 10 welcome credits to user {user_email}")
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"Error ensuring default credits for {user_email}: {e}")
        return False

    # Additional Credit Methods
    @staticmethod
    async def get_user_credits(user_email: str, prisma=None) -> int:
        """Get current credit balance for user"""
        try:
            if not prisma:
                logger.warning("Prisma client not available")
                return 10  # Default credits
                
            # Get user, create if not exists
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                # Create user with default credits
                await CreditService.ensure_default_credits(user_email, prisma)
                user = await prisma.user.find_unique(where={"email": user_email})
                if not user:
                    return 10  # Fallback
                
            transactions = await prisma.credittransaction.find_many(
                where={"userId": user.id}
            )
            
            # Calculate total credits
            total_credits = sum(t.amount for t in transactions)
            return max(0, total_credits)  # Never negative
            
        except Exception as e:
            logger.error(f"Error getting user credits for {user_email}: {e}")
            return 10  # Default fallback

    @staticmethod  
    async def get_user_tier(user_email: str, prisma=None) -> str:
        """Get user tier (starter, pro, etc.)"""
        try:
            if not prisma:
                return "starter"
                
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                return "starter"
            
            # For now, all users are starter
            # Later: implement tier logic based on subscription
            return "starter"
            
        except Exception as e:
            logger.error(f"Error getting user tier for {user_email}: {e}")
            return "starter"

    @staticmethod
    async def deduct_credits(user_email: str, amount: int, description: str, prisma=None) -> bool:
        """Deduct credits from user account"""
        try:
            if not prisma:
                logger.warning("Prisma client not available - cannot deduct credits")
                return True  # Graceful fallback
                
            # Get user first, create if not exists
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user:
                # Create user with default credits first
                await CreditService.ensure_default_credits(user_email, prisma)
                user = await prisma.user.find_unique(where={"email": user_email})
                if not user:
                    return False
                
            # Check current balance via transactions (more accurate)
            transactions = await prisma.credittransaction.find_many(
                where={"userId": user.id}
            )
            current_credits = sum(t.amount for t in transactions)
            
            if current_credits < amount:
                logger.warning(f"Insufficient credits for {user_email}: has {current_credits}, needs {amount}")
                return False
                
            # Create negative transaction to deduct credits
            await prisma.credittransaction.create(
                data={
                    "userId": user.id,
                    "amount": -amount,  # Negative to deduct
                    "description": description
                }
            )
            
            logger.info(f"Deducted {amount} credits from {user_email}: {description}")
            return True
            
        except Exception as e:
            logger.error(f"Error deducting credits for {user_email}: {e}")
            return True  # Graceful fallback