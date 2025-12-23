"""
Authentication and authorization utilities
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from supabase import create_client, Client

from config.settings import settings
from config.database import get_db
from models.models import User

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for JWT
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# HTTP Bearer for Supabase tokens
http_bearer = HTTPBearer(auto_error=False)

# Supabase client for authentication (uses ANON key)
if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
    print("❌ CRITICAL: Supabase Credential belum terbaca oleh Python!")
    print("   Pastikan file .env ada dan variabel SUPABASE_URL/SUPABASE_ANON_KEY tersedia.")
    supabase = None
else:
    try:
        supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        print("✅ Supabase Client berhasil diinisialisasi")
    except Exception as e:
        print(f"❌ Gagal inisialisasi Supabase Client: {e}")
        supabase = None

# Supabase admin client for backend operations (uses SERVICE_ROLE key - bypasses RLS)
if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
    print("⚠️ WARNING: SERVICE_ROLE_KEY not found - using ANON key (RLS will apply)")
    supabase_admin = supabase
else:
    try:
        supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Supabase Admin Client (SERVICE_ROLE) berhasil diinisialisasi")
    except Exception as e:
        print(f"❌ Gagal inisialisasi Supabase Admin Client: {e}")
        supabase_admin = supabase

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    
    return encoded_jwt

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user - supports both JWT and Supabase tokens"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check if Supabase is available
    if not supabase:
        raise HTTPException(
            status_code=500, 
            detail="Server Error: Supabase connection not configured"
        )
    
    # Try Supabase token first (from Authorization header)
    if credentials:
        try:
            supabase_token = credentials.credentials
            user_response = supabase.auth.get_user(supabase_token)
            
            if user_response.user:
                # Get or create user in local DB
                email = user_response.user.email
                user = db.query(User).filter(User.email == email).first()
                
                if not user:
                    # Create user if doesn't exist
                    user = User(
                        email=email,
                        username=email.split('@')[0],
                        hashed_password="",  # No password for OAuth users
                        credits=10,  # Initial 10 credits (daily reset)
                        is_active=True
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                
                return user
        except Exception as e:
            print(f"⚠️ Supabase auth failed: {str(e)}")
            print(f"   Debug Info -> URL: {settings.SUPABASE_URL}, Key: {settings.SUPABASE_ANON_KEY[:5]}...")
            # Continue to fallback JWT instead of raising immediately
    
    # Fallback to JWT token
    if token:
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            user_id: int = payload.get("sub")
            
            if user_id is None:
                raise credentials_exception
                
            user = db.query(User).filter(User.id == user_id).first()
            
            if user is None:
                raise credentials_exception
            
            return user
        except JWTError:
            pass
    
    raise credentials_exception

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    return current_user
