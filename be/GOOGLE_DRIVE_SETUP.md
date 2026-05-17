# Google Drive Integration Setup

## Masalah dengan API Key
API Key saja **tidak cukup** untuk upload file ke Google Drive karena membutuhkan autentikasi user. Ada 2 opsi untuk mengaktifkan fitur ini:

## ✅ Opsi 1: Service Account (Recommended untuk Backend)

### Langkah-langkah:

1. **Buat Service Account di Google Cloud Console**
   - Pergi ke https://console.cloud.google.com/
   - Pilih project Anda
   - Navigasi ke "IAM & Admin" → "Service Accounts"
   - Klik "Create Service Account"
   - Beri nama (contoh: `logistic-drive-uploader`)
   - Klik "Create and Continue"

2. **Download Credentials JSON**
   - Setelah service account dibuat, klik pada email service account
   - Pergi ke tab "Keys"
   - Klik "Add Key" → "Create New Key"
   - Pilih JSON format
   - Download file JSON (contoh: `service-account-key.json`)

3. **Simpan Credentials di Project**
   ```bash
   # Letakkan file di folder be/
   mv service-account-key.json be/google-service-account.json
   ```

4. **Update Environment Variable**
   ```env
   # .env
   GOOGLE_SERVICE_ACCOUNT_FILE=google-service-account.json
   GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
   ```

5. **Buat Folder di Google Drive & Share ke Service Account**
   - Buat folder baru di Google Drive (contoh: "LOGISTIC.AI Reports")
   - Klik kanan folder → Share
   - Masukkan email service account (format: `name@project-id.iam.gserviceaccount.com`)
   - Beri permission "Editor"
   - Copy Folder ID dari URL (contoh: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`)

6. **Update Code `drive_service.py`**
   ```python
   from google.oauth2 import service_account
   
   def get_drive_service():
       SCOPES = ['https://www.googleapis.com/auth/drive.file']
       SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SERVICE_ACCOUNT_FILE')
       
       credentials = service_account.Credentials.from_service_account_file(
           SERVICE_ACCOUNT_FILE, scopes=SCOPES)
       service = build('drive', 'v3', credentials=credentials)
       return service
   ```

---

## Opsi 2: OAuth 2.0 (Untuk User Authentication)

Lebih kompleks karena membutuhkan user login dan token refresh. Tidak recommended untuk backend automation.

---

## Alternatif Sederhana: Disable Google Drive Upload

Jika tidak urgent, Anda bisa:
1. Tetap gunakan export Excel/CSV lokal
2. User download manual dan upload sendiri ke Google Drive
3. Atau gunakan integrasi cloud storage lain (Supabase Storage, AWS S3, dll)

---

## Current Status

Saat ini fitur Google Drive akan mengembalikan pesan informasi bahwa fitur membutuhkan OAuth setup. File tetap bisa di-download dalam format Excel.
