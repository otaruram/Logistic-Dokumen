#!/usr/bin/env python3
"""
Database initialization script for Supply Chain OCR system
"""

import asyncio
import os
from prisma import Prisma
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def init_database():
    """Initialize database connection and create tables if needed"""
    prisma = Prisma()
    
    try:
        print("Connecting to database...")
        await prisma.connect()
        print("✅ Connected to database successfully!")
        
        # Test the connection by trying to query
        try:
            logs_count = await prisma.logs.count()
            api_keys_count = await prisma.apikey.count()
            
            print(f"📊 Database status:")
            print(f"   - Logs table: {logs_count} records")
            print(f"   - API Keys table: {api_keys_count} records")
            print("✅ Database tables are accessible!")
            
        except Exception as query_error:
            print(f"⚠️  Database tables might not exist: {query_error}")
            print("💡 Run 'prisma db push' to create/update tables")
            
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        print("\n🔧 Troubleshooting steps:")
        print("1. Check your DATABASE_URL in .env file")
        print("2. Ensure database server is running")
        print("3. Run 'prisma db push' to sync schema")
        return False
        
    finally:
        if prisma.is_connected():
            await prisma.disconnect()
            print("Disconnected from database")
    
    return True

if __name__ == "__main__":
    success = asyncio.run(init_database())
    if success:
        print("\n🎉 Database initialization completed successfully!")
    else:
        print("\n💥 Database initialization failed!")
        exit(1)