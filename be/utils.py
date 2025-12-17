from fastapi import Header, HTTPException
import jwt
import requests

def get_user_email_from_token(authorization: str) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization token provided")
    
    token = authorization.replace("Bearer ", "").strip()
    
    # Coba via Google
    try:
        response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {token}'},
            timeout=3
        )
        if response.status_code == 200:
            data = response.json()
            if 'email' in data: return data['email']
    except: pass
    
    raise HTTPException(status_code=401, detail="Invalid Session")
