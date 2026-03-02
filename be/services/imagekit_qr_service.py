from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions
from config.settings import settings
import base64
from typing import Union
from PIL import Image, ImageEnhance
from io import BytesIO

# Initialize ImageKit for QR Feature (separate account)
try:
    imagekit_qr = ImageKit(
        private_key=settings.IMAGEKIT_PRIVATE_KEY_QR,
        public_key=settings.IMAGEKIT_PUBLIC_KEY_QR,
        url_endpoint=settings.IMAGEKIT_URL_ENDPOINT_QR
    )
    print(f"✅ ImageKit QR initialized successfully")
    print(f"   Endpoint: {settings.IMAGEKIT_URL_ENDPOINT_QR}")
except Exception as e:
    print(f"❌ ImageKit QR initialization failed: {e}")
    imagekit_qr = None

class ImageKitQRService:
    """ImageKit service specifically for QR/DGTNZ feature with separate credentials"""
    
    @staticmethod
    def upload_file(file: Union[bytes, str], file_name: str, folder: str = "/qr-scans") -> dict:
        """Upload photo/scan to ImageKit QR account"""
        if not imagekit_qr:
            raise Exception("ImageKit QR configuration missing")
            
        try:
            # Prepare file content
            if isinstance(file, bytes):
                file_content = base64.b64encode(file).decode('utf-8')
            elif isinstance(file, str) and (file.startswith('/') or file.startswith('C:') or ':\\' in file):
                with open(file, 'rb') as f:
                    file_content = base64.b64encode(f.read()).decode('utf-8')
            else:
                file_content = file
            
            print(f"📤 Uploading {file_name} to ImageKit QR ({folder})...")
            
            options = UploadFileRequestOptions(
                folder=folder,
                use_unique_file_name=True,
                overwrite_file=False,
                overwrite_ai_tags=False,
                overwrite_tags=False,
                overwrite_custom_metadata=False
            )
            
            result = imagekit_qr.upload_file(
                file=file_content,
                file_name=file_name,
                options=options 
            )
            
            # Extract result
            url = getattr(result, 'url', None)
            file_id = getattr(result, 'file_id', None)
            name = getattr(result, 'name', None)
            thumbnail_url = getattr(result, 'thumbnail_url', None)

            # Fallback for dict response
            if url is None and isinstance(result, dict):
                url = result.get('url')
                file_id = result.get('fileId')
                name = result.get('name')
                thumbnail_url = result.get('thumbnailUrl')
            
            # Fallback to response_metadata
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
            print(f"❌ ImageKit QR upload error: {str(e)}")
            raise Exception(f"ImageKit QR upload failed: {str(e)}")

    @staticmethod
    def upload_signature(file: Union[bytes, str], file_name: str) -> dict:
        """Upload signature with brightness enhancement to ImageKit QR account"""
        if not imagekit_qr:
            raise Exception("ImageKit QR configuration missing")
            
        try:
            # Read file content
            if isinstance(file, bytes):
                content = file
            elif isinstance(file, str) and (file.startswith('/') or file.startswith('C:') or ':\\' in file):
                with open(file, 'rb') as f:
                    content = f.read()
            else:
                # Assume it's already base64 or data URL
                content = file
            
            # Enhance signature brightness and contrast
            print("🎨 Enhancing signature brightness...")
            img = Image.open(BytesIO(content))
            
            # Handle transparency (RGBA) before converting to RGB
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                img = img.convert('RGBA')
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3]) # Use alpha channel as mask
                img = background
            
            # Convert to RGB if needed (e.g. Grayscale)
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Increase brightness by 30%
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1.3)
            
            # Increase contrast by 15%
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.15)
            
            # Convert back to bytes
            buffer = BytesIO()
            img.save(buffer, format='PNG', quality=95)
            enhanced_content = buffer.getvalue()
            
            # Upload enhanced signature
            file_content = base64.b64encode(enhanced_content).decode('utf-8')
            
            print(f"📤 Uploading enhanced signature to ImageKit QR...")
            
            options = UploadFileRequestOptions(
                folder="/qr-signatures",
                use_unique_file_name=True,
                overwrite_file=False,
                overwrite_ai_tags=False,
                overwrite_tags=False,
                overwrite_custom_metadata=False
            )
            
            result = imagekit_qr.upload_file(
                file=file_content,
                file_name=file_name,
                options=options
            )
            
            # Extract result
            url = getattr(result, 'url', None)
            file_id = getattr(result, 'file_id', None)
            name = getattr(result, 'name', None)
            thumbnail_url = getattr(result, 'thumbnail_url', None)

            # Fallback for dict response
            if url is None and isinstance(result, dict):
                url = result.get('url')
                file_id = result.get('fileId')
                name = result.get('name')
                thumbnail_url = result.get('thumbnailUrl')
            
            # Fallback to response_metadata
            if url is None and hasattr(result, 'response_metadata'):
                 raw = result.response_metadata.raw
                 url = raw.get('url')
                 file_id = raw.get('fileId')

            print(f"✅ Signature uploaded: {url}")
            
            return {
                "file_id": file_id,
                "url": url,
                "thumbnail_url": thumbnail_url,
                "name": name or file_name
            }
            
        except Exception as e:
            print(f"❌ ImageKit QR signature upload error: {str(e)}")
            raise Exception(f"Signature upload failed: {str(e)}")

    @staticmethod
    def delete_file(file_id: str) -> bool:
        """Delete file from ImageKit QR"""
        try:
            if imagekit_qr:
                imagekit_qr.delete_file(file_id)
                return True
            return False
        except Exception:
            return False
