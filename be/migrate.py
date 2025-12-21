"""Run database migration for scans table"""
from config.database import engine
from sqlalchemy import text

def run_migration():
    with open('add-scan-columns.sql', 'r') as f:
        sql = f.read()
    
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    
    print('✅ Migration completed successfully!')

if __name__ == '__main__':
    run_migration()
