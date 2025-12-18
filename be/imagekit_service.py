from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

# Inisialisasi SDK ImageKit
imagekit = ImageKit(
    private_key=os.getenv('IMAGEKIT_PRIVATE_KEY'),
    public_key=os.getenv('IMAGEKIT_PUBLIC_KEY'),
    url_endpoint=os.getenv('IMAGEKIT_URL_ENDPOINT')
)

def upload_to_imagekit(file_path, file_name):
    """ Upload gambar ke ImageKit """
    try:
        with open(file_path, mode="rb") as img:
            upload = imagekit.upload_file(
                file=img,
                file_name=file_name,
                options=UploadFileRequestOptions(
                    folder="/ocr_scans/", 
                    use_unique_file_name=True
                )
            )
        return upload.url
    except Exception as e:
        print(f"❌ ImageKit Upload Error: {e}")
        return None

def delete_from_imagekit_by_url(image_url):
    """ 
    Menghapus gambar dari ImageKit berdasarkan URL-nya.
    Cocok untuk bersih-bersih data lama > 30 Hari.
    """
    try:
        # 1. Ambil Nama File dari URL
        # Contoh: https://ik.imagekit.io/id/ocr_scans/file_123.jpg -> file_123.jpg
        parsed = urlparse(image_url)
        file_name = os.path.basename(parsed.path)
        
        if not file_name: return False

        # 2. Cari File ID di ImageKit berdasarkan Nama
        # Kita harus cari ID-nya dulu karena API delete butuh ID, bukan URL
        search_files = imagekit.list_files({
            "name": file_name,
            "limit": 1
        })

        if search_files and len(search_files.list) > 0:
            file_id = search_files.list[0].file_id
            
            # 3. Hapus File
            imagekit.delete_file(file_id)
            print(f"🗑️ ImageKit Deleted: {file_name}")
            return True
        else:
            print(f"⚠️ File tidak ditemukan di ImageKit: {file_name}")
            return False

    except Exception as e:
        print(f"❌ Gagal Hapus ImageKit: {e}")
        return False
