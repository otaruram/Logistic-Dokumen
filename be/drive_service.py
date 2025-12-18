import os
import io
import logging
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2.credentials import Credentials
from dotenv import load_dotenv

load_dotenv()

def get_drive_service_with_token(access_token):
    try:
        if not access_token: return None
        
        # 🔥 FIX ERROR "refresh_token has no setter":
        # Cukup inisialisasi Credentials dengan token. Jangan ubah propertinya manual.
        credentials = Credentials(token=access_token)

        service = build('drive', 'v3', credentials=credentials, cache_discovery=False, static_discovery=False)
        return service
    except Exception as e:
        print(f"❌ GDrive Init Failed: {e}")
        return None

def find_or_create_folder(service, folder_name):
    try:
        # 1. Coba Cari Folder
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        folders = results.get('files', [])
        
        if folders: return folders[0]['id']
        
        # 2. Jika Tidak Ada, Buat Folder Baru
        file_metadata = {
            'name': folder_name, 
            'mimeType': 'application/vnd.google-apps.folder'
        }
        folder = service.files().create(body=file_metadata, fields='id').execute()
        return folder.get('id')

    except Exception as e:
        print(f"⚠️ Gagal akses folder '{folder_name}' (Akan upload ke Root): {e}")
        return None # Fallback: Upload ke Root folder (My Drive)

def upload_stream_to_drive(service, file_content, file_name, mime_type, folder_id=None):
    try:
        file_metadata = {'name': file_name}
        if folder_id:
            file_metadata['parents'] = [folder_id]
        
        # Reset pointer file (Penting agar tidak upload file kosong)
        if hasattr(file_content, 'seek'):
            file_content.seek(0)
            
        media = MediaIoBaseUpload(file_content, mimetype=mime_type, resumable=True)
        
        # 🔥 Minta field 'webViewLink' & 'webContentLink'
        file = service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields='id, webViewLink, webContentLink'
        ).execute()
        
        return {
            'file_id': file.get('id'),
            'web_view_link': file.get('webViewLink'),
            # Link khusus untuk display image (Direct Link Hack)
            'direct_link': f"https://drive.google.com/uc?export=view&id={file.get('id')}"
        }
    except Exception as e:
        print(f"❌ Upload Gagal: {e}")
        return None

# --- FUNGSI UTAMA YANG DIPANGGIL MAIN.PY ---
def upload_image_to_drive(access_token, image_path):
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None
        
        # Coba masukin ke folder "LOGISTIC_SCANS"
        folder_id = find_or_create_folder(service, "LOGISTIC_SCANS")
        
        file_name = os.path.basename(image_path)
        mime_type = 'image/png' if file_name.lower().endswith('.png') else 'image/jpeg'
        
        # Buka file lokal untuk di-stream ke Drive
        with open(image_path, 'rb') as f:
            file_content = io.BytesIO(f.read())
            
        return upload_stream_to_drive(service, file_content, file_name, mime_type, folder_id)
    except Exception as e:
        print(f"❌ Image Upload Error: {e}")
        return None

def export_excel_to_drive(access_token, excel_buffer, file_name):
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None
        
        folder_id = find_or_create_folder(service, "LOGISTIC_REPORTS")
        mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        return upload_stream_to_drive(service, excel_buffer, file_name, mime_type, folder_id)
    except Exception as e:
        print(f"❌ Excel Export Error: {e}")
        return None
