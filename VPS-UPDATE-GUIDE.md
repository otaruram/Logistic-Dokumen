# 🚀 VPS Update Guide - Deploy Latest Changes

## 📋 Pre-Deployment Checklist
- [x] Code pushed to GitHub (commit: 7d507e7)
- [ ] Supabase reviews table fixed (run SQL below)
- [ ] VPS backend updated
- [ ] VPS backend restarted

---

## 1️⃣ Fix Supabase Reviews Table (CRITICAL)

### Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)

### Run This SQL:
```sql
-- Fix reviews table permissions (UUID type cast fixed)

-- 1. Drop ALL existing policies first
DROP POLICY IF EXISTS "Users can insert their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can view all reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON reviews;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON reviews;
DROP POLICY IF EXISTS "Enable read access for all users" ON reviews;

-- 2. Disable RLS temporarily
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;

-- 3. Grant full access to authenticated and service role
GRANT ALL ON reviews TO authenticated;
GRANT ALL ON reviews TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Re-enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 5. Create new policies with proper UUID casting
CREATE POLICY "Users can insert their own reviews" ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view all reviews" ON reviews
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own reviews" ON reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- 6. Verify policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'reviews';
```

### Expected Result:
- Should show **4 policies** for reviews table
- No errors
- Status: Success ✅

---

## 2️⃣ Connect to VPS

### Using PowerShell:
```powershell
ssh ubuntu@43.157.227.192
# Password: m9jK&#o$tEOJkX%O
```

---

## 3️⃣ Update Backend Code on VPS

### Find Backend Directory:
```bash
# Check where the project is located
ls -la ~
# OR
find ~ -name "main.py" -type f 2>/dev/null | grep -v "__pycache__"
```

### Common Locations (try these):
```bash
# Option 1: Root of home directory
cd ~/omni-scan-suite-main/be

# Option 2: Inside app folder
cd ~/app/be

# Option 3: Inside backend folder
cd ~/backend

# Option 4: Find it automatically
cd $(find ~ -name "main.py" -type f 2>/dev/null | grep -v "__pycache__" | head -1 | xargs dirname)
```

### Pull Latest Code from GitHub:
```bash
# Once you're in the correct directory, pull updates
git pull origin main

# If not a git repo, clone fresh:
# cd ~
# rm -rf omni-scan-suite-main
# git clone https://github.com/otaruram/Logistic-Dokumen.git omni-scan-suite-main
# cd omni-scan-suite-main/be
```

### Expected Output:
```
Updating 73261d1..7d507e7
Fast-forward
 api/tools.py                               | 200 +-------------------
 requirements.txt                            |  58 +++---
 supabase-fix-reviews-permissions.sql       |  53 ++++++
 ...
```

---

## 4️⃣ Update Python Dependencies

### Check if Virtual Environment Exists:
```bash
# Look for venv folder
ls -la | grep venv

# If venv exists, activate it:
source venv/bin/activate

# If venv doesn't exist, create one:
python3 -m venv venv
source venv/bin/activate
```

### Update Requirements:
```bash
pip install -r requirements.txt --upgrade
```

### Removed Libraries (will be uninstalled automatically):
- ❌ qrcode (QR feature removed)
- ❌ imagekitio (QR feature removed)
- ❌ google-api-python-client (not used)
- ❌ google-auth* (not used)
- ❌ apscheduler (not used)
- ❌ pytz (not used)
- ❌ fpdf2 (not used)
- ❌ openpyxl (not used)
- ❌ XlsxWriter (not used)

### Required Libraries (should remain):
- ✅ fastapi, uvicorn (core framework)
- ✅ supabase (database)
- ✅ pypdf, pdf2image, reportlab, pikepdf (PDF tools)
- ✅ pytesseract, openai (OCR & AI)
- ✅ num2words, python-slugify (Indonesian utils)
- ✅ pillow, numpy, pandas (data processing)

---

## 5️⃣ Restart Backend Service

### Stop Current Process:
```bash
sudo systemctl stop omni-backend
# OR if using PM2:
pm2 stop omni-backend
```

### Start Backend:
```bash
sudo systemctl start omni-backend
# OR if using PM2:
pm2 start omni-backend
pm2 save
```

### Check Status:
```bash
sudo systemctl status omni-backend
# OR
pm2 status
pm2 logs omni-backend --lines 50
```

### Expected Output:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 6️⃣ Test Backend API

### Health Check:
```bash
curl http://localhost:8000/
```

### Expected Response:
```json
{"message": "OCR API is running"}
```

### Test PDF Endpoint:
```bash
curl http://localhost:8000/api/tools/compress-pdf
```

### Test Reviews Endpoint (should NOT return 42501 error):
```bash
curl -X POST http://localhost:8000/api/reviews/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"rating":5,"review_text":"Test"}'
```

---

## 7️⃣ Verify Changes on Production

### Test on Frontend:
1. Open: https://logistic-dokumen.vercel.app
2. Login with your account
3. **Test Reviews**: Go to Profile → Submit review (should work now!)
4. **Test Quiz PDF**: Complete a quiz → Click "Download PDF Report"
5. **Test PDF Tools**: Go to pdf.wtf → Try compress/merge/split
6. **Check Dashboard**: Total activities should only count main 4 features

---

## 🔍 Troubleshooting

### If Backend Won't Start:
```bash
# Check if port 8000 is in use
sudo lsof -i :8000

# Kill existing process
sudo kill -9 $(sudo lsof -t -i:8000)

# Check logs
sudo journalctl -u omni-backend -n 100 -f
# OR
pm2 logs omni-backend
```

### If Reviews Still Error 42501:
- ✅ Verify Supabase SQL was executed successfully
- ✅ Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'reviews';`
- ✅ Restart backend after SQL fix

### If PDF Tools Fail:
```bash
# Check if Poppler is installed
pdfinfo -v

# If not, install:
sudo apt update
sudo apt install -y poppler-utils
```

---

## 📦 What's New in This Update?

### ✅ Features Removed:
- QR Code Generator (qr.wtf) - completely removed from frontend & backend

### ✅ Features Added:
- Quiz PDF Download - export quiz results as PDF report
- Improved activity tracking - only counts main 4 features

### ✅ Fixes:
- Reviews permission error (42501) - UUID type casting fixed
- Credits updated to 10 (from 5)
- Weekly usage stats now filters only main features
- Smart Filename back button text corrected
- Requirements.txt cleaned up (removed 9 unused libraries)

### ✅ Backend Optimizations:
- Removed QR endpoints: `/generate-qr`, `/generate-qr-from-image`
- Activity filtering: only dgtnz, invoice, pdf, quiz counted
- Code cleanup: 200 lines removed from tools.py

---

## ✅ Post-Deployment Verification

After deployment, verify these work:

- [ ] Login/Register works
- [ ] Dashboard shows correct activity count
- [ ] Weekly chart displays data
- [ ] PDF compress/merge/split/unlock/watermark/to-images all work
- [ ] Invoice creation works
- [ ] Quiz generation & play works
- [ ] Quiz PDF download works
- [ ] **Reviews submission works (NO 42501 error)**
- [ ] Credits show 10/10 for new users
- [ ] DGTNZ OCR scan works

---

## 📝 Notes

- **VPS IP**: 43.157.227.192
- **Backend URL**: https://api-ocr.xyz
- **Frontend URL**: https://logistic-dokumen.vercel.app
- **Supabase**: Already configured, just need to run SQL fix
- **Poppler**: Should already be installed on VPS

---

## 🆘 Need Help?

If deployment fails, check:
1. Git pull output - any conflicts?
2. pip install output - any errors?
3. Backend logs - any startup errors?
4. Supabase SQL - did all statements execute?

**Contact**: Check backend logs with `pm2 logs` or `sudo journalctl -u omni-backend -n 100`
