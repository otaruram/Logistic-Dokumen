from fastapi import APIRouter, Depends, HTTPException, Body, Request
from fastapi.security.utils import get_authorization_scheme_param
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import random
import string
from utils.auth import get_current_user, supabase

router = APIRouter()

# --- COMING SOON ENDPOINT ---
@router.get("/status")
async def community_status():
    """
    Temporary endpoint for Community feature
    Returns coming soon message
    """
    return {
        "status": "coming_soon",
        "message": "🚀 Fitur Community sedang dalam pengembangan!",
        "description": "Segera hadir: Team collaboration, global posts, dan sharing features",
        "eta": "Q1 2025"
    }

# --- MODEL DATA ---
class PostCreate(BaseModel):
    content: str
    scope: str = "GLOBAL" # 'GLOBAL' atau 'INTERNAL'
    author_name: str
    class Config:
        extra = "ignore"

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    class Config:
        extra = "ignore"

class TeamJoin(BaseModel):
    join_code: str
    class Config:
        extra = "ignore"

# --- HELPER ---
def generate_join_code(prefix="GA"):
    chars = string.ascii_uppercase + string.digits
    random_str = ''.join(random.choice(chars) for _ in range(4))
    return f"{prefix}-{random_str}"

async def get_optional_user(request: Request):
    """
    Mencoba mencari user dari Header ATAU Cookie.
    Tidak akan error 401 jika gagal (return None).
    """
    token = None
    
    # 1. Cek Header Authorization
    auth_header = request.headers.get("Authorization")
    if auth_header:
        scheme, param = get_authorization_scheme_param(auth_header)
        if scheme.lower() == "bearer":
            token = param
        else:
            token = auth_header # Coba ambil mentah

    # 2. Jika Header kosong, Cek Cookies (sb-access-token, dll)
    if not token:
        # Coba cari cookie umum Supabase/Auth
        for cookie_name in ["sb-access-token", "supabase-auth-token", "token"]:
            cookie_token = request.cookies.get(cookie_name)
            if cookie_token:
                token = cookie_token
                print(f"🔍 Token found in Cookie: {cookie_name}")
                break

    # 3. Validasi Token ke Supabase
    if token:
        try:
            user_res = supabase.auth.get_user(token)
            return user_res.user
        except Exception as e:
            print(f"⚠️ Token Validation Failed: {e}")
            return None
            
    return None

# ==========================================
# 1. FITUR POSTING
# ==========================================
@router.post("/posts/create")
async def create_post(post: PostCreate, user = Depends(get_current_user)):
    try:
        team_id = None
        if post.scope == "INTERNAL":
            user_info = supabase.table("users").select("team_id").eq("email", user.email).execute()
            if not user_info.data or not user_info.data[0].get('team_id'):
                raise HTTPException(status_code=400, detail="Anda belum punya tim!")
            team_id = user_info.data[0]['team_id']

        post_data = {
            "content": post.content,
            "scope": post.scope,
            "user_id": str(user.id),
            "author_name": post.author_name,
            "team_id": team_id
        }
        supabase.table("community_posts").insert(post_data).execute()
        
        # Log activity (community posting is FREE)
        from api.tools import log_activity
        user_id_int = int(user.id) if isinstance(user.id, str) else user.id
        await log_activity(user_id_int, "community", "post", {
            "scope": post.scope,
            "content_length": len(post.content)
        })
        
        return {"message": "Berhasil memposting", "data": post_data}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"⚠️ Create Post Error: {e}")
        return {"message": "Post terkirim (Backend)", "data": post_data}

# ==========================================
# 2. FITUR GET POSTS (SMART AUTH)
# ==========================================
@router.get("/posts/{scope}")
async def get_posts(scope: str, request: Request):
    try:
        # Panggil fungsi detektif kita
        user = await get_optional_user(request)

        # DEBUG: Print header biar ketahuan frontend kirim apa
        if not user:
            print(f"🔍 Debug Headers: {request.headers.keys()}")
            
        # Query Dasar
        query = supabase.table("community_posts").select("*").order("created_at", desc=True)
        
        # LOGIKA GLOBAL
        if scope.upper() == "GLOBAL":
            return query.eq("scope", "GLOBAL").execute().data
            
        # LOGIKA INTERNAL
        elif scope.upper() == "INTERNAL":
            if not user:
                print("❌ Internal Post: User tidak terdeteksi (Cek Frontend Headers)")
                
                # DEMO MODE: Hardcode Team ID untuk testing
                # Ganti angka ini dengan ID tim Anda dari Supabase table 'teams'
                DEMO_TEAM_ID = 1  # <-- UBAH SESUAI ID TIM ANDA
                
                print(f"⚠️ DEMO MODE AKTIF: Menampilkan posts Team ID {DEMO_TEAM_ID}")
                return query.eq("scope", "INTERNAL").eq("team_id", DEMO_TEAM_ID).execute().data
                
            # Ambil Team ID
            user_info = supabase.table("users").select("team_id").eq("email", user.email).execute()
            
            if not user_info.data or not user_info.data[0].get('team_id'):
                print(f"❌ User {user.email} tidak punya team_id")
                return []
                
            team_id = user_info.data[0]['team_id']
            print(f"✅ Fetching Internal Posts for Team ID: {team_id}")
            
            return query.eq("scope", "INTERNAL").eq("team_id", team_id).execute().data
        
        return []

    except Exception as e:
        print(f"❌ Get Posts Error: {e}")
        return []

# ==========================================
# 3. FITUR TEAMS
# ==========================================
@router.get("/teams/my-team")
async def get_my_team(user = Depends(get_current_user)):
    try:
        user_data = supabase.table("users").select("team_id").eq("email", user.email).execute()
        if not user_data.data or not user_data.data[0].get('team_id'):
            return None

        team_id = user_data.data[0]['team_id']
        team_data = supabase.table("teams").select("*").eq("id", team_id).execute()
        
        if team_data.data:
            team = team_data.data[0]
            try:
                member_count = supabase.table("users").select("id", count="exact").eq("team_id", team_id).execute()
                team['member_count'] = member_count.count if member_count else 1
            except:
                team['member_count'] = 1
            return team
        return None
    except Exception:
        return None

@router.post("/teams/create")
async def create_team(team: TeamCreate, user = Depends(get_current_user)):
    try:
        join_code = ""
        for _ in range(10):
            join_code = generate_join_code("GA")
            exist = supabase.table("teams").select("id").eq("join_code", join_code).execute()
            if not exist.data:
                break
        
        team_data = {
            "name": team.name,
            "join_code": join_code
        }
        
        res = supabase.table("teams").insert(team_data).execute()
        new_team_id = res.data[0]['id']
        supabase.table("users").update({"team_id": new_team_id}).eq("email", user.email).execute()
        
        return {"message": "Tim dibuat!", "team": res.data[0], "join_code": join_code}
    except Exception as e:
        print(f"❌ Create Team Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/teams/join")
async def join_team(data: TeamJoin, user = Depends(get_current_user)):
    try:
        team_res = supabase.table("teams").select("id, name").eq("join_code", data.join_code).execute()
        if not team_res.data:
            raise HTTPException(status_code=404, detail="Kode salah!")
            
        team_id = team_res.data[0]['id']
        name = team_res.data[0]['name']
        supabase.table("users").update({"team_id": team_id}).eq("email", user.email).execute()
        return {"message": f"Berhasil gabung: {name}", "name": name, "team_id": team_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/teams/leave")
async def leave_team(user = Depends(get_current_user)):
    try:
        supabase.table("users").update({"team_id": None}).eq("email", user.email).execute()
        return {"message": "Berhasil keluar tim"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))