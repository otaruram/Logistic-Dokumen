#!/bin/bash
# VPS Restart Script - Update backend with latest changes
# Run this on your VPS to fix the /health endpoint 404 error

echo "🔄 VPS Backend Restart Script"
echo "================================"

# Navigate to app directory
cd /var/www/supply-chain-backend || {
    echo "❌ App directory not found. Check path."
    exit 1
}

echo "📥 Pulling latest code from GitHub..."
git pull origin main

echo "🔄 Restarting Python application..."
# If using systemd service
if systemctl is-active --quiet supply-chain; then
    echo "🔄 Restarting systemd service..."
    sudo systemctl restart supply-chain
    sudo systemctl status supply-chain --no-pager -l
elif pgrep -f "uvicorn.*main:app" > /dev/null; then
    echo "🔄 Killing existing uvicorn processes..."
    pkill -f "uvicorn.*main:app"
    sleep 2
    echo "🚀 Starting new uvicorn process..."
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &
else
    echo "🚀 Starting uvicorn for the first time..."
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &
fi

echo "🔄 Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl status nginx --no-pager -l

echo ""
echo "✅ Restart completed!"
echo ""
echo "🧪 Testing endpoints:"
echo "▶️  Health check:"
curl -s https://api-ocr.xyz/health | jq . || echo "❌ Health check failed"
echo ""
echo "▶️  Root endpoint:"
curl -s -I https://api-ocr.xyz/ | head -1

echo ""
echo "📋 If health endpoint still fails:"
echo "1. Check app logs: tail -f app.log"
echo "2. Check nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "3. Verify port 8000: sudo netstat -tlnp | grep 8000"
echo ""
echo "🎯 Once /health returns 200, your hybrid system will work perfectly!"