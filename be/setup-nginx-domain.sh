#!/bin/bash
# Setup nginx untuk domain api-ocr.xyz di VPS Ubuntu (tanpa sudo)

echo "🔧 Setting up nginx for api-ocr.xyz domain"
echo "⚠️ Note: Run these commands manually with admin privileges"

echo ""
echo "1️⃣ Install nginx:"
echo "apt update"
echo "apt install -y nginx"

echo ""
echo "2️⃣ Create nginx config file:"
echo "nano /etc/nginx/sites-available/api-ocr.xyz"
echo ""
echo "--- Copy this config: ---"
cat << 'EOF'
server {
    listen 80;
    server_name api-ocr.xyz www.api-ocr.xyz;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Requested-With' always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Requested-With';
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
EOF
echo "--- End of config ---"

echo ""
echo "3️⃣ Enable the site:"
echo "ln -sf /etc/nginx/sites-available/api-ocr.xyz /etc/nginx/sites-enabled/"
echo "rm -f /etc/nginx/sites-enabled/default"

echo ""
echo "4️⃣ Test and reload nginx:"
echo "nginx -t"
echo "systemctl reload nginx"
echo "systemctl enable nginx"

echo ""
echo "✅ Manual setup instructions provided"
echo "🚀 After setup, backend will be accessible via http://api-ocr.xyz"