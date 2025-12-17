import asyncio
import os
from datetime import datetime, timedelta
from prisma import Prisma
from dotenv import load_dotenv

# Load env biar Prisma bisa konek DB
load_dotenv()

# --- KONFIGURASI ---
RETENTION_DAYS = 30  # Hapus data yang lebih tua dari 30 hari
UPLOAD_DIR = "uploads" # Nama folder tempat simpan gambar

async def cleanup():
    print(f"🧹 [CLEANUP START] {datetime.now()}")
    
    db = Prisma()
    try:
        await db.connect()
        
        # 1. Tentukan Tanggal Batas (Cutoff)
        cutoff_date = datetime.now() - timedelta(days=RETENTION_DAYS)
        print(f"📅 Menghapus data sebelum: {cutoff_date.strftime('%Y-%m-%d')}")

        # 2. Cari Log Lama (Kita butuh nama filenya untuk hapus gambar)
        old_logs = await db.logs.find_many(
            where={
                "timestamp": {
                    "lt": cutoff_date
                }
            }
        )

        if not old_logs:
            print("✅ Tidak ada data lama yang perlu dihapus.")
            return

        print(f"magnemukan {len(old_logs)} log lama. Memulai pembersihan...")

        # 3. Hapus File Fisik (Gambar) di VPS
        deleted_files_count = 0
        for log in old_logs:
            if log.filename:
                # Gabungkan path folder + nama file
                file_path = os.path.join(os.getcwd(), UPLOAD_DIR, log.filename)
                
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        deleted_files_count += 1
                        # print(f"🗑️ File deleted: {log.filename}") # Uncomment kalau mau log detail
                except Exception as e:
                    print(f"⚠️ Gagal hapus file {log.filename}: {e}")

        print(f"🗑️  Berhasil menghapus {deleted_files_count} file fisik dari disk.")

        # 4. Hapus Data di Database
        delete_result = await db.logs.delete_many(
            where={
                "timestamp": {
                    "lt": cutoff_date
                }
            }
        )
        
        print(f"💾 Berhasil menghapus {delete_result} baris data dari database.")
        print("✅ [CLEANUP FINISHED] Storage VPS & Database aman!")

    except Exception as e:
        print(f"❌ Error Cleanup: {e}")
    finally:
        if db.is_connected():
            await db.disconnect()

if __name__ == "__main__":
    asyncio.run(cleanup())
