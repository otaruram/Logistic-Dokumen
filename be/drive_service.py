"""
Google Drive Service Module - Final Fix (No Refresh Token Logic)
"""
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
        
        # 🔥 FIX: Cukup inisialisasi Credentials dengan token saja.
        # Jangan set refresh_token manual, biar library Google yang atur.
        credentials = Credentials(token=access_token)

        service = build('drive', 'v3', credentials=credentials, cache_discovery=False, static_discovery=False)
        return service
    except Exception as e:
        print(f"❌ GDrive Init Failed: {e}")
        return None

def find_or_create_folder(service, folder_name):
    """Mencoba cari folder, kalau gagal (permission), return None (ke Root)"""
    try:
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        folders = results.get('files', [])
        
        if folders: return folders[0]['id']
        
        file_metadata = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder'}
        folder = service.files().create(body=file_metadata, fields='id').execute()
        return folder.get('id')
    except: 
        # Jika gagal bikin folder (biasanya karena scope token terbatas),
        # Kita return None supaya file tetap ter-upload di halaman utama Drive (Root)
        return None 

def upload_stream_to_drive(service, file_content, file_name, mime_type, folder_id=None):
    try:
        file_metadata = {'name': file_name}
        if folder_id:
            file_metadata['parents'] = [folder_id]
        
        if hasattr(file_content, 'seek'): file_content.seek(0)
            
        media = MediaIoBaseUpload(file_content, mimetype=mime_type, resumable=True)
        
        print(f"🚀 Uploading {file_name} ke GDrive...")
        
        # Request webViewLink agar user bisa buka filenya
        file = service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields='id, webViewLink, webContentLink'
        ).execute()
        
        return {
            'file_id': file.get('id'),
            'web_view_link': file.get('webViewLink'),
            'direct_link': f"https://drive.google.com/uc?export=view&id={file.get('id')}"
        }
    except Exception as e:
        print(f"❌ Upload Stream Error: {e}")
        return None

# --- FUNGSI IMAGE ---
def upload_image_to_drive(access_token, image_path):
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None
        
        folder_id = find_or_create_folder(service, "LOGISTIC_SCANS")
        file_name = os.path.basename(image_path)
        mime_type = 'image/png' if file_name.lower().endswith('.png') else 'image/jpeg'
        
        with open(image_path, 'rb') as f:
            file_content = io.BytesIO(f.read())
            
        return upload_stream_to_drive(service, file_content, file_name, mime_type, folder_id)
    except: return None

# --- FUNGSI EXPORT DATA (EXCEL KE DRIVE) ---
def export_excel_to_drive(access_token, excel_buffer, file_name):
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None
        
        # Simpan di folder laporan
        folder_id = find_or_create_folder(service, "LOGISTIC_REPORTS")
        
        mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        return upload_stream_to_drive(service, excel_buffer, file_name, mime_type, folder_id)
    except Exception as e:
        print(f"❌ Excel Export Error: {e}")
        return None
