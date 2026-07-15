import asyncio
import random
from utils.auth import supabase_admin

async def seed():
    print("Seeding 200 random phone numbers into whitelist...")
    prefixes = ["0812", "0813", "0821", "0822", "0852", "0853", "0857", "0858", "0878", "0877"]
    
    records = []
    for i in range(200):
        prefix = random.choice(prefixes)
        suffix = "".join([str(random.randint(0, 9)) for _ in range(8)])
        phone = f"{prefix}{suffix}"
        
        normalized_phone = "+62" + phone[1:]
        
        records.append({
            "phone_number": normalized_phone,
            "company_id": "demo-company",
            "employee_name": f"Karyawan Acak {i+1}",
            "is_active": True
        })
        
    try:
        res = supabase_admin.table("employee_whitelist").insert(records).execute()
        print(f"Success! Inserted {len(res.data)} records.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(seed())
