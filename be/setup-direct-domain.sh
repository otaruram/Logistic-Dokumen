#!/bin/bash
# Alternatif: Setup domain tanpa nginx - langsung bind FastAPI ke port 80/443

echo "🚀 Alternative Setup: Direct domain binding untuk FastAPI"
echo "⚠️ This runs FastAPI directly on port 80 (requires admin privileges)"

echo ""
echo "📋 Manual commands to run as admin:"
echo ""

echo "1️⃣ Stop any service on port 80:"
echo "systemctl stop nginx"  
echo "systemctl stop apache2"

echo ""
echo "2️⃣ Update firewall (if enabled):"
echo "ufw allow 80"
echo "ufw allow 443"

echo ""
echo "3️⃣ Modify main.py to bind to all interfaces:"
echo "nano ~/Logistic-Dokumen/be/main.py"
echo ""
echo "--- Change this line at the bottom: ---"
echo "if __name__ == '__main__':"
echo "    import uvicorn"
echo "    uvicorn.run(app, host='0.0.0.0', port=80)"  # Changed from 8000 to 80
echo ""

echo "4️⃣ Update systemd service file:"
echo "nano /etc/systemd/system/logistic-api.service"
echo ""
echo "--- Update ExecStart line: ---"
echo "[Service]"
echo "ExecStart=/home/ubuntu/Logistic-Dokumen/be/venv/bin/uvicorn main:app --host 0.0.0.0 --port 80"
echo ""

echo "5️⃣ Reload and restart service:"
echo "systemctl daemon-reload"
echo "systemctl restart logistic-api"
echo "systemctl status logistic-api"

echo ""
echo "✅ After these steps:"
echo "   - FastAPI akan running di port 80"
echo "   - Domain api-ocr.xyz akan langsung ke FastAPI"
echo "   - No nginx needed!"

echo ""
echo "🔗 Test dengan:"
echo "curl -I http://api-ocr.xyz"