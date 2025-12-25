import os
import io
import tempfile
from pypdf import PdfWriter, PdfReader
from pdf2image import convert_from_path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from pikepdf import Pdf as PikePdf
from PIL import Image

class PdfToolbox:

    # --- 1. MERGE IMAGES TO PDF (Gabung Foto jadi PDF) ---
    @staticmethod
    def merge_images_to_pdf(list_image_paths):
        """Gabungkan 2-4 foto (JPG/PNG) jadi 1 PDF."""
        if len(list_image_paths) < 2 or len(list_image_paths) > 4:
            return None
        
        try:
            output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            output_path = output_file.name
            output_file.close()
            
            # Convert images to RGB mode (PDF standard)
            images = []
            for img_path in list_image_paths:
                img = Image.open(img_path)
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                images.append(img)
            
            # Save as multi-page PDF
            images[0].save(
                output_path,
                save_all=True,
                append_images=images[1:],
                resolution=100.0,
                quality=95
            )
            
            return output_path
        except Exception as e:
            print(f"Merge images error: {e}")
            return None

    # --- 2. SPLIT PDF (Pisah) ---
    @staticmethod
    def split_pdf(input_path, start_page, end_page):
        """Ambil halaman tertentu saja. (Ingat: start_page mulai dari 0)"""
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        # Validasi halaman
        total_pages = len(reader.pages)
        if start_page < 0 or end_page > total_pages:
            return None

        try:
            for i in range(start_page, end_page):
                writer.add_page(reader.pages[i])
            
            output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            writer.write(output_file)
            writer.close()
            output_file.close()
            return output_file.name
        except Exception:
            return None

    # --- 3. PDF TO IMAGE (Konversi) - HATI-HATI: BERAT! ---
    @staticmethod
    def pdf_to_images(input_path, max_pages=10):
        """Convert PDF ke list of Images (JPG). Max 10 halaman untuk keamanan server."""
        try:
            # DPI 150 cukup buat web/sosmed. Kalau 300 berat banget.
            images = convert_from_path(input_path, dpi=150, fmt='jpeg', last_page=max_pages)
            
            image_paths = []
            for i, img in enumerate(images):
                # Simpan tiap halaman jadi file gambar temp
                tmp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
                img.save(tmp_img.name, 'JPEG')
                image_paths.append(tmp_img.name)
                tmp_img.close()
                
            return image_paths # Kembalikan list lokasi file gambarnya
        except Exception as e:
            print(f"❌ PDF to images error: {e}")
            print("⚠️ Make sure Poppler is installed: sudo apt install poppler-utils")
            return []

    # --- 4. WATERMARK (Stempel) ---
    @staticmethod
    def add_watermark(input_path, watermark_text="CONFIDENTIAL"):
        """Tempel tulisan transparan di tengah halaman."""
        
        # Langkah A: Bikin file PDF sementara isinya cuma tulisan watermark
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=letter)
        can.setFont("Helvetica-Bold", 50)
        can.setFillColorRGB(0.5, 0.5, 0.5, 0.2) # Abu-abu, Transparan 20%
        
        # Posisi miring di tengah (X, Y, Rotate)
        can.saveState()
        can.translate(300, 400)
        can.rotate(45)
        can.drawCentredString(0, 0, watermark_text)
        can.restoreState()
        can.save()
        packet.seek(0)
        
        # Langkah B: Gabungkan (Overlay) watermark ke PDF asli
        watermark_pdf = PdfReader(packet)
        watermark_page = watermark_pdf.pages[0]
        
        original_pdf = PdfReader(input_path)
        writer = PdfWriter()

        try:
            for page in original_pdf.pages:
                page.merge_page(watermark_page) # Tempel di sini
                writer.add_page(page)
                
            output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            writer.write(output_file)
            writer.close()
            output_file.close()
            return output_file.name
        except Exception:
            return None

    # --- 5. UNLOCK PDF (Buka Password) ---
    @staticmethod
    def unlock_pdf(input_path, password):
        """Hapus password dari PDF."""
        try:
            # Library pikepdf lebih jago urusan dekripsi dibanding pypdf
            pdf = PikePdf.open(input_path, password=password, allow_overwriting_input=True)
            
            output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            output_path = output_file.name
            output_file.close()
            
            pdf.save(output_path) # Save ulang tanpa enkripsi
            pdf.close()  # Important: Close before returning
            return output_path
        except Exception as e:
            print(f"Unlock error: {e}")
            return None # Password salah atau file rusak

    # --- UTILS: BERSIH-BERSIH ---
    @staticmethod
    def cleanup_files(file_paths):
        """Hapus file temp biar server gak penuh."""
        import time
        if isinstance(file_paths, list):
            for path in file_paths:
                try:
                    if os.path.exists(path):
                        time.sleep(0.1)  # Small delay for Windows file locks
                        os.remove(path)
                except PermissionError:
                    pass  # Ignore file still in use
        elif isinstance(file_paths, str):
            try:
                if os.path.exists(file_paths):
                    time.sleep(0.1)
                    os.remove(file_paths)
            except PermissionError:
                pass
