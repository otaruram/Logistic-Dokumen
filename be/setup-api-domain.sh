#!/bin/bash
# Manual DNS Setup untuk api-ocr.xyz

echo "🌐 Setting up api-ocr.xyz domain"

# Jika domain belum di Cloudflare, tambahkan manual melalui dashboard atau API
curl -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer rT6DEMw4WluhCq7-iOZZ_xYasjDDUR7egrcuK8SY" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "api-ocr.xyz",
    "account": {
      "id": "d7bc6fc83f48e31be5148ebbf2efb765"  
    }
  }'

echo "📋 Get Zone ID for api-ocr.xyz:"

# Get Zone ID
curl -X GET "https://api.cloudflare.com/client/v4/zones?name=api-ocr.xyz" \
  -H "Authorization: Bearer rT6DEMw4WluhCq7-iOZZ_xYasjDDUR7egrcuK8SY" \
  -H "Content-Type: application/json"