import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# Scopes agar bot bisa upload file
SCOPES = ['https://www.googleapis.com/auth/drive']

def get_drive_service():
    try:
        # Ambil Kredensial dari Environment Variable
        creds_json = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
        if not creds_json:
            print("❌ Error: GOOGLE_SERVICE_ACCOUNT_JSON belum disetting di Render.")
            return None

        creds_dict = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_dict, scopes=SCOPES
        )
        return build('drive', 'v3', credentials=creds)
    except Exception as e:
        print(f"❌ Drive Auth Error: {str(e)}")
        return None

def export_excel_to_drive(file_obj, filename):
    service = get_drive_service()
    if not service: return None

    try:
        file_metadata = {
            'name': filename,
            'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        
        # Upload Stream (tanpa simpan ke disk server)
        media = MediaIoBaseUpload(file_obj, 
                                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                resumable=True)

        # Eksekusi Upload
        file = service.files().create(body=file_metadata, media_body=media, fields='id, webViewLink').execute()
        
        # SET PERMISSION: PUBLIC READER
        # Agar user yang klik link bisa langsung lihat/download
        try:
            service.permissions().create(
                fileId=file.get('id'),
                body={'type': 'anyone', 'role': 'reader'}
            ).execute()
        except: pass

        print(f"✅ Upload Sukses: {file.get('webViewLink')}")
        return {'file_id': file.get('id'), 'web_view_link': file.get('webViewLink')}

    except Exception as e:
        print(f"❌ Upload Gagal: {str(e)}")
        return None
