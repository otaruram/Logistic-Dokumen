import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SCOPES = ['https://www.googleapis.com/auth/drive']

def export_excel_to_drive(file_obj, filename):
    try:
        creds_json = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
        if not creds_json: return None
        
        creds = service_account.Credentials.from_service_account_info(
            json.loads(creds_json), scopes=SCOPES
        )
        service = build('drive', 'v3', credentials=creds)

        file_metadata = {'name': filename, 'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
        media = MediaIoBaseUpload(file_obj, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', resumable=True)

        file = service.files().create(body=file_metadata, media_body=media, fields='id, webViewLink').execute()
        
        # Set Public agar user bisa download
        service.permissions().create(fileId=file.get('id'), body={'type': 'anyone', 'role': 'reader'}).execute()
        return {'web_view_link': file.get('webViewLink')}
    except Exception as e:
        print(f"Upload Error: {e}")
        return None
