# date_utils.py
from datetime import date, datetime, timedelta
import calendar

def calculate_cleanup_info_safe(user_joined_at):
    """
    Fungsi Robust untuk menghitung tanggal reset tanpa Error 500.
    Menangani edge cases: Tahun kabisat, bulan dengan 30 hari, user_joined_at None.
    """
    try:
        today = date.today()
        
        # 1. Validasi Input: Pastikan user_joined_at valid
        if not user_joined_at:
            # Fallback jika data user corrupt/tidak ada tanggal join
            return {
                "days_until_cleanup": 30,
                "next_cleanup_date": (today + timedelta(days=30)).strftime("%Y-%m-%d"),
                "should_warn": False
            }

        # Konversi ke object date jika inputnya datetime
        if isinstance(user_joined_at, datetime):
            reg_date = user_joined_at.date()
        else:
            reg_date = user_joined_at

        # 2. Tentukan Tanggal Reset Bulan INI
        # Logika: Jika user daftar tgl 31, tapi bulan ini cuma sampai tgl 30, pakai tgl 30.
        last_day_this_month = calendar.monthrange(today.year, today.month)[1]
        cleanup_day_this_month = min(reg_date.day, last_day_this_month)
        
        cleanup_date_candidate = date(today.year, today.month, cleanup_day_this_month)

        # 3. Bandingkan dengan Hari Ini
        if today < cleanup_date_candidate:
            # Belum reset bulan ini
            next_cleanup_date = cleanup_date_candidate
        else:
            # Sudah lewat tanggal reset bulan ini, ambil bulan DEPAN
            if today.month == 12:
                next_month = 1
                next_year = today.year + 1
            else:
                next_month = today.month + 1
                next_year = today.year
            
            # Handle tanggal di bulan depan (misal: Jan 31 -> Feb 28)
            last_day_next_month = calendar.monthrange(next_year, next_month)[1]
            cleanup_day_next_month = min(reg_date.day, last_day_next_month)
            
            next_cleanup_date = date(next_year, next_month, cleanup_day_next_month)

        # 4. Hitung Sisa Hari
        days_remaining = (next_cleanup_date - today).days

        # Safety: Hindari nilai negatif jika logika meleset (meski harusnya tidak mungkin dengan logika di atas)
        if days_remaining < 0:
            days_remaining = 0

        return {
            "days_until_cleanup": days_remaining,
            "next_cleanup_date": next_cleanup_date.strftime("%Y-%m-%d"), # Format string YYYY-MM-DD
            "should_warn": True # Selalu True agar notifikasi diproses frontend
        }

    except Exception as e:
        # PENTING: Catch semua error tak terduga agar API tidak return 500
        print(f"[ERROR] Calculation failed: {str(e)}")
        return {
            "days_until_cleanup": 0,
            "next_cleanup_date": "Error fetching date",
            "should_warn": False
        }