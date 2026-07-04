from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from services.scan_helpers import get_supabase_admin
from utils.auth import get_supabase_bearer_user
from config.settings import settings

router = APIRouter(prefix="/api/kasbon", tags=["Kasbon Admin"])

class AdminAccessRequest(BaseModel):
    phone_number: str

class AdminApproveRequest(BaseModel):
    request_id: str
    action: str  # 'approve' or 'reject'

class AddAuthorizedAdmin(BaseModel):
    email: str

def _get_sb():
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    return sb

# Admin email whitelist for Approval Queue access
ADMIN_WHITELIST = {
    "okitr52@gmail.com",
    settings.ADMIN_EMAIL, 
}

def _is_authorized_admin(sb, email: str) -> bool:
    if email.lower().strip() in {e.lower() for e in ADMIN_WHITELIST if e}:
        return True
    try:
        res = sb.table("authorized_admins").select("id").eq("email", email.lower().strip()).limit(1).execute()
        rows = getattr(res, "data", None) or []
        return len(rows) > 0
    except Exception:
        return False

@router.post("/request-admin-access")
async def request_admin_access(body: AdminAccessRequest, current_user=Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    user_id = str(current_user["id"])
    email = current_user.get("email", "")

    try:
        sb.table("admin_access_requests").insert({
            "user_id": user_id,
            "email": email,
            "phone_number": body.phone_number,
            "status": "pending"
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit request: {e}")

    return {"success": True, "message": "Permintaan akses admin telah dikirim. Menunggu persetujuan."}

@router.get("/admin-access-requests")
async def get_admin_requests(current_user=Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    email = current_user.get("email", "")
    
    if not _is_authorized_admin(sb, email):
        raise HTTPException(status_code=403, detail="Akses ditolak. Anda bukan admin.")

    try:
        res = sb.table("admin_access_requests").select("*").order("requested_at", desc=True).execute()
        return {"success": True, "data": getattr(res, "data", None) or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data requests: {e}")

@router.post("/approve-admin-access")
async def approve_admin_access(body: AdminApproveRequest, current_user=Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    reviewer_email = current_user.get("email", "")

    if not _is_authorized_admin(sb, reviewer_email):
        raise HTTPException(status_code=403, detail="Akses ditolak. Anda bukan admin.")

    try:
        req_res = sb.table("admin_access_requests").select("*").eq("id", body.request_id).limit(1).execute()
        req_rows = getattr(req_res, "data", None) or []
        if not req_rows:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan.")
        req = req_rows[0]

        if req["status"] != "pending":
            raise HTTPException(status_code=400, detail="Request sudah diproses.")

        sb.table("admin_access_requests").update({
            "status": "approved" if body.action == "approve" else "rejected",
            "reviewed_by": reviewer_email,
            "reviewed_at": "now()"
        }).eq("id", body.request_id).execute()

        if body.action == "approve":
            sb.table("authorized_admins").insert({
                "email": req["email"],
                "phone_number": req.get("phone_number"),
                "approved_by": reviewer_email
            }).execute()
            
        return {"success": True, "message": f"Akses admin berhasil di-{body.action}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses request: {e}")

@router.get("/authorized-admins")
async def get_authorized_admins(current_user=Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    if not _is_authorized_admin(sb, current_user.get("email", "")):
        raise HTTPException(status_code=403, detail="Akses ditolak.")
    
    try:
        res = sb.table("authorized_admins").select("*").order("approved_at", desc=True).execute()
        return {"success": True, "data": getattr(res, "data", None) or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil admin list: {e}")

@router.post("/authorized-admins")
async def add_authorized_admin(body: AddAuthorizedAdmin, current_user=Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    if not _is_authorized_admin(sb, current_user.get("email", "")):
        raise HTTPException(status_code=403, detail="Akses ditolak.")
        
    try:
        sb.table("authorized_admins").insert({
            "email": body.email.lower().strip(),
            "approved_by": current_user.get("email")
        }).execute()
        return {"success": True, "message": f"Admin {body.email} berhasil ditambahkan."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menambahkan admin: {e}")

@router.delete("/authorized-admins/{email}")
async def remove_authorized_admin(email: str, current_user=Depends(get_supabase_bearer_user)):
    sb = _get_sb()
    reviewer_email = current_user.get("email", "")
    if not _is_authorized_admin(sb, reviewer_email):
        raise HTTPException(status_code=403, detail="Akses ditolak.")
        
    if email.lower() == reviewer_email.lower():
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akses diri sendiri.")
        
    if email.lower() in {e.lower() for e in ADMIN_WHITELIST if e}:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus System Admin utama.")

    try:
        sb.table("authorized_admins").delete().eq("email", email.lower()).execute()
        return {"success": True, "message": f"Admin {email} berhasil dihapus."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menghapus admin: {e}")
