import os
import asyncio
from supabase import create_client, Client

# Load environment variables (handling both local and container paths if needed)
# For this script we assume env vars are set in the environment or we load from .env

from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Must use Service Role key to update all users

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def reset_credits():
    print("🔄 Starting daily credit reset...")
    try:
        # Update all users credits to 10
        # Supabase-py doesn't support bulk update without WHERE easily for all rows unless we iterate or use a stored procedure/SQL.
        # However, we can simpler use a large range or just iterate if not too many users.
        # Better approach: Use SQL function via RPC if possible, or just update.
        # Let's try to update where id is not null (all users).
        
        # Note: 'neq' check on a primary key might work to select all.
        
        # Actually, let's fetch IDs and update chunks or use a raw SQL if we were using SQLAlchemy.
        # But here we are using Supabase client.
        
        # Workaround for bulk update "all":
        # We can trigger an Edge Function or just use the SDK.
        
        # Let's try updating all users where credits < 10 (optimization).
        # We can't do simple "update all" without a filter in REST API sometimes.
        # But 'neq' id '0' works as a "Select All".
        
        response = supabase.table("users").update({"credits": 10}).neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        print(f"✅ Successfully reset credits for users.")
        # print(response)
        
    except Exception as e:
        print(f"❌ Error resetting credits: {e}")

if __name__ == "__main__":
    asyncio.run(reset_credits())
