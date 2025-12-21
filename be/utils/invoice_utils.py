import os
import re
import tempfile
from datetime import datetime
from num2words import num2words
from pypdf import PdfWriter, PdfReader
from slugify import slugify

class InvoiceFeatures:
    
    # ==========================================
    # 1. SMART RENAME 2.0 (UPGRADED)
    # ==========================================
    @staticmethod
    def generate_filename(vendor_name, invoice_no=None, extension="pdf"):
        """
        Mengubah nama file jadi standar rapi.
        Format: [TAHUN]-[BULAN]-[VENDOR]-[INV_OPTIONAL].[EXT]
        Contoh: 
        - Input: Vendor="Toko Jono", Inv="INV/001"
        - Output: "2025-12-toko-jono-inv-001.pdf"
        - Input: Vendor="Toko Jono", Inv=None
        - Output: "2025-12-toko-jono.pdf"
        """
        # 1. Ambil waktu sekarang
        date_prefix = datetime.now().strftime("%Y-%m")
        
        # 2. Bersihkan nama Vendor (Slugify: Hapus spasi & karakter aneh)
        clean_vendor = slugify(vendor_name)

        # 3. Logic Invoice Number Optional
        if invoice_no and invoice_no.strip():
            clean_inv = slugify(invoice_no)
            new_name = f"{date_prefix}-{clean_vendor}-{clean_inv}.{extension}"
        else:
            # Kalau gak ada invoice number, cukup tanggal & vendor
            new_name = f"{date_prefix}-{clean_vendor}.{extension}"

        return new_name

    # ==========================================
    # 2. TERBILANG PRO (UPGRADED)
    # ==========================================
    @staticmethod
    def generate_terbilang(nominal):
        """
        Mengubah angka ke kalimat Rupiah yang formal.
        Support angka besar dan desimal.
        """
        try:
            # Pastikan input adalah angka (int/float)
            nominal = float(str(nominal).replace(',', ''))
            
            if nominal == 0:
                return "Nol Rupiah"

            # Convert angka ke kata
            kalimat = num2words(nominal, lang='id')
            
            # Formatting: Ubah "point" jadi "koma" & Title Case
            kalimat = kalimat.replace('point', 'koma')
            
            # Return dengan akhiran "Rupiah" dan Huruf Besar di Awal Kata
            return f"{kalimat.title()} Rupiah"
            
        except (ValueError, Exception):
            return "Nominal tidak valid"

    # ==========================================
    # 3. CEK NPWP REGULATORY STANDARD (UPGRADED)
    # ==========================================
    @staticmethod
    def validate_npwp(npwp_input):
        """
        Validasi NPWP sesuai standar Dirjen Pajak.
        Support:
        - 15 Digit (Format Lama: 99.999.999.9-999.999)
        - 16 Digit (Format Baru/NIK: 9999999999999999)
        """
        # 1. Bersihkan input (Hanya ambil angka)
        clean_npwp = re.sub(r'\D', '', str(npwp_input))
        length = len(clean_npwp)

        # 2. Logic Validasi & Formatting
        if length == 15:
            # Format Standar NPWP Badan/Pribadi Lama
            # Pattern: XX.XXX.XXX.X-XXX.XXX
            formatted = (f"{clean_npwp[:2]}.{clean_npwp[2:5]}.{clean_npwp[5:8]}.{clean_npwp[8]}-"
                         f"{clean_npwp[9:12]}.{clean_npwp[12:]}")
            return (True, {
                "type": "NPWP 15 Digit (Standar)",
                "formatted": formatted,
                "clean": clean_npwp
            })
            
        elif length == 16:
            # Format NPWP Orang Pribadi (NIK) sesuai PMK 112/2022
            # Pattern: XXXX-XXXX-XXXX-XXXX (Format NIK umum)
            formatted = f"{clean_npwp[:4]}-{clean_npwp[4:8]}-{clean_npwp[8:12]}-{clean_npwp[12:]}"
            return (True, {
                "type": "NPWP 16 Digit (NIK/Baru)",
                "formatted": formatted,
                "clean": clean_npwp
            })
            
        else:
            return (False, {
                "message": "Panjang NPWP harus 15 digit (Lama) atau 16 digit (NIK)"
            })

    # --- FITUR 4 & 5: MERGE PDF & PASSWORD (Berat - Butuh Penanganan Khusus) ---
    @staticmethod
    def process_pdf_bundle(list_file_paths, output_password=None):
        """
        Menggabungkan banyak PDF jadi satu & opsional kasih password.
        Menggunakan tempfile agar tidak menuhin storage.
        """
        merger = PdfWriter()

        try:
            # 1. Proses Penggabungan
            for pdf_path in list_file_paths:
                merger.append(pdf_path)

            # 2. Proses Enkripsi (Jika ada password)
            if output_password:
                merger.encrypt(output_password)

            # 3. Simpan ke Temporary File (Bukan folder project)
            # delete=False artinya file tidak lgsg hilang setelah di-close (biar bisa didownload dulu)
            temp_output = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            merger.write(temp_output)
            merger.close()
            
            temp_output.close() # Tutup akses file biar bisa dibaca proses lain
            
            return temp_output.name # Kembalikan path file sementara

        except Exception as e:
            return None

    # --- FITUR MEMBERSIHKAN SAMPAH (Penting utk Server) ---
    @staticmethod
    def cleanup_temp_file(file_path):
        """Hapus file temporary setelah selesai didownload user"""
        if os.path.exists(file_path):
            os.remove(file_path)
