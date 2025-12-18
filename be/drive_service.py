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
    try:
        if not access_token: return None
        # Matikan auto-refresh token karena token dari FE itu short-lived
        credentials = Credentials(token=access_token)
        credentials.refresh_token = None
        credentials.token_uri = None
        credentials.client_id = None
        credentials.client_secret = None
        credentials.expiry = None

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
    except: return None

def create_folder(service, folder_name):
    try:
        file_metadata = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder'}
        folder = service.files().create(body=file_metadata, fields='id').execute()
        return folder.get('id')
    except: return None

def find_or_create_folder(service, folder_name):
    folder_id = find_folder_by_name(service, folder_name)
    if not folder_id: folder_id = create_folder(service, folder_name)
    return folder_id

def upload_stream_to_drive(service, file_content, file_name, mime_type, folder_id=None):
    """Upload Helper untuk File Stream (Gambar/Excel)"""
    try:
        file_metadata = {'name': file_name}
        if folder_id: file_metadata['parents'] = [folder_id]
        
        # Reset pointer stream
        if hasattr(file_content, 'seek'): file_content.seek(0)
            
        media = MediaIoBaseUpload(file_content, mimetype=mime_type, resumable=True)
        
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
        print(f"❌ Stream Upload Error: {e}")
        return None

# --- FUNGSI UTAMA 1: UPLOAD GAMBAR (Dipakai saat Scan) ---
def upload_image_to_drive(access_token, image_path, folder_name="LOGISTIC_SCANS"):
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None
        
        folder_id = find_or_create_folder(service, folder_name)
        
        file_name = os.path.basename(image_path)
        mime_type = 'image/png' if file_name.lower().endswith('.png') else 'image/jpeg'
        
        # Buka file sebagai binary stream
        with open(image_path, 'rb') as f:
            file_content = io.BytesIO(f.read())
            
        return upload_stream_to_drive(service, file_content, file_name, mime_type, folder_id)
    except Exception as e:
        print(f"❌ Image Upload Error: {e}")
        return None

# --- FUNGSI UTAMA 2: EXPORT EXCEL (Dipakai saat Export) ---
def export_excel_to_drive(access_token, excel_buffer, file_name="Report.xlsx"):
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None
        
        folder_name = "LOGISTIC_REPORTS"
        folder_id = find_or_create_folder(service, folder_name)
        
        mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        return upload_stream_to_drive(service, excel_buffer, file_name, mime_type, folder_id)
    except Exception as e:
        print(f"❌ Excel Export Error: {e}")
        return None
