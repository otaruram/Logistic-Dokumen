"""
Test BYOK API Key directly
"""
import requests
import sys

# Get API key from command line
if len(sys.argv) < 2:
    print("Usage: python test_byok.py <your-api-key>")
    sys.exit(1)

api_key = sys.argv[1]

# Test with SumoPoD API
url = "https://ai.sumopod.com/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}
data = {
    "model": "gpt-3.5-turbo",
    "messages": [
        {"role": "user", "content": "Say 'API key is working!'"}
    ]
}

print(f"Testing API key: {api_key[:8]}...{api_key[-4:]}")
print(f"Calling: {url}")

try:
    response = requests.post(url, headers=headers, json=data, timeout=30)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        print("\n✅ API Key is VALID!")
    else:
        print("\n❌ API Key is INVALID or has issues!")
        
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
