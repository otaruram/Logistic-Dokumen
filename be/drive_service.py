"""
Google Drive Service Module - Using OAuth Access Token
"""
import os
import io
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2.credentials import Credentials
from dotenv import load_dotenv

load_dotenv()

def get_drive_service_with_token(access_token):
    """Initialize Drive service with user's OAuth access token - NO AUTO REFRESH"""
    print(f"Access token received: {access_token[:20]}...")
    
    # Create credentials
    credentials = Credentials(token=access_token)
    
    # Monkey patch to disable refresh - set refresh method to do nothing
    credentials.refresh = lambda request: None
    credentials.expiry = None
    credentials._refresh_token = None
    credentials._token_uri = None
    credentials._client_id = None
    credentials._client_secret = None
    
    print(f"Credentials configured (refresh disabled)")
    
    # Build service - won't try to refresh since we disabled it
    service = build('drive', 'v3', credentials=credentials, cache_discovery=False, static_discovery=False)
    print(f"Google Drive service initialized successfully")
    return service

def find_folder_by_name(service, folder_name):
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    folders = results.get('files', [])
    if folders:
        print(f"Found folder: {folder_name}")
        return folders[0]['id']
    return None

def create_folder(service, folder_name):
    file_metadata = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder'}
    folder = service.files().create(body=file_metadata, fields='id').execute()
    print(f"Created folder: {folder_name}")
    return folder.get('id')

def find_or_create_folder(service, folder_name):
    folder_id = find_folder_by_name(service, folder_name)
    if not folder_id:
        folder_id = create_folder(service, folder_name)
    return folder_id

def upload_file_to_drive(service, file_content, file_name, mime_type, folder_id=None, convert_to_sheets=False):
    file_metadata = {'name': file_name}
    if folder_id:
        file_metadata['parents'] = [folder_id]
    if convert_to_sheets and mime_type == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        file_metadata['mimeType'] = 'application/vnd.google-apps.spreadsheet'
    
    media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type, resumable=True)
    file = service.files().create(body=file_metadata, media_body=media, fields='id, name, webViewLink, mimeType').execute()
    print(f"File uploaded: {file.get('name')}")
    return {
        'file_id': file.get('id'),
        'file_name': file.get('name'),
        'web_view_link': file.get('webViewLink'),
        'mime_type': file.get('mimeType')
    }

def export_to_google_drive_with_token(access_token, file_content, file_name, convert_to_sheets=True):
    """Export file to Google Drive using user's OAuth token"""
    print("Initializing Google Drive export with user credentials...")
    service = get_drive_service_with_token(access_token)
    folder_name = os.getenv('GOOGLE_DRIVE_FOLDER_NAME', 'LOGISTIC.AI Reports')
    folder_id = find_or_create_folder(service, folder_name)
    mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    result = upload_file_to_drive(service, file_content, file_name, mime_type, folder_id, convert_to_sheets)
    result['folder_name'] = folder_name
    print(f"Export completed!")
    return result

def upload_image_to_drive(access_token, image_path, folder_name):
    """Upload image file to Google Drive and return shareable link"""
    try:
        service = get_drive_service_with_token(access_token)
        folder_id = find_or_create_folder(service, folder_name)
        
        # Read image file
        with open(image_path, 'rb') as f:
            image_content = f.read()
        
        # Get filename and detect mime type
        file_name = os.path.basename(image_path)
        if file_name.lower().endswith('.png'):
            mime_type = 'image/png'
        elif file_name.lower().endswith('.jpg') or file_name.lower().endswith('.jpeg'):
            mime_type = 'image/jpeg'
        else:
            mime_type = 'image/jpeg'
        
        # Upload to Drive
        result = upload_file_to_drive(service, image_content, file_name, mime_type, folder_id, False)
        
        # Make file publicly accessible and get direct link
        file_id = result['file_id']
        service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()
        
        # Generate direct link
        direct_link = f"https://drive.google.com/uc?export=view&id={file_id}"
        result['direct_link'] = direct_link
        
        print(f"Image uploaded: {file_name} -> {direct_link}")
        return result
    except Exception as e:
        print(f"Failed to upload image: {str(e)}")
        return None

