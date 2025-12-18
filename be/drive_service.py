"""
Google Drive Service Module - Stabilized for Frontend Tokens
"""
import os
import io
import logging
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2.credentials import Credentials
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

def get_drive_service_with_token(access_token):
    """Initialize Drive service with OAuth token (No Refresh logic enforced)"""
    try:
        if not access_token:
            print("❌ GDrive Error: Token kosong.")
            return None

        # 🔥 KONFIGURASI PENTING: Matikan auto-refresh token
        # Token dari frontend (React) adalah 'short-lived', backend tidak boleh me-refreshnya.
        credentials = Credentials(token=access_token)
        credentials.refresh_token = None # Tidak ada refresh token
        credentials.token_uri = None     # Tidak perlu URL token
        credentials.client_id = None
        credentials.client_secret = None
        credentials.expiry = None        # Anggap valid terus selama proses ini

        service = build('drive', 'v3', credentials=credentials, cache_discovery=False, static_discovery=False)
        return service
    except Exception as e:
        print(f"❌ GDrive Init Failed: {e}")
        return None

def find_folder_by_name(service, folder_name):
    try:
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        folders = results.get('files', [])
        return folders[0]['id'] if folders else None
    except Exception as e:
        # Jangan print error mencolok jika folder belum ada, cukup return None
        return None

def create_folder(service, folder_name):
    try:
        file_metadata = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder'}
        folder = service.files().create(body=file_metadata, fields='id').execute()
        print(f"📂 Folder GDrive Dibuat: {folder_name}")
        return folder.get('id')
    except Exception as e:
        print(f"⚠️ Gagal buat folder: {e}")
        return None

def find_or_create_folder(service, folder_name):
    folder_id = find_folder_by_name(service, folder_name)
    if not folder_id:
        folder_id = create_folder(service, folder_name)
    return folder_id

def upload_image_to_drive(access_token, image_path, folder_name="LOGISTIC_SCANS"):
    """
    Fungsi Utama: Upload gambar ke Drive.
    Return: Dict berisi link, atau None jika gagal.
    """
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None

        # Cek folder
        folder_id = find_or_create_folder(service, folder_name)

        file_name = os.path.basename(image_path)
        # Deteksi MIME Type sederhana
        mime_type = 'image/png' if file_name.lower().endswith('.png') else 'image/jpeg'

        file_metadata = {'name': file_name}
        if folder_id:
            file_metadata['parents'] = [folder_id]

        media = MediaIoBaseUpload(open(image_path, 'rb'), mimetype=mime_type, resumable=True)

        print(f"🚀 Mengupload {file_name} ke GDrive...")
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink, webContentLink'
        ).execute()

        file_id = file.get('id')
        # Link untuk melihat file (WebView)
        web_view_link = file.get('webViewLink')
        
        # Link Direct (Kadang diblokir Google jika traffic tinggi, tapi layak dicoba)
        direct_link = f"https://drive.google.com/uc?export=view&id={file_id}"

        print(f"✅ Upload GDrive Sukses! ID: {file_id}")
        
        return {
            'file_id': file_id,
            'web_view_link': web_view_link,
            'direct_link': direct_link
        }

    except Exception as e:
        # Tangkap error spesifik agar tidak crash server
        print(f"❌ GDrive Upload Error: {e}")
        return None
