"""
Cron Jobs untuk Pricing System
File: be/pricing_cron.py

Setup cron jobs untuk:
1. Cleanup expired images (daily at 2 AM)
2. Reset monthly credits for PRO users (daily check)
3. System maintenance tasks
"""

import asyncio
import schedule
import time
import logging
from datetime import datetime
from prisma import Prisma
from pricing_service import ImageCleanupService, SubscriptionService

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pricing_cron.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PricingCronJobs:
    def __init__(self):
        self.prisma = Prisma()
    
    async def connect_db(self):
        """Connect to database"""
        try:
            await self.prisma.connect()
            logger.info("Connected to database for cron jobs")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    async def disconnect_db(self):
        """Disconnect from database"""
        try:
            if self.prisma.is_connected():
                await self.prisma.disconnect()
                logger.info("Disconnected from database")
        except Exception as e:
            logger.error(f"Error disconnecting from database: {e}")
    
    async def daily_cleanup_job(self):
        """Daily job to cleanup expired images"""
        logger.info("Starting daily image cleanup job")
        try:
            await self.connect_db()
            cleanup_count = await ImageCleanupService.cleanup_expired_images(self.prisma)
            logger.info(f"Daily cleanup completed: {cleanup_count} images cleaned")
        except Exception as e:
            logger.error(f"Daily cleanup job failed: {e}")
        finally:
            await self.disconnect_db()
    
    async def daily_credit_reset_job(self):
        """Daily job to check and reset PRO users credits"""
        logger.info("Starting daily credit reset job")
        try:
            await self.connect_db()
            reset_count = await SubscriptionService.process_monthly_reset(self.prisma)
            logger.info(f"Daily credit reset completed: {reset_count} users processed")
        except Exception as e:
            logger.error(f"Daily credit reset job failed: {e}")
        finally:
            await self.disconnect_db()
    
    async def system_health_check(self):
        """Daily system health check"""
        logger.info("Starting system health check")
        try:
            await self.connect_db()
            
            # Check database connectivity
            user_count = await self.prisma.user.count()
            
            # Check for stuck transactions or other issues
            # TODO: Add more health checks as needed
            
            logger.info(f"System health check completed: {user_count} total users")
            
        except Exception as e:
            logger.error(f"System health check failed: {e}")
        finally:
            await self.disconnect_db()
    
    def run_async_job(self, coro):
        """Helper to run async jobs in sync context"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(coro)
            loop.close()
        except Exception as e:
            logger.error(f"Error running async job: {e}")
    
    def setup_schedule(self):
        """Setup all scheduled jobs"""
        logger.info("Setting up pricing cron jobs schedule")
        
        # Daily cleanup at 2:00 AM
        schedule.every().day.at("02:00").do(
            self.run_async_job, 
            self.daily_cleanup_job()
        )
        
        # Daily credit reset check at 3:00 AM
        schedule.every().day.at("03:00").do(
            self.run_async_job,
            self.daily_credit_reset_job()
        )
        
        # System health check at 4:00 AM
        schedule.every().day.at("04:00").do(
            self.run_async_job,
            self.system_health_check()
        )
        
        logger.info("Cron jobs scheduled successfully")
    
    def start(self):
        """Start the cron job scheduler"""
        logger.info("Starting pricing cron job scheduler")
        self.setup_schedule()
        
        while True:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except KeyboardInterrupt:
                logger.info("Cron job scheduler stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in cron scheduler: {e}")
                time.sleep(60)  # Continue after error

def main():
    """Main function to run cron jobs"""
    cron = PricingCronJobs()
    
    try:
        cron.start()
    except Exception as e:
        logger.error(f"Failed to start cron jobs: {e}")
    finally:
        # Cleanup
        asyncio.run(cron.disconnect_db())

if __name__ == "__main__":
    main()


# Alternative: Simple one-time job runners for manual testing

async def run_cleanup_now():
    """Run cleanup job immediately for testing"""
    cron = PricingCronJobs()
    await cron.daily_cleanup_job()

async def run_reset_now():
    """Run credit reset job immediately for testing"""
    cron = PricingCronJobs()
    await cron.daily_credit_reset_job()

# Usage for manual testing:
# python -c "import asyncio; from pricing_cron import run_cleanup_now; asyncio.run(run_cleanup_now())"