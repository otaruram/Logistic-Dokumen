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
    async def deduct_credit(user_email: str, description: str, prisma) -> bool:
        """
        Kurangi credit user dan catat transaksi
        Returns: True jika berhasil
        """
        try:
            user = await prisma.user.find_unique(where={"email": user_email})
            if not user or user.creditBalance < 1:
                return False
            
            # Update credit balance
            await prisma.user.update(
                where={"email": user_email},
                data={"creditBalance": user.creditBalance - 1}
            )
            
            # Catat transaksi
            await prisma.credittransaction.create(
                data={
                    "userId": user.id,
                    "amount": -1,
                    "description": description
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error deducting credit: {e}")
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