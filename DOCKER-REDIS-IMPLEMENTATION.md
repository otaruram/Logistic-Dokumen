# 🐳 Docker & Redis Implementation Guide

## 📋 Implementation Strategy

### Phase 1: Dockerize Backend (HIGH PRIORITY)
**Benefits:**
- ✅ Consistent environment (dev = staging = prod)
- ✅ Easy deployment & rollback
- ✅ Isolated dependencies
- ✅ Horizontal scaling ready
- ✅ Poppler + Tesseract included in image

### Phase 2: Add Redis (MEDIUM PRIORITY)
**Use Cases:**
- 🚀 Cache quiz questions (reduce OpenAI API calls)
- 🚀 Cache OCR results (same document = instant result)
- 🚀 Rate limiting (prevent abuse)
- 🚀 Session storage (faster than DB)

---

## 🐳 PHASE 1: Dockerize Backend

### 1️⃣ Create Dockerfile for Backend

```dockerfile
# File: be/Dockerfile
FROM python:3.12-slim

# Install system dependencies (Poppler + Tesseract)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-ind \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first (for layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/')"

# Run uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### 2️⃣ Create .dockerignore

```dockerignore
# File: be/.dockerignore
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
pip-log.txt
pip-delete-this-directory.txt
.tox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.log
.git
.gitignore
.mypy_cache
.pytest_cache
.hypothesis
uploads/*
!uploads/.gitkeep
*.db
*.sqlite
*.sqlite3
```

### 3️⃣ Create docker-compose.yml

```yaml
# File: docker-compose.yml (root directory)
version: '3.8'

services:
  backend:
    build:
      context: ./be
      dockerfile: Dockerfile
    container_name: omni-backend
    ports:
      - "8000:8000"
    environment:
      # Supabase
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      
      # JWT
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - JWT_ALGORITHM=${JWT_ALGORITHM}
      
      # OpenAI
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      
      # Environment
      - ENVIRONMENT=production
    volumes:
      - ./be/uploads:/app/uploads
      - ./be/.env:/app/.env
    restart: unless-stopped
    networks:
      - omni-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  omni-network:
    driver: bridge
```

### 4️⃣ Build & Run Docker

```bash
# Build image
cd /var/www/api-ocr
docker-compose build

# Start container
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Check status
docker-compose ps
```

---

## 🚀 PHASE 2: Add Redis (Optional)

### 1️⃣ Update docker-compose.yml with Redis

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./be
      dockerfile: Dockerfile
    container_name: omni-backend
    ports:
      - "8000:8000"
    environment:
      # ... existing env vars ...
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./be/uploads:/app/uploads
      - ./be/.env:/app/.env
    restart: unless-stopped
    depends_on:
      - redis
    networks:
      - omni-network

  redis:
    image: redis:7-alpine
    container_name: omni-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - omni-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-data:

networks:
  omni-network:
    driver: bridge
```

### 2️⃣ Update requirements.txt

```python
# Add Redis client
redis==5.0.1
```

### 3️⃣ Create Redis Service

```python
# File: be/config/redis_client.py
import redis
import os
from typing import Optional
import json

class RedisClient:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.client = redis.from_url(self.redis_url, decode_responses=True)
        
    def get(self, key: str) -> Optional[dict]:
        """Get cached data"""
        try:
            data = self.client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"❌ Redis GET error: {e}")
            return None
    
    def set(self, key: str, value: dict, ttl: int = 3600):
        """Set cache with TTL (default 1 hour)"""
        try:
            self.client.setex(key, ttl, json.dumps(value))
            return True
        except Exception as e:
            print(f"❌ Redis SET error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete cached data"""
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            print(f"❌ Redis DELETE error: {e}")
            return False

# Singleton instance
redis_client = RedisClient()
```

### 4️⃣ Implement Caching in APIs

```python
# File: be/api/quiz.py (example)
from config.redis_client import redis_client

@router.post("/generate")
async def generate_quiz(request: QuizRequest, user = Depends(get_current_user)):
    # Check cache first
    cache_key = f"quiz:{request.topic}:{request.question_count}"
    cached_quiz = redis_client.get(cache_key)
    
    if cached_quiz:
        print(f"✅ Cache HIT: {cache_key}")
        return cached_quiz
    
    # Generate new quiz (expensive OpenAI call)
    quiz_data = await call_openai_api(request)
    
    # Cache for 1 hour
    redis_client.set(cache_key, quiz_data, ttl=3600)
    
    return quiz_data
```

### 5️⃣ Implement Rate Limiting

```python
# File: be/utils/rate_limiter.py
from config.redis_client import redis_client
from fastapi import HTTPException
import time

def check_rate_limit(user_id: int, endpoint: str, max_requests: int = 10, window: int = 60):
    """
    Rate limit: max_requests per window seconds
    Example: 10 requests per 60 seconds
    """
    key = f"ratelimit:{user_id}:{endpoint}"
    
    try:
        # Get current count
        current = redis_client.client.get(key)
        
        if current is None:
            # First request in window
            redis_client.client.setex(key, window, 1)
            return True
        
        if int(current) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {max_requests} requests per {window} seconds."
            )
        
        # Increment counter
        redis_client.client.incr(key)
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Rate limit check failed: {e}")
        return True  # Fail open (allow request if Redis fails)

# Usage in endpoint:
@router.post("/generate")
async def generate_quiz(request: QuizRequest, user = Depends(get_current_user)):
    check_rate_limit(user.id, "quiz_generate", max_requests=5, window=60)
    # ... rest of code
```

---

## 🚀 VPS Deployment with Docker

### 1️⃣ Install Docker on VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Add user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

### 2️⃣ Deploy with Docker

```bash
# Clone/pull latest code
cd /var/www/api-ocr
git pull origin main

# Stop old process
sudo kill -9 $(sudo lsof -t -i:8000)

# Build and start containers
docker-compose up -d --build

# Check logs
docker-compose logs -f

# Check status
docker ps
```

### 3️⃣ Setup Nginx Reverse Proxy

```nginx
# File: /etc/nginx/sites-available/api-ocr.xyz
server {
    listen 80;
    server_name api-ocr.xyz;

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
        
        # Timeout settings for long requests
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

### 4️⃣ Auto-restart on Server Reboot

```bash
# Create systemd service
sudo nano /etc/systemd/system/omni-docker.service
```

```ini
[Unit]
Description=Omni Scan Suite Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/var/www/api-ocr
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Enable service
sudo systemctl enable omni-docker.service
sudo systemctl start omni-docker.service
```

---

## 📊 Redis Use Cases Priority

### High Priority (Implement First):
1. **Quiz Caching** - Same topic/count = instant result (save OpenAI $)
2. **Rate Limiting** - Prevent API abuse (5 quiz/min, 10 OCR/min)
3. **Session Storage** - Faster than DB queries

### Medium Priority:
4. **OCR Results Cache** - Same document hash = cached result
5. **Weekly Stats Cache** - Dashboard data cached for 5 minutes

### Low Priority:
6. **Feature Flags** - Toggle features without deploy
7. **Job Queue** - For heavy processing (can use Celery later)

---

## 🎯 Recommended Implementation Order

### Week 1: Dockerize Backend
```bash
1. Create Dockerfile + docker-compose.yml
2. Test locally
3. Deploy to VPS
4. Monitor for 2-3 days
```

### Week 2: Add Redis (if needed)
```bash
1. Add Redis to docker-compose.yml
2. Implement quiz caching
3. Add rate limiting
4. Monitor cache hit rate
```

### Week 3: Optimize
```bash
1. Add OCR caching
2. Add dashboard stats cache
3. Fine-tune TTL values
4. Monitor Redis memory usage
```

---

## 💰 Cost Analysis

### Current Setup (No Docker/Redis):
- VPS: Existing cost
- **Total: Current VPS cost**

### With Docker:
- VPS: Same (no extra cost)
- **Total: No additional cost** ✅

### With Docker + Redis:
- VPS: Same (Redis runs in container)
- RAM usage: +50-100MB (minimal)
- **Total: No additional cost** ✅

---

## 🚨 Risks & Mitigation

### Risk 1: Docker Learning Curve
**Mitigation**: Use provided templates, test locally first

### Risk 2: Redis Complexity
**Mitigation**: Start with simple caching, add features gradually

### Risk 3: Deployment Downtime
**Mitigation**: Keep old process running until new container is healthy

---

## ✅ Success Criteria

### Docker Success:
- [ ] Backend starts in container
- [ ] All endpoints work
- [ ] Poppler/Tesseract work
- [ ] No downtime during deploy
- [ ] Auto-restart on server reboot

### Redis Success:
- [ ] Cache hit rate > 30%
- [ ] Response time improved by 50%+
- [ ] OpenAI API calls reduced by 40%+
- [ ] Rate limiting prevents abuse

---

## 📝 Quick Start Commands

```bash
# Phase 1: Docker Only
cd /var/www/api-ocr
docker-compose up -d --build
docker-compose logs -f

# Phase 2: Docker + Redis
# (after updating docker-compose.yml)
docker-compose down
docker-compose up -d --build
docker-compose logs -f redis
```

---

## 🆘 Troubleshooting

### Docker Build Fails:
```bash
# Check Dockerfile syntax
docker-compose config

# Build with verbose output
docker-compose build --no-cache --progress=plain
```

### Container Keeps Restarting:
```bash
# Check logs
docker-compose logs backend

# Check health
docker inspect omni-backend | grep -A 20 Health
```

### Redis Connection Fails:
```bash
# Test Redis from backend container
docker-compose exec backend python -c "import redis; r=redis.from_url('redis://redis:6379'); print(r.ping())"
```

---

## 🎁 Bonus: CI/CD with GitHub Actions

```yaml
# File: .github/workflows/deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          password: ${{ secrets.VPS_PASSWORD }}
          script: |
            cd /var/www/api-ocr
            git pull origin main
            docker-compose up -d --build
            docker-compose logs --tail=100
```

**Recommendation**: Start with Docker first (Phase 1), monitor for 1 week, then decide if Redis is needed based on actual performance metrics! 🚀
