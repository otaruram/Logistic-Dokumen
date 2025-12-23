# 🚀 Quick Start Guide - Omni Scan Suite

## Step 1: Run SQL Scripts (Supabase SQL Editor)

### Required (URGENT):
```sql
-- 1. Fix database defaults
-- File: fix_defaults.sql
-- This fixes NOT NULL constraint errors
```

### Optional:
```sql
-- 2. Enable RLS (if not yet enabled)
-- File: enable_rls.sql

-- 3. Update retention policy
-- File: update_retention_policy.sql
```

---

## Step 2: Restart Backend

```bash
cd be

# Stop current server (Ctrl+C)

# Start fresh
python main.py
```

**Expected Output:**
```
✅ ImageKit initialized successfully
✅ Supabase Client berhasil diinisialisasi
✅ Audit OpenAI client initialized successfully
INFO: Uvicorn running on http://127.0.0.1:8000
```

---

## Step 3: Test New Features

### Test 1: Scan History Persistence
```bash
GET http://localhost:8000/api/scans/history
Authorization: Bearer {your_token}

# Should return persistent scan data
```

### Test 2: Upload Signature (Brightness Enhanced)
```bash
POST http://localhost:8000/api/scans/upload-signature
Content-Type: multipart/form-data
file: [signature image]

# Image will be auto-enhanced (brightness +30%, contrast +15%)
```

### Test 3: Generate PPT (Premium Feature)
```bash
POST http://localhost:8000/api/ppt/generate/1
Authorization: Bearer {your_token}

# Response includes viewer_url for Office Online
```

---

## 🎯 New API Endpoints

| Endpoint | Method | Description | Cost |
|----------|--------|-------------|------|
| `/api/scans/history` | GET | Persistent scan history | Free |
| `/api/scans/upload-signature` | POST | Upload signature (enhanced) | Free |
| `/api/ppt/generate/{scan_id}` | POST | Generate PPT from scan | 1 credit |
| `/api/ppt/history` | GET | PPT generation history | Free |

---

## 📝 Frontend TODO

1. **Add PPT.wtf to Features Dropdown**
   - Text: "PPT.wtf 🎯 Premium"
   - Icon: Presentation icon
   - Badge: "Premium"

2. **Add "Generate PPT" Button**
   - Location: Scan detail page
   - Action: Call `/api/ppt/generate/{scan_id}`
   - Show: Loading animation → Open viewer URL

3. **Remove Community Tab**
   - Delete from navigation
   - Remove routes

---

## ✅ All Backend Features Complete!

- [x] Signature brightness enhancement
- [x] Scan history persistence
- [x] Retention policy update (1 month from join)
- [x] UUID serialization fix
- [x] PPT.wtf AI presentation builder

**Ready for frontend integration!** 🚀
