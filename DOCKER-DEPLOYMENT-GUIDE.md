# 🐳 Docker Deployment Guide

## 📋 Prerequisites
- Docker Engine 20.10+ installed
- Docker Compose V2 installed
- Git installed
- VPS with Ubuntu 24.04 (or similar)
- Domain pointed to your VPS (optional but recommended)

---

## 🚀 Quick Start (Local Testing)

### 1. Clone Repository
```bash
git clone https://github.com/otaruram/Logistic-Dokumen.git Logistic-Document
cd Logistic-Document
```

### 2. Create Environment File
```bash
cp .env.example .env
# Edit .env with your actual credentials
nano .env
```

**Required Environment Variables:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-...
JWT_SECRET=your_random_secret_minimum_32_characters
```

### 3. Build and Run
```bash
# Build Docker image
docker compose build

# Start services
docker compose up -d

# Check logs
docker compose logs -f backend
```

### 4. Test API
```bash
curl http://localhost:8000/
# Should return: {"message":"OCR.WTF API","version":"1.0.0"}
```

---

## 🖥️ VPS Production Deployment

### Step 1: Prepare VPS

```bash
# SSH into your VPS
ssh ubuntu@43.157.227.192

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### Step 2: Clone Repository

```bash
cd ~
git clone https://github.com/otaruram/Logistic-Dokumen.git Logistic-Document
cd Logistic-Document
```

### Step 3: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your credentials
nano .env
```

**Production .env Example:**
```env
SUPABASE_URL=https://ytsjdwvxvslfjltobwii.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-proj-...
JWT_SECRET=super_secure_random_string_minimum_32_characters_long_for_production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
API_URL=https://api-ocr.xyz
```

**Generate Secure JWT Secret:**
```bash
openssl rand -hex 32
```

### Step 4: Build and Deploy

```bash
# Build Docker image
docker compose build

# Start in detached mode
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f backend
```

### Step 5: Configure Nginx Reverse Proxy

**If you already have nginx installed:**

```bash
# Edit nginx config
sudo nano /etc/nginx/sites-available/api-ocr.xyz
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name api-ocr.xyz www.api-ocr.xyz;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api-ocr.xyz www.api-ocr.xyz;

    # SSL certificates (use certbot to generate)
    ssl_certificate /etc/letsencrypt/live/api-ocr.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-ocr.xyz/privkey.pem;

    # Proxy to Docker container
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeout for long PDF processing
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Increase max upload size for PDF files
    client_max_body_size 10M;
}
```

**Enable site and reload nginx:**
```bash
sudo ln -s /etc/nginx/sites-available/api-ocr.xyz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d api-ocr.xyz -d www.api-ocr.xyz

# Auto-renewal is configured by default
# Test renewal
sudo certbot renew --dry-run
```

---

## 🔄 Update Deployment

### Pull Latest Code
```bash
cd ~/omni-scan-suite
git pull origin main

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Quick Restart (without rebuild)
```bash
docker compose restart backend
```

---

## 📊 Docker Management Commands

### View Logs
```bash
# All logs
docker compose logs -f

# Only backend
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Check Status
```bash
# Container status
docker compose ps

# Resource usage
docker stats logistic-document-be
```

### Enter Container Shell
```bash
docker exec -it logistic-document-be bash

# Inside container, you can:
# - Check Python version: python --version
# - Test imports: python -c "from pypdf import PdfReader"
# - Check Poppler: pdfinfo -v
```

### Stop Services
```bash
# Stop containers
docker compose down

# Stop and remove volumes
docker compose down -v
```

### Clean Up Docker
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

---

## 🔧 Troubleshooting

### Backend won't start
```bash
# Check logs
docker compose logs backend

# Common issues:
# 1. Port 8000 already in use
sudo lsof -i :8000
sudo kill -9 <PID>

# 2. Environment variables not set
docker exec logistic-document-be env | grep SUPABASE

# 3. Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### PDF conversion fails
```bash
# Enter container
docker exec -it omni-backend bash

# Test Poppler
pdfinfo -v

# Test Tesseract
tesseract --version

# Test Python imports
python -c "from pdf2image import convert_from_path; print('OK')"
```

### Database connection fails
```bash
# Test Supabase connection
docker exec logistic-document-be python -c "
from config.settings import settings
print(f'URL: {settings.SUPABASE_URL}')
print(f'Key: {settings.SUPABASE_KEY[:20]}...')
"
```

### Out of disk space
```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes

# Clean old logs
sudo journalctl --vacuum-time=7d
```

---

## 🎯 Production Best Practices

### 1. Use Docker Secrets (Advanced)
For sensitive data, use Docker secrets instead of .env:
```bash
echo "your_secret" | docker secret create supabase_key -
```

### 2. Setup Monitoring
```bash
# Install ctop (Docker container monitoring)
sudo wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop
sudo chmod +x /usr/local/bin/ctop
ctop
```

### 3. Automated Backups
```bash
# Backup uploads directory
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz be/uploads/

# Upload to S3 or backup server
# ... (implement your backup strategy)
```

### 4. Resource Limits
Edit `docker-compose.yml` to add resource limits:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G
```

### 5. Logging
Configure log rotation in `docker-compose.yml`:
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 🆘 Emergency Recovery

### Rollback to Previous Version
```bash
cd ~/omni-scan-suite
git log --oneline -5  # View last 5 commits
git reset --hard <commit-hash>
docker compose down
docker compose build
docker compose up -d
```

### Complete Reset
```bash
# Stop everything
docker compose down -v

# Remove containers and images
docker rm -f logistic-document-be
docker rmi $(docker images -q logistic-document*)

# Fresh start
git pull origin main
docker compose build --no-cache
docker compose up -d
```

---

## ✅ Verification Checklist

After deployment, verify these work:
- [ ] Backend health check: `curl http://localhost:8000/`
- [ ] HTTPS access: `https://api-ocr.xyz/`
- [ ] Login/Register: Test on frontend
- [ ] PDF compression: Upload and compress a PDF
- [ ] Quiz generation: Generate a quiz
- [ ] Invoice creation: Create an invoice
- [ ] DGTNZ OCR: Scan a document
- [ ] Dashboard: Check stats and weekly usage
- [ ] Reviews: Submit a review

---

## 📞 Support

If you encounter issues:
1. Check logs: `docker compose logs -f backend`
2. Verify environment variables: `docker exec logistic-document-be env`
3. Test database connection: `docker exec logistic-document-be python -c "from config.database import supabase; print(supabase)"`
4. Check GitHub Issues: https://github.com/otaruram/Logistic-Dokumen/issues

---

## 🔄 Next Steps

After Docker is working:
1. **Implement Redis** (optional): See `DOCKER-REDIS-IMPLEMENTATION.md`
2. **Setup CI/CD**: Automate deployments with GitHub Actions
3. **Add Monitoring**: Setup Prometheus + Grafana
4. **Scale Horizontally**: Add load balancer for multiple containers
