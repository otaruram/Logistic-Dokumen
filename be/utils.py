from fastapi import Header, HTTPException
import jwt
import requests
import os

def get_user_email_from_token(authorization: str = Header(None)) -> str:
    """Extract user email from JWT token or Google Access Token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization token provided")
    
    token = authorization.replace("Bearer ", "")
    
    # 1. Coba decode sebagai JWT (Login Lama/Custom)
    try:
        # Ganti "your-secret-key" dengan os.getenv("SECRET_KEY") kalau ada
        decoded = jwt.decode(token, options={"verify_signature": False})
        email = decoded.get("email") or decoded.get("sub")
        if email:
            return email
    except:
        pass

    # 2. Coba validasi sebagai Google Access Token (Login Baru)
    try:
        response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {token}'},
            timeout=5
        )
        if response.status_code == 200:
            user_info = response.json()
            email = user_info.get('email')
            if email:
                return email
    except:
        pass

    raise HTTPException(status_code=401, detail="Invalid token or session expired")