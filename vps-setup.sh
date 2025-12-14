#!/bin/bash
# Complete VPS Setup Script for api-ocr.xyz
# Run this on fresh Ubuntu 22.04 VPS
# 
# HOW TO USE FROM WINDOWS CMD/POWERSHELL:
# 1. Upload script to VPS (jalankan dari folder Supply-Chain):
#    scp "c:\Users\asus\Pictures\Supply-Chain\vps-setup.sh" ubuntu@api-ocr.xyz:/tmp/
#    scp "c:\Users\asus\Pictures\Supply-Chain\be\.env.production" ubuntu@api-ocr.xyz:/tmp/.env
#
# 2. SSH to Ubuntu VPS:
#    ssh ubuntu@api-ocr.xyz
#
# 3. Run setup script in Ubuntu:
#    chmod +x /tmp/vps-setup.sh
#    sudo /tmp/vps-setup.sh
#
# NOTE: Everything is automated - no manual steps needed!
#
set -euo pipefail  # Exit on any error, undefined vars, pipe failures
IFS=$'\n\t'       # Secure Internal Field Separator

echo "=== Starting Fresh VPS Setup for api-ocr.xyz ==="

# Update system
export DEBIAN_FRONTEND=noninteractive
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y nginx certbot python3-certbot-nginx git curl wget ufw python3-pip python3-venv build-essential

# Configure firewall
echo "=== Configuring Firewall ==="
sudo ufw --force reset
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 8000/tcp
sudo ufw --force enable
sudo ufw status

# Install Node.js (for any frontend needs)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create project directory
echo "=== Setting up Project Directory ==="
if [ -d "/home/ubuntu/Logistic-Dokumen" ]; then
    echo "Directory exists, backing up..."
    sudo mv /home/ubuntu/Logistic-Dokumen /home/ubuntu/Logistic-Dokumen.backup.$(date +%s)
fi
mkdir -p /home/ubuntu/Logistic-Dokumen
cd /home/ubuntu/Logistic-Dokumen

# Clone repository
echo "=== Cloning Repository ==="
git clone https://github.com/otaruram/Logistic-Dokumen.git .

# Fix ownership immediately
echo "=== Fixing Ownership ==="
sudo chown -R ubuntu:ubuntu /home/ubuntu/Logistic-Dokumen
chmod -R 755 /home/ubuntu/Logistic-Dokumen

# Setup Python environment for backend
echo "=== Setting up Python Environment ==="
cd /home/ubuntu/Logistic-Dokumen/be

# Copy .env file first
echo "=== Copying Environment File ==="
if [ -f /tmp/.env ]; then
    cp /tmp/.env .env
    echo "✅ .env file copied successfully"
else
    echo "⚠️  Warning: .env file not found in /tmp/"
fi

# Create virtual environment
echo "=== Creating Virtual Environment ==="
if [ -d "venv" ]; then
    echo "Virtual environment exists, removing old one..."
    rm -rf venv
fi

python3 -m venv venv
if [ ! -f "venv/bin/activate" ]; then
    echo "❌ Failed to create virtual environment"
    exit 1
fi

echo "✅ Virtual environment created successfully"
source venv/bin/activate
echo "✅ Virtual environment activated"

# Install requirements with error handling
echo "=== Installing Python Requirements ==="
pip install --upgrade pip setuptools wheel

if [ -f requirements.txt ]; then
    echo "Installing from requirements.txt..."
    pip install -r requirements.txt
    echo "✅ Requirements installed successfully"
else
    echo "requirements.txt not found, installing basic dependencies..."
    pip install fastapi uvicorn python-multipart python-dotenv requests aiofiles jinja2
    echo "✅ Basic dependencies installed"
fi

# Verify critical packages are installed
echo "=== Verifying Package Installation ==="
python3 -c "
try:
    import fastapi, uvicorn
    print('✅ FastAPI and Uvicorn installed successfully')
except ImportError as e:
    print(f'❌ Missing packages: {e}')
    print('Installing critical packages...')
    import subprocess
    subprocess.run(['pip', 'install', 'fastapi', 'uvicorn', 'python-multipart', 'python-dotenv'])
"

# Test if app runs locally
echo "=== Testing FastAPI Import ==="
cd /home/ubuntu/Logistic-Dokumen/be

# Activate virtual environment with check
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated for testing"
    
    # Verify FastAPI is available
    if ! python3 -c "import fastapi" 2>/dev/null; then
        echo "⚠️  FastAPI not found, installing..."
        pip install fastapi uvicorn python-multipart python-dotenv
    fi
else
    echo "❌ Virtual environment not found, recreating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install fastapi uvicorn python-multipart python-dotenv
    if [ -f requirements.txt ]; then
        pip install -r requirements.txt
    fi
fi

# Set environment variables for testing
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

python3 -c "
import sys
import os
sys.path.append('.')

try:
    from main import app
    print('✅ FastAPI app imported successfully')
    print('✅ Environment: ' + os.getenv('ENVIRONMENT', 'not set'))
    print('✅ Database configured: ' + ('Yes' if os.getenv('DATABASE_URL') else 'No'))
except ImportError as e:
    print(f'❌ Import error: {e}')
    print('Will continue with service creation...')
except Exception as e:
    print(f'⚠️  Warning: {e}')
    print('App may still work, continuing...')
" || echo "FastAPI test completed with warnings"

# Create systemd service
echo "=== Creating Systemd Service ==="
sudo tee /etc/systemd/system/logistic-api.service << 'EOF'
[Unit]
Description=FastAPI Logistic Backend
After=network.target

[Service]
Type=exec
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/Logistic-Dokumen/be
Environment=PATH=/home/ubuntu/Logistic-Dokumen/be/venv/bin
ExecStart=/home/ubuntu/Logistic-Dokumen/be/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "=== Starting FastAPI Service ==="
sudo systemctl daemon-reload
sudo systemctl enable logistic-api

# Start service with proper error handling
if sudo systemctl start logistic-api; then
    echo "✅ Service started successfully"
else
    echo "❌ Service failed to start, checking logs..."
    sudo journalctl -u logistic-api --no-pager -n 20
    echo "Attempting to restart..."
    sleep 5
    sudo systemctl restart logistic-api || true
fi

# Wait and check service
sleep 10
echo "=== Service Status ==="
if sudo systemctl is-active --quiet logistic-api; then
    echo "✅ Service is running"
    sudo systemctl status logistic-api --no-pager -l
else
    echo "❌ Service is not running, checking logs..."
    sudo journalctl -u logistic-api --no-pager -n 30
fi
echo ""

# Test local API
echo "=== Testing Local API ==="
for i in {1..5}; do
    if curl -s http://localhost:8000/ >/dev/null 2>&1; then
        echo "✅ Local API is responding"
        curl -s http://localhost:8000/ | head -c 200
        echo ""
        break
    else
        echo "Attempt $i: API not ready, waiting..."
        sleep 5
    fi
done

# Setup SSL certificate
echo "=== Setting up SSL for api-ocr.xyz ==="
sudo systemctl stop nginx

# Wait for port 80 to be free
sleep 5

# Get SSL certificate with better error handling
echo "Getting SSL certificate..."
if sudo certbot certonly --standalone -d api-ocr.xyz --non-interactive --agree-tos --email admin@api-ocr.xyz --force-renewal; then
    echo "✅ SSL certificate obtained successfully"
else
    echo "❌ SSL certificate failed, trying without force-renewal"
    sudo certbot certonly --standalone -d api-ocr.xyz --non-interactive --agree-tos --email admin@api-ocr.xyz
fi

# Create nginx SSL configuration
echo "=== Creating Nginx SSL Configuration ==="
sudo tee /etc/nginx/sites-available/api-ocr.xyz << 'EOF'
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api-ocr.xyz;
    return 301 https://$host$request_uri;
}

# HTTPS with SSL
server {
    listen 443 ssl http2;
    server_name api-ocr.xyz;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api-ocr.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-ocr.xyz/privkey.pem;
    
    # SSL Security - Compatible ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    # Proxy to FastAPI
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        access_log off;
    }

    # File uploads (increase max size)
    client_max_body_size 100M;
}
EOF

# Enable site
echo "=== Enabling Nginx Site ==="
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/api-ocr.xyz /etc/nginx/sites-enabled/

# Test nginx config
echo "=== Testing Nginx Configuration ==="
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration error"
    exit 1
fi

# Start nginx
echo "=== Starting Nginx ==="
sudo systemctl enable nginx
sudo systemctl start nginx

# Wait for nginx to start
sleep 5

# Setup SSL auto-renewal
echo "=== Setting up SSL Auto-renewal ==="
echo "0 2 * * * root certbot renew --quiet && systemctl reload nginx" | sudo tee -a /etc/crontab

echo "=== Final Testing ==="
sleep 10

# Test HTTPS API with retries
echo "Testing HTTPS API endpoints..."
for i in {1..5}; do
    echo "Test attempt $i..."
    
    if curl -k -s https://api-ocr.xyz/ >/dev/null 2>&1; then
        echo "✅ HTTPS API is working!"
        echo "Response sample:"
        curl -k -s https://api-ocr.xyz/ | head -c 200
        echo ""
        break
    else
        echo "HTTPS API not ready, waiting..."
        sleep 10
    fi
done

# Test health endpoint
echo "Testing health endpoint..."
curl -k -s https://api-ocr.xyz/health && echo "✅ Health endpoint working" || echo "❌ Health endpoint failed"

echo ""
echo "=== SETUP COMPLETE! ==="
echo "🚀 API should be available at: https://api-ocr.xyz"
echo "🏥 Health check: https://api-ocr.xyz/health"
echo "📊 Status dashboard: https://api-ocr.xyz/"
echo ""
echo "Services status:"
sudo systemctl status logistic-api nginx --no-pager

echo ""
echo "Firewall status:"
sudo ufw status

echo ""
echo "SSL certificate info:"
sudo certbot certificates