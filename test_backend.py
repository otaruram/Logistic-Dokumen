"""
Quick test of the enhanced OCR backend
"""
import requests
import io
from PIL import Image
import numpy as np

def test_backend():
    print("🔬 Testing Enhanced OCR Backend...")
    
    # Test basic endpoint
    try:
        response = requests.get("http://localhost:8000/")
        print(f"✅ Root endpoint: {response.json()}")
    except Exception as e:
        print(f"❌ Root endpoint failed: {e}")
        return
    
    # Create a simple test image with text
    img = Image.new('RGB', (400, 200), color='white')
    
    # Save to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes = img_bytes.getvalue()
    
    # Test scan endpoint
    try:
        files = {
            'file': ('test_invoice.png', img_bytes, 'image/png')
        }
        data = {
            'receiver': 'TEST COMPANY'
        }
        headers = {
            'Authorization': 'Bearer test_token'
        }
        
        print("📤 Testing scan endpoint...")
        response = requests.post(
            "http://localhost:8000/scan",
            files=files,
            data=data,
            headers=headers,
            timeout=30
        )
        
        result = response.json()
        print(f"✅ Scan result: {result.get('status')}")
        
        if result.get('status') == 'success':
            data = result.get('data', {})
            print(f"   📝 Summary: {data.get('summary', 'N/A')[:100]}...")
            print(f"   📂 Category: {data.get('kategori', 'N/A')}")
            print(f"   🔢 Doc Number: {data.get('nomorDokumen', 'N/A')}")
            
    except Exception as e:
        print(f"❌ Scan endpoint failed: {e}")
        
    print("\n🎉 Enhanced OCR Backend Test Complete!")

if __name__ == "__main__":
    test_backend()