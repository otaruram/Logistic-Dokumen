#!/usr/bin/env python3

import asyncio
from prisma import Prisma
from dotenv import load_dotenv
import os

async def test_database_connection():
    """Test database connection to diagnose the issue"""
    load_dotenv()
    
    print("🔍 Testing database connection...")
    print(f"DATABASE_URL: {os.getenv('DATABASE_URL')[:50]}...")
    
    prisma = Prisma()
    
    try:
        await prisma.connect()
        print("✅ Database connected successfully!")
        
        # Test a simple query
        result = await prisma.logs.count()
        print(f"📊 Total logs in database: {result}")
        
        await prisma.disconnect()
        print("✅ Database disconnected successfully!")
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_database_connection())