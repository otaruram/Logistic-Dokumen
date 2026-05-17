"""
Config API - Serve frontend configuration
"""
from fastapi import APIRouter
from config.settings import settings

router = APIRouter(prefix="/api/config", tags=["config"])

@router.get("/supabase")
async def get_supabase_config():
    """Get Supabase configuration for frontend"""
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_ANON_KEY
    
    print(f"Config endpoint called - URL: {url}, Key: {key[:20]}..." if key else "Config endpoint called - No key")
    
    if not url or not key:
        return {
            "error": "Supabase configuration not found",
            "url": "",
            "anon_key": ""
        }
    
    return {
        "url": url,
        "anon_key": key
    }
