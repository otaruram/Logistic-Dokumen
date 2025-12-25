import requests
import os

# Configuration
API_URL = "http://localhost:8000"
# Login credentials - adjust as necessary or use an existing token if known
EMAIL = "user@example.com" 
PASSWORD = "password"

def test_save_signature():
    # 1. Login to get token
    # Note: If login fails, we might need a valid user. 
    # Attempting to use a hardcoded token if available or assuming local dev env might have one.
    # For now, let's try to simulate the request assuming we can get a token or if auth is disabled (it's not).
    
    # We will try to read the token from a local file if user has one, 
    # BUT easier is to ask the user to run this or just assume strict auth is on.
    
    print("⚠️  This script requires a running backend at http://localhost:8000")
    print("⚠️  Manual testing via frontend is preferred if you don't have python requests installed or valid creds.")
    
    # Simulating the payload
    # This is what the frontend sends:
    payload = {
        "recipient_name": "Test Recipient",
        "signature_url": "https://ik.imagekit.io/ocrwtf/qr-signatures/TEST_SIGNATURE.png"
    }
    
    # Dummy file
    files = {
        'file': ('test.txt', b'dummy content', 'text/plain')
    }
    
    print(f"\n🚀 Sending POST /api/scans/save-with-signature")
    print(f"Payload: {payload}")
    
    # We can't easily authenticate automatically without user creds. 
    # So I will just print what the cURL command would be.
    
    print("\nPlease run this cURL command in your terminal to test:")
    print(f'curl -X POST "{API_URL}/api/scans/save-with-signature" \\')
    print(f'  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \\')
    print(f'  -F "file=@test.txt" \\')
    print(f'  -F "recipient_name=Test Recipient" \\')
    print(f'  -F "signature_url=https://ik.imagekit.io/ocrwtf/qr-signatures/TEST_SIGNATURE.png"')

if __name__ == "__main__":
    test_save_signature()
