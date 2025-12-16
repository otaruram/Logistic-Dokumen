"""
Google Drive Service Module - Enhanced Error Handling & Fixes
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
    """Initialize Drive service with OAuth token (No Refresh)"""
    try:
        if not access_token:
            print("❌ Error: No access token provided")
            return None

        # Create credentials wrapper
        credentials = Credentials(token=access_token)
        
        # Monkey patch: Matikan refresh otomatis karena kita cuma punya access token dari FE
        credentials.refresh = lambda request: None 
        credentials.expiry = None

        service = build('drive', 'v3', credentials=credentials, cache_discovery=False, static_discovery=False)
        return service
    except Exception as e:
        print(f"❌ Failed to init Drive service: {e}")
        return None

def find_folder_by_name(service, folder_name):
    try:
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        folders = results.get('files', [])
        return folders[0]['id'] if folders else None
    except Exception as e:
        print(f"⚠️ Error finding folder: {e}")
        return None

def create_folder(service, folder_name):
    try:
        file_metadata = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder'}
        folder = service.files().create(body=file_metadata, fields='id').execute()
        return folder.get('id')
    except Exception as e:
        raise e

def find_or_create_folder(service, folder_name):
    folder_id = find_folder_by_name(service, folder_name)
    if not folder_id:
        folder_id = create_folder(service, folder_name)
    return folder_id

def upload_file_to_drive(service, file_content, file_name, mime_type, folder_id=None, convert_to_sheets=False):
    try:
        file_metadata = {'name': file_name}
        if folder_id:
            file_metadata['parents'] = [folder_id]
        
        if convert_to_sheets and 'spreadsheet' in mime_type:
            file_metadata['mimeType'] = 'application/vnd.google-apps.spreadsheet'

        # FIX: Reset pointer file ke awal (PENTING biar file gak 0 byte)
        if hasattr(file_content, 'seek'):
            file_content.seek(0)
            
        media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type, resumable=True)
        
        file = service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields='id, name, webViewLink'
        ).execute()
        
        return {
            'file_id': file.get('id'),
            'web_view_link': file.get('webViewLink'),
            # Buat direct link untuk image tag
            'direct_link': f"https://drive.google.com/uc?export=view&id={file.get('id')}"
        }
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        return None

def upload_image_to_drive(access_token, image_path, folder_name="LOGISTIC_SCANS"):
    """Upload gambar fisik ke Drive dan return direct link"""
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return None

        folder_id = find_or_create_folder(service, folder_name)

        # Baca file dari disk
        with open(image_path, 'rb') as f:
            image_content = f.read()

        file_name = os.path.basename(image_path)
        mime_type = 'image/png' if file_name.lower().endswith('.png') else 'image/jpeg'

        result = upload_file_to_drive(service, image_content, file_name, mime_type, folder_id, False)
        
        if result:
            print(f"✅ Image uploaded to Drive: {file_name}")
            return result
        return None

    except Exception as e:
        print(f"❌ Image Upload Error: {e}")
        return None

def export_to_google_drive_with_token(access_token, file_content, file_name, convert_to_sheets=True):
    """Export Excel Report"""
    try:
        service = get_drive_service_with_token(access_token)
        if not service: return {"status": "error", "message": "Invalid Token"}

        folder_name = os.getenv('GOOGLE_DRIVE_FOLDER_NAME', 'LOGISTIC.AI Reports')
        folder_id = find_or_create_folder(service, folder_name)
        
        mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        result = upload_file_to_drive(service, file_content, file_name, mime_type, folder_id, convert_to_sheets)
        
        if result:
            result['folder_name'] = folder_name
            return result
        return {"status": "error", "message": "Upload failed"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
