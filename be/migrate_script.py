from sqlalchemy import text
from config.database import engine

def migrate():
    print("🔄 Adding 'script' column to ppt_history table...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE ppt_history ADD COLUMN script TEXT;"))
            conn.commit()
            print("✅ 'script' column added successfully!")
        except Exception as e:
            print(f"⚠️ Error (might already exist): {e}")

if __name__ == "__main__":
    migrate()
