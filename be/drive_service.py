import os
import io
import traceback # Import baru untuk melihat detail error
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2.credentials import Credentials
from dotenv import load_dotenv

load_dotenv()

# Gunakan nama folder dari ENV, atau default
DEFAULT_FOLDER_NAME = os.getenv("GDRIVE_FOLDER_NAME", "ocr.wtf")

def get_drive_service_with_token(access_token):
    try:
        if not access_token:
            print("❌ [DEBUG] Token Kosong! Backend menerima token null/empty.")
            return None
        
        # Cek sekilas format token (biasanya panjang)
        print(f"✅ [DEBUG] Token diterima (Panjang: {len(access_token)} chars). Init Credentials...")
        
        credentials = Credentials(token=access_token)
        service = build('drive', 'v3', credentials=credentials, cache_discovery=False, static_discovery=False)
        return service
    except Exception as e:
        print(f"❌ [DEBUG] Gagal Init Drive Service: {str(e)}")
        print(traceback.format_exc()) # Print error lengkap
        return None

def find_or_create_folder(service, folder_name):
    try:
        # Cari Folder
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        folders = results.get('files', [])
        
        if folders:
            print(f"✅ [DEBUG] Folder '{folder_name}' DITEMUKAN. ID: {folders[0]['id']}")
            return folders[0]['id']
        
        # Buat Folder
        file_metadata = {
            'name': folder_name, 
            'mimeType': 'application/vnd.google-apps.folder'
        }
        folder = service.files().create(body=file_metadata, fields='id').execute()
        print(f"✅ [DEBUG] Folder '{folder_name}' DIBUAT BARU. ID: {folder.get('id')}")
        return folder.get('id')

    except Exception as e:
        print(f"⚠️ [DEBUG] Gagal Akses Folder '{folder_name}'. Error: {str(e)}")
        # Jangan return None, biarkan error lanjut biar ketahuan kalau permission denied
        return None

def upload_stream_to_drive(service, file_content, file_name, mime_type, folder_id=None):
    try:
        file_metadata = {'name': file_name}
        if folder_id:
            file_metadata['parents'] = [folder_id]
        
        if hasattr(file_content, 'seek'): file_content.seek(0)
            
        media = MediaIoBaseUpload(file_content, mimetype=mime_type, resumable=True)
        
        print(f"🚀 [DEBUG] Mulai Upload File: {file_name}...")
        
        file = service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields='id, webViewLink, webContentLink'
        ).execute()
        
        print(f"✅ [DEBUG] Upload SUKSES! File ID: {file.get('id')}")
        
        return {
            'file_id': file.get('id'),
            'web_view_link': file.get('webViewLink'),
            'direct_link': f"https://drive.google.com/uc?export=view&id={file.get('id')}"
        }
    except Exception as e:
        print(f"❌ [DEBUG] ERROR FATAL SAAT UPLOAD: {str(e)}")
        print(traceback.format_exc()) # Print error lengkap
        return None

def upload_image_to_drive(access_token, image_path):
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None
        
        folder_id = find_or_create_folder(service, DEFAULT_FOLDER_NAME)
        
        file_name = os.path.basename(image_path)
        mime_type = 'image/png' if file_name.lower().endswith('.png') else 'image/jpeg'
        
        with open(image_path, 'rb') as f:
            file_content = io.BytesIO(f.read())
            
        return upload_stream_to_drive(service, file_content, file_name, mime_type, folder_id)
    except Exception as e:
        print(f"❌ [DEBUG] Wrapper Error: {e}")
        return None

def export_excel_to_drive(access_token, excel_buffer, file_name):
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None
        
        folder_id = find_or_create_folder(service, DEFAULT_FOLDER_NAME)
        mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        return upload_stream_to_drive(service, excel_buffer, file_name, mime_type, folder_id)
    except Exception as e:
        print(f"❌ [DEBUG] Excel Error: {e}")
        return None
