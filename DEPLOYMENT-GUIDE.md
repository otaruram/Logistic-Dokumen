# 🚀 Deployment Guide - api-ocr.xyz

## VPS Specs
- **IP**: 43.157.227.192
- **Username**: ubuntu
- **Password**: m9jK&#o$tEOJkX%O
- **Specs**: 2 Core CPU, 2GB RAM
- **OS**: Ubuntu (recommended 22.04 LTS)

---

## 📋 Table of Contents
1. [Initial VPS Setup](#1-initial-vps-setup)
2. [Install Dependencies](#2-install-dependencies)
3. [Deploy Backend (FastAPI)](#3-deploy-backend-fastapi)
4. [Configure Nginx](#4-configure-nginx)
5. [Setup SSL Certificate](#5-setup-ssl-certificate)
6. [Deploy Frontend to Vercel](#6-deploy-frontend-to-vercel)
7. [Setup Cron Jobs](#7-setup-cron-jobs)

---

## 1. Initial VPS Setup

### 1.1 Connect to VPS
```bash
ssh ubuntu@43.157.227.192
# Password: m9jK&#o$tEOJkX%O
```

### 1.2 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Create Swap (Optional but recommended for 2GB RAM)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 1.4 Setup Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp  # Temporary for testing
sudo ufw enable
sudo ufw status
```

---

## 2. Install Dependencies

### 2.1 Install Python 3.12
```bash
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3.12-dev python3-pip
```

### 2.2 Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2.3 Install Certbot (for SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2.4 Install Git
```bash
sudo apt install -y git
```

---

## 3. Deploy Backend (FastAPI)

### 3.1 Clone Repository
```bash
cd /var/www
sudo git clone https://github.com/otaruram/Logistic-Dokumen.git api-ocr
sudo chown -R $USER:$USER /var/www/api-ocr
cd /var/www/api-ocr/be
```

### 3.2 Create Virtual Environment
```bash
python3.12 -m venv venv
source venv/bin/activate
```

### 3.3 Install Python Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.4 Create .env File
```bash
nano .env
```

**Paste this content** (update with your real credentials):
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI for DGTNZ
OPENAI_API_KEY=sk-Dt5TIqP0JwDYf9cVOVtChg
BASE_URL=https://ai.sumopod.com/v1

# OpenAI for Quiz
QUIZ_OPENAI_API_KEY=sk-XqL5lIHedRqyA9GV4XL5HQ
QUIZ_BASE_URL=https://ai.sumopod.com/v1

# ImageKit Main
IMAGEKIT_PUBLIC_KEY=public_4h3oc4wci
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/4h3oc4wci

# ImageKit QR
IMAGEKIT_PUBLIC_KEY_QR=public_PnWMb/dJLV6ciEmQDsPZkbRkNVg=
IMAGEKIT_PRIVATE_KEY_QR=your_private_key_qr
IMAGEKIT_URL_ENDPOINT_QR=https://ik.imagekit.io/ocrwtf

# Cleanup Secret (generate random string)
CLEANUP_SECRET=your-random-secret-key-here
```

**Save**: `Ctrl+O` → `Enter` → `Ctrl+X`

### 3.5 Test Backend Locally
```bash
python main.py
```

**Test in browser**: `http://43.157.227.192:8000/api/docs`

If works, press `Ctrl+C` to stop.

### 3.6 Create Systemd Service
```bash
sudo nano /etc/systemd/system/api-ocr.service
```

**Paste this**:
```ini
[Unit]
Description=API OCR Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/api-ocr/be
Environment="PATH=/var/www/api-ocr/be/venv/bin"
ExecStart=/var/www/api-ocr/be/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Save**: `Ctrl+O` → `Enter` → `Ctrl+X`

### 3.7 Start Backend Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable api-ocr
sudo systemctl start api-ocr
sudo systemctl status api-ocr
```

**Check logs**:
```bash
sudo journalctl -u api-ocr -f
```

---

## 4. Configure Nginx

### 4.1 Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/api-ocr.xyz
```

**Paste this**:
```nginx
server {
    listen 80;
    server_name api-ocr.xyz www.api-ocr.xyz;

    # API routes
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout for long requests
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # API Docs
    location /docs {
        proxy_pass http://localhost:8000/docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /redoc {
        proxy_pass http://localhost:8000/redoc;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /openapi.json {
        proxy_pass http://localhost:8000/openapi.json;
        proxy_set_header Host $host;
    }

    # Root redirect
    location / {
        return 200 'API OCR Backend is running. Visit /docs for documentation.';
        add_header Content-Type text/plain;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    client_max_body_size 10M;
}
```

**Save**: `Ctrl+O` → `Enter` → `Ctrl+X`

### 4.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/api-ocr.xyz /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 4.3 Point Domain to VPS

**Go to your domain registrar** (Namecheap, Cloudflare, etc.):

Add these DNS records:
```
Type: A
Name: @
Value: 43.157.227.192
TTL: 3600

Type: A
Name: www
Value: 43.157.227.192
TTL: 3600
```

**Wait 5-30 minutes** for DNS propagation.

**Test DNS**:
```bash
nslookup api-ocr.xyz
ping api-ocr.xyz
```

---

## 5. Setup SSL Certificate

### 5.1 Get SSL Certificate (Let's Encrypt)
```bash
sudo certbot --nginx -d api-ocr.xyz -d www.api-ocr.xyz
```

**Follow prompts**:
- Enter email: `your@email.com`
- Agree to terms: `Y`
- Share email: `N` (optional)
- Redirect HTTP to HTTPS: `2` (Yes, recommended)

### 5.2 Test SSL Auto-Renewal
```bash
sudo certbot renew --dry-run
```

### 5.3 Check Certificate Status
```bash
sudo certbot certificates
```

### 5.4 Test Backend
```bash
# HTTP (should redirect to HTTPS)
curl -I http://api-ocr.xyz

# HTTPS
curl https://api-ocr.xyz/api/docs
```

**Browser test**: `https://api-ocr.xyz/docs` ✅

---

## 6. Deploy Frontend to Vercel

### 6.1 Prepare Frontend
```bash
# On your local machine
cd fe
```

### 6.2 Update Environment Variables
Create `fe/.env.production`:
```env
VITE_API_URL=https://api-ocr.xyz
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 6.3 Push to GitHub
```bash
git add .
git commit -m "Update production API URL"
git push origin main
```

### 6.4 Deploy to Vercel

**Option 1: Via Vercel CLI**
```bash
npm install -g vercel
cd fe
vercel login
vercel --prod
```

**Option 2: Via Vercel Dashboard** (Recommended)
1. Go to https://vercel.com
2. Click **"Add New Project"**
3. Import from GitHub: `otaruram/Logistic-Dokumen`
4. **Root Directory**: `fe`
5. **Framework Preset**: Vite
6. **Build Command**: `npm run build` or `bun run build`
7. **Output Directory**: `dist`
8. **Environment Variables**:
   ```
   VITE_API_URL = https://api-ocr.xyz
   VITE_SUPABASE_URL = your_supabase_url
   VITE_SUPABASE_ANON_KEY = your_anon_key
   ```
9. Click **Deploy**

### 6.5 Get Vercel URL
After deployment, you'll get a URL like:
```
https://your-project.vercel.app
```

---

## 7. Setup Cron Jobs

### 7.1 Use External Cron Service (cron-job.org)

1. Go to **https://console.cron-job.org**
2. Register/Login
3. Create **Daily Credit Reset Job**:
   - URL: `https://api-ocr.xyz/api/cleanup/daily-credit-reset`
   - Method: `POST`
   - Schedule: `0 0 * * *` (Every day at 00:00 UTC)
   - Headers: `Authorization: Bearer your-secret-cleanup-key-here`

4. Create **Weekly Cleanup Job**:
   - URL: `https://api-ocr.xyz/api/cleanup/weekly-cleanup`
   - Method: `POST`
   - Schedule: `0 0 * * 0` (Every Sunday at 00:00 UTC)
   - Headers: `Authorization: Bearer your-secret-cleanup-key-here`

### 7.2 Test Cron Endpoints
```bash
# Test daily credit reset
curl -X POST https://api-ocr.xyz/api/cleanup/daily-credit-reset \
  -H "Authorization: Bearer your-secret-cleanup-key-here"

# Test weekly cleanup
curl -X POST https://api-ocr.xyz/api/cleanup/weekly-cleanup \
  -H "Authorization: Bearer your-secret-cleanup-key-here"
```

---

## 8. Monitoring & Maintenance

### 8.1 Check Backend Status
```bash
sudo systemctl status api-ocr
sudo journalctl -u api-ocr -f
```

### 8.2 Check Nginx Status
```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 8.3 Restart Services
```bash
# Restart backend
sudo systemctl restart api-ocr

# Restart Nginx
sudo systemctl restart nginx
```

### 8.4 Update Backend Code
```bash
cd /var/www/api-ocr
git pull origin main
cd be
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart api-ocr
```

### 8.5 Check Disk Space
```bash
df -h
du -sh /var/www/api-ocr
```

---

## 9. Troubleshooting

### Backend not starting?
```bash
sudo journalctl -u api-ocr -n 50
```

### Nginx errors?
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Port already in use?
```bash
sudo lsof -i :8000
sudo kill -9 <PID>
```

### Permission issues?
```bash
sudo chown -R ubuntu:ubuntu /var/www/api-ocr
sudo chmod -R 755 /var/www/api-ocr
```

### SSL certificate issues?
```bash
sudo certbot certificates
sudo certbot renew --force-renewal
```

---

## 10. Quick Reference

### URLs After Deployment
- **Backend API**: https://api-ocr.xyz
- **API Docs**: https://api-ocr.xyz/docs
- **Frontend**: https://your-project.vercel.app

### Important Commands
```bash
# Check backend status
sudo systemctl status api-ocr

# View logs
sudo journalctl -u api-ocr -f

# Restart backend
sudo systemctl restart api-ocr

# Update code
cd /var/www/api-ocr && git pull && sudo systemctl restart api-ocr
```

---

## ✅ Checklist

- [ ] VPS accessible via SSH
- [ ] Domain DNS pointing to VPS IP
- [ ] Python 3.12 installed
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] `.env` file configured
- [ ] Systemd service running
- [ ] Nginx configured
- [ ] SSL certificate installed
- [ ] Backend accessible via HTTPS
- [ ] Frontend deployed to Vercel
- [ ] Cron jobs configured
- [ ] All endpoints tested

---

## 🎉 Success!

Your application is now live:
- 🌐 Backend: https://api-ocr.xyz
- 📱 Frontend: https://your-project.vercel.app
- 📚 Docs: https://api-ocr.xyz/docs

**Next steps**: Monitor logs and setup daily backups for Supabase data.
