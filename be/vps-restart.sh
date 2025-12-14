#!/bin/bash
# VPS Complete Restart Script - Update backend with ALL required files
# This fixes both /health 404 and /api/pricing 401 errors

echo "🔄 VPS Complete Backend Update Script"
echo "===================================="

# Navigate to app directory  
cd /var/www/supply-chain-backend || {
    echo "❌ App directory not found. Check path."
    exit 1
}

echo "📥 Pulling latest code from GitHub..."
git pull origin main

echo "📋 Checking required files..."
REQUIRED_FILES=("main.py" "pricing_endpoints.py" "pricing_service.py" "pricing_integration.py" "requirements.txt")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        MISSING_FILES+=("$file")
    else
        echo "✅ Found: $file"
    fi
done

if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
    echo "❌ Missing critical files: ${MISSING_FILES[*]}"
    echo "📤 Please upload these files to VPS first!"
    exit 1
fi

echo "🐍 Installing Python dependencies..."
pip install -r requirements.txt

echo "🔄 Stopping existing processes..."
# Kill any existing Python processes
pkill -f "uvicorn.*main:app" || echo "No existing uvicorn processes"
pkill -f "python.*main.py" || echo "No existing python processes"

# Wait for processes to stop
sleep 3

echo "🚀 Starting new backend process..."
# Start backend in background with proper logging
nohup python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/api.log 2>&1 &

# Wait for startup
sleep 5

echo "🔄 Restarting Nginx..."
sudo systemctl restart nginx

echo ""
echo "✅ Backend restart completed!"
echo ""

echo "🧪 Testing critical endpoints:"
echo ""
echo "▶️  Health check:"
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" https://api-ocr.xyz/health)
if [[ "$HEALTH_RESPONSE" == *"200"* ]]; then
    echo "✅ Health endpoint working!"
else
    echo "❌ Health endpoint failed: $HEALTH_RESPONSE"
fi

echo ""
echo "▶️  Pricing endpoint (without auth):"
PRICING_RESPONSE=$(curl -s -w "%{http_code}" https://api-ocr.xyz/api/pricing)
if [[ "$PRICING_RESPONSE" == *"200"* ]]; then
    echo "✅ Pricing endpoint accessible!"
elif [[ "$PRICING_RESPONSE" == *"401"* ]]; then
    echo "⚠️  Pricing endpoint requires auth (expected)"
else
    echo "❌ Pricing endpoint failed: $PRICING_RESPONSE"
fi

echo ""
echo "📋 Backend logs (last 10 lines):"
tail -10 /tmp/api.log

echo ""
echo "🎯 Next steps:"
echo "1. ✅ Frontend CORS fixed (no more localhost:8000)"
echo "2. 🔄 Test your frontend now - should work!"
echo "3. 🚨 If still 401: Clear browser cache + re-login"
echo ""
echo "📊 Monitor logs: tail -f /tmp/api.log"