from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions
from config.settings import settings
import base64
from typing import Union
import os

# Inisialisasi ImageKit
try:
    imagekit = ImageKit(
        private_key=settings.IMAGEKIT_PRIVATE_KEY,
        public_key=settings.IMAGEKIT_PUBLIC_KEY,
        url_endpoint=settings.IMAGEKIT_URL_ENDPOINT
    )
    print(f"✅ ImageKit initialized successfully")
except Exception as e:
    print(f"❌ ImageKit initialization failed: {e}")
    imagekit = None

class ImageKitService:
    @staticmethod
    def upload_file(file: Union[bytes, str], file_name: str, folder: str = "/scans") -> dict:
        if not imagekit:
            raise Exception("ImageKit configuration missing")
            
        try:
            # 1. Siapkan konten file
            if isinstance(file, bytes):
                file_content = base64.b64encode(file).decode('utf-8')
            elif isinstance(file, str) and (file.startswith('/') or file.startswith('C:') or ':\\' in file):
                with open(file, 'rb') as f:
                    file_content = base64.b64encode(f.read()).decode('utf-8')
            else:
                file_content = file
            
            print(f"📤 Uploading {file_name} to ImageKit...")
            
            # --- PERBAIKAN: Gunakan Option Paling Sederhana ---
            # Kita hapus parameter 'response_fields' yang sering bikin error
            options = UploadFileRequestOptions(
                folder=folder,
                use_unique_file_name=True,
                overwrite_file=False,
                overwrite_ai_tags=False,
                overwrite_tags=False,
                overwrite_custom_metadata=False
            )
            
            # 3. Upload
            result = imagekit.upload_file(
                file=file_content,
                file_name=file_name,
                options=options 
            )
            
            # 4. Ambil Hasil (Kompatibel dengan semua versi)
            # Cek apakah result punya atribut url atau dict
            url = getattr(result, 'url', None)
            file_id = getattr(result, 'file_id', None)
            name = getattr(result, 'name', None)
            thumbnail_url = getattr(result, 'thumbnail_url', None)

            # Fallback jika result adalah dict (versi lama)
            if url is None and isinstance(result, dict):
                url = result.get('url')
                file_id = result.get('fileId')
                name = result.get('name')
                thumbnail_url = result.get('thumbnailUrl')
            
            # Fallback terakhir ke response_metadata
            if url is None and hasattr(result, 'response_metadata'):
                 raw = result.response_metadata.raw
                 url = raw.get('url')
                 file_id = raw.get('fileId')

            print(f"✅ Upload success! URL: {url}")
            
            return {
                "file_id": file_id,
                "url": url,
                "thumbnail_url": thumbnail_url,
                "name": name or file_name
            }
            
        except Exception as e:
            print(f"❌ ImageKit upload error: {str(e)}")
            # Jangan biarkan app crash, return dummy jika gagal upload
            # Supaya user tetap bisa dapat hasil OCR meski gambar gagal upload
            return {
                "file_id": None,
                "url": f"data:image/png;base64,invalid", # Dummy URL
                "name": file_name
            }

    @staticmethod
    def delete_image(file_id: str) -> bool:
        try:
            imagekit.delete_file(file_id)
            return True
        except Exception:
            return False