# 🚀 OCR.WTF - VPS Deployment Guide

This guide explains how to deploy the **OCR.WTF** application (Frontend + Backend) to a Linux VPS (e.g., Ubuntu 22.04) using Docker.

## prerequisites
- A VPS with Ubuntu 20.04/22.04
- Domain name (e.g., `api.ocr.wtf` for backend, `ocr.wtf` for frontend)
- Git installed
- Docker & Docker Compose installed

---

## 1. Initial Server Setup (Ubuntu)

Run these commands on your VPS:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose (if not included)
sudo apt install docker-compose-plugin

# Verify
docker compose version
```

## 2. Clone Repository

```bash
cd /var/www
sudo mkdir ocr-app
sudo chown $USER:$USER ocr-app
git clone https://github.com/otaruram/Logistic-Dokumen.git ocr-app
cd ocr-app
```

## 3. Configure Environment

Create the `.env` file from the example:

```bash
cp .env.example .env
nano .env
```

**Critical Variables to Set:**
- `SUPABASE_URL`: Your Supabase Project URL
- `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: Service role key is needed for backend admin tasks.
- `OPENAI_API_KEY`: For Quiz generation.
- `API_URL`: The URL where your backend will live (e.g., `https://api.yourdomain.com`).
- `JWT_SECRET`: Generate a strong random string.

## 4. Build and Run

```bash
# Build images
docker compose build

# Start services in background
docker compose up -d
```

Check valid status:
```bash
docker compose ps
docker compose logs -f backend
```

## 5. Nginx Reverse Proxy (Recommended)

To serve your app on a domain with HTTPS, use Nginx.

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

### Backend Config (`/etc/nginx/sites-available/api_ocr`)
```nginx
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Frontend Config (`/etc/nginx/sites-available/ocr_fe`)
*Note: We recommend hosting Frontend on Vercel for easiest deployment. If you must host on VPS:*
1. Build frontend locally or in docker: `npm run build`
2. Serve the `dist` folder.

```nginx
server {
    server_name yourdomain.com;
    root /var/www/ocr-app/fe/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable sites:
```bash
sudo ln -s /etc/nginx/sites-available/api_ocr /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/ocr_fe /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL Certificates (HTTPS)

```bash
sudo certbot --nginx -d api.yourdomain.com -d yourdomain.com
```

## 7. Troubleshooting

- **500 Errors**: Check backend logs `docker compose logs backend`.
- **Database Connection**: Ensure Supabase credentials are correct.
- **Preview Error**: If PDF preview fails, ensure `API_URL` in `.env` matches your actual HTTPS domain, as mixed content (HTTP inside HTTPS) will block requests.

---
**Deployment Complete!** 🚀
