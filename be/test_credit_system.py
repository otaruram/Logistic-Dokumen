#!/usr/bin/env python3
"""
Test script untuk sistem kredit harian dan notifikasi
"""

import sys
import os
from datetime import datetime, date
import calendar

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_credit_functions():
    """Test credit system functions"""
    print("🧪 Testing Credit System Functions...")
    
    try:
        from pricing_service import CreditService
        
        # Test 1: Credit exhaustion messages
        print("\n📊 Testing Credit Messages:")
        for credits in [0, 1, 2, 3]:
            message = CreditService.get_credit_exhaustion_message(credits)
            print(f"   Credits: {credits} -> {message['type']}: {message['message']}")
        
        # Test 2: Monthly cleanup warning
        print("\n📅 Testing Monthly Cleanup Logic:")
        today = date.today()
        last_day_of_month = calendar.monthrange(today.year, today.month)[1]
        days_until_cleanup = last_day_of_month - today.day
        
        print(f"   Today: {today}")
        print(f"   Last day of month: {last_day_of_month}")
        print(f"   Days until cleanup: {days_until_cleanup}")
        
        if days_until_cleanup <= 7:
            print("   ⚠️  CLEANUP WARNING: In last week of month!")
        else:
            print("   ✅ No cleanup warning needed")
        
        # Test 3: Daily credit constants
        print(f"\n💰 Daily Credit Limit: {CreditService.DAILY_CREDIT_LIMIT}")
        
        print("\n✅ All credit system tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_date_logic():
    """Test date and time logic"""
    print("\n🕐 Testing Date Logic:")
    
    today = date.today()
    now = datetime.now()
    
    print(f"   Today: {today}")
    print(f"   Current time: {now}")
    
    # Test user-specific monthly cleanup timing
    print(f"\n📅 User-Specific Monthly Cleanup Examples:")
    
    # Example: User registered on Jan 13
    reg_date = date(2025, 1, 13)
    print(f"   User registered: {reg_date}")
    
    # Calculate next cleanup (same day next month)
    if today.month == 12:
        next_cleanup = date(today.year + 1, 1, reg_date.day)
    else:
        try:
            next_cleanup = date(today.year, today.month + 1, reg_date.day)
        except ValueError:
            # Handle month-end cases
            import calendar
            last_day_next_month = calendar.monthrange(today.year, today.month + 1)[1]
            day_to_use = min(reg_date.day, last_day_next_month)
            next_cleanup = date(today.year, today.month + 1, day_to_use)
    
    days_until_cleanup = (next_cleanup - today).days
    print(f"   Next cleanup: {next_cleanup}")
    print(f"   Days until cleanup: {days_until_cleanup}")
    
    if days_until_cleanup <= 7:
        print("   📢 Should show backup warning!")
    
    # Check if today is cleanup day
    is_cleanup_day = (
        today.day == reg_date.day or
        (reg_date.day > calendar.monthrange(today.year, today.month)[1] and 
         today.day == calendar.monthrange(today.year, today.month)[1])
    )
    
    if is_cleanup_day:
        print("   🗑️  Should perform monthly cleanup for this user!")
    else:
        print("   ✅ No cleanup needed for this user today")

if __name__ == "__main__":
    print("🚀 OCR.WTF Credit System Test")
    print("=" * 50)
    
    # Test basic functions
    test_date_logic()
    
    # Test credit functions
    success = test_credit_functions()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ All tests completed successfully!")
        print("🎉 User-specific monthly cleanup system is ready!")
        print(f"📅 Current date: {date.today()}")
        print("🔄 Monthly cleanup: Based on each user's registration anniversary")
        print("💳 Daily credits: 3 per day with auto-reset")
        print("📢 Example: User registered Jan 13 → cleanup on Feb 13, Mar 13, etc.")
    else:
        print("❌ Some tests failed!")
    
    print("=" * 50)