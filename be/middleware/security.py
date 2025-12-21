"""
Rate Limiting & DDoS Protection Middleware
"""
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from config.redis_client import RedisClient
import time
from typing import Callable

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware untuk proteksi DDoS
    """
    
    # Rate limits per endpoint (requests per minute)
    RATE_LIMITS = {
        "/api/scans/upload": 10,           # OCR: 10 req/min
        "/api/quiz/generate": 5,           # Quiz: 5 req/min
        "/api/invoices/create": 20,        # Invoice: 20 req/min
        "/api/tools/compress-pdf": 10,     # PDF tools: 10 req/min
        "/api/reviews/submit": 3,          # Reviews: 3 req/min
        "/api/auth/register": 5,           # Register: 5 req/min
        "/api/auth/login": 10,             # Login: 10 req/min
    }
    
    # Global rate limit (per IP)
    GLOBAL_LIMIT = 100  # 100 req/min per IP
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Skip rate limiting for health checks
        if request.url.path in ["/", "/health", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # Get client IP
        client_ip = request.client.host
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        
        # Check global rate limit (per IP)
        if not self._check_global_rate_limit(client_ip):
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please slow down.",
                    "retry_after": 60
                }
            )
        
        # Check endpoint-specific rate limit
        path = request.url.path
        if path in self.RATE_LIMITS:
            limit = self.RATE_LIMITS[path]
            if not self._check_endpoint_rate_limit(client_ip, path, limit):
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded for {path}. Max {limit} requests per minute.",
                        "retry_after": 60
                    }
                )
        
        # Process request
        response = await call_next(request)
        return response
    
    def _check_global_rate_limit(self, ip: str) -> bool:
        """Check global rate limit per IP"""
        try:
            client = RedisClient.get_client()
            if not client:
                return True  # Allow if Redis unavailable
            
            key = f"global_rate:{ip}"
            current = client.get(key)
            
            if current is None:
                client.setex(key, 60, 1)
                return True
            
            count = int(current)
            if count >= self.GLOBAL_LIMIT:
                return False
            
            client.incr(key)
            return True
        except:
            return True  # Allow on error
    
    def _check_endpoint_rate_limit(self, ip: str, path: str, limit: int) -> bool:
        """Check endpoint-specific rate limit"""
        try:
            client = RedisClient.get_client()
            if not client:
                return True
            
            # Sanitize path for Redis key
            path_key = path.replace("/", "_").replace("-", "_")
            key = f"endpoint_rate:{ip}:{path_key}"
            current = client.get(key)
            
            if current is None:
                client.setex(key, 60, 1)
                return True
            
            count = int(current)
            if count >= limit:
                return False
            
            client.incr(key)
            return True
        except:
            return True

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response

class IPBlockingMiddleware(BaseHTTPMiddleware):
    """Block malicious IPs"""
    
    # Blocklist IPs (can be populated from Redis or database)
    BLOCKED_IPS = set()
    
    async def dispatch(self, request: Request, call_next: Callable):
        client_ip = request.client.host
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        
        # Check if IP is blocked
        if client_ip in self.BLOCKED_IPS:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied"}
            )
        
        # Check if IP is auto-blocked by Redis (too many 429 errors)
        if self._is_ip_auto_blocked(client_ip):
            return JSONResponse(
                status_code=403,
                content={"detail": "Your IP has been temporarily blocked due to suspicious activity"}
            )
        
        return await call_next(request)
    
    def _is_ip_auto_blocked(self, ip: str) -> bool:
        """Check if IP is auto-blocked"""
        try:
            client = RedisClient.get_client()
            if not client:
                return False
            
            key = f"blocked_ip:{ip}"
            return client.exists(key) > 0
        except:
            return False
