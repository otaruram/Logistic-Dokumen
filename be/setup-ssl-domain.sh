#!/bin/bash
# Setup SSL Certificate dengan Let's Encrypt untuk api-ocr.xyz

echo "🔐 Setting up SSL certificate for api-ocr.xyz"

# 1. Install certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# 2. Obtain SSL certificate untuk api-ocr.xyz
sudo certbot --nginx -d api-ocr.xyz -d www.api-ocr.xyz --non-interactive --agree-tos --email admin@api-ocr.xyz

# 3. Auto renewal setup (certbot biasanya sudah setup cron otomatis)
sudo certbot renew --dry-run

# 4. Update nginx config untuk SSL (certbot otomatis handle ini)
echo "✅ SSL certificate installed!"

# 5. Test domain
echo "🧪 Testing domain..."
curl -I https://api-ocr.xyz

echo "🎉 Domain api-ocr.xyz setup complete!"
echo "🚀 Backend now accessible via:"
echo "   - https://api-ocr.xyz"
echo "   - https://www.api-ocr.xyz"