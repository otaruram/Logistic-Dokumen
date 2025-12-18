from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions
import os
from dotenv import load_dotenv

load_dotenv()

# Inisialisasi ImageKit
imagekit = ImageKit(
    private_key=os.getenv('IMAGEKIT_PRIVATE_KEY'),
    public_key=os.getenv('IMAGEKIT_PUBLIC_KEY'),
    url_endpoint=os.getenv('IMAGEKIT_URL_ENDPOINT')
)

def upload_to_imagekit(file_path, file_name):
    """
    Upload gambar ke ImageKit.io
    Return: URL Public (Permanent Link)
    """
    try:
        print(f"🚀 Uploading ke ImageKit: {file_name}...")
        
        with open(file_path, mode="rb") as img:
            upload = imagekit.upload_file(
                file=img,
                file_name=file_name,
                options=UploadFileRequestOptions(
                    folder="/ocr_scans/", # Folder di dalam ImageKit
                    use_unique_file_name=True
                )
            )
        
        # Ambil URL hasil upload
        url = upload.url
        print(f"✅ ImageKit Success: {url}")
        return url

    except Exception as e:
        print(f"❌ ImageKit Upload Error: {str(e)}")
        return None
