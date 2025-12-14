#!/bin/bash

# Install certbot if not exists
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx temporarily
sudo systemctl stop nginx

# Get SSL certificate
sudo certbot certonly --standalone -d api-ocr.xyz --non-interactive --agree-tos --email admin@api-ocr.xyz

# Create nginx SSL config
sudo tee /etc/nginx/sites-available/api-ocr-ssl.conf << 'EOF'
server {
    listen 80;
    server_name api-ocr.xyz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api-ocr.xyz;

    ssl_certificate /etc/letsencrypt/live/api-ocr.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-ocr.xyz/privkey.pem;

    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_buffering off;
    }

    location /health {
        proxy_pass http://localhost:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

# Enable site and test
sudo rm -f /etc/nginx/sites-enabled/*
sudo ln -s /etc/nginx/sites-available/api-ocr-ssl.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx

# Setup auto renewal
sudo crontab -l > mycron 2>/dev/null || echo "" > mycron
echo "0 12 * * * /usr/bin/certbot renew --quiet" >> mycron
sudo crontab mycron
rm mycron

echo "SSL setup complete for api-ocr.xyz"