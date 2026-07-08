import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    with conn.cursor() as cur:
        try:
            cur.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_api_credits INT DEFAULT 50;")
            print("Successfully added partner_api_credits to profiles")
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    main()
