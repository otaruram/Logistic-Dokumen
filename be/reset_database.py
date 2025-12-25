"""
Script untuk reset semua data pengguna di database
"""
import asyncio
import os
import shutil
from prisma import Prisma

async def reset_database():
    """Reset semua data di database dan hapus file uploads"""
    db = Prisma()
    await db.connect()
    
    try:
        # Hitung total data sebelum dihapus
        total_logs = await db.logs.count()
        print(f"📊 Total log yang akan dihapus: {total_logs}")
        
        # Hapus semua data dari tabel logs
        deleted = await db.logs.delete_many()
        print(f"✅ Berhasil menghapus {deleted} log dari database")
        
        # Hapus semua file di folder uploads
        uploads_path = os.path.join(os.path.dirname(__file__), 'uploads')
        if os.path.exists(uploads_path):
            # Hapus semua file di dalam folder uploads
            for filename in os.listdir(uploads_path):
                file_path = os.path.join(uploads_path, filename)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                    print(f"🗑️  Dihapus: {filename}")
                except Exception as e:
                    print(f"❌ Error menghapus {filename}: {e}")
            
            print(f"✅ Folder uploads telah dibersihkan")
        else:
            print("⚠️  Folder uploads tidak ditemukan")
        
        print("\n🎉 DATABASE BERHASIL DI-RESET!")
        print("Semua data pengguna telah dihapus dan database kembali seperti baru.")
        
    except Exception as e:
        print(f"❌ Error saat reset database: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(reset_database())
