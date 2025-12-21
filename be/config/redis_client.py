"""
Redis Client Configuration
"""
import redis
import os
from typing import Optional
import json

class RedisClient:
    _instance: Optional[redis.Redis] = None
    
    @classmethod
    def get_client(cls) -> redis.Redis:
        """Get Redis client instance (singleton)"""
        if cls._instance is None:
            try:
                redis_host = os.getenv('REDIS_HOST', 'localhost')
                redis_port = int(os.getenv('REDIS_PORT', 6379))
                redis_db = int(os.getenv('REDIS_DB', 0))
                
                cls._instance = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
                
                # Test connection
                cls._instance.ping()
                print(f"✅ Redis connected: {redis_host}:{redis_port}")
                
            except Exception as e:
                print(f"⚠️ Redis connection failed: {e}")
                print("📝 App will continue without Redis caching")
                cls._instance = None
        
        return cls._instance
    
    @classmethod
    def set_cache(cls, key: str, value: any, ttl: int = 3600) -> bool:
        """Set cache with TTL (default 1 hour)"""
        try:
            client = cls.get_client()
            if client:
                if isinstance(value, (dict, list)):
                    value = json.dumps(value)
                client.setex(key, ttl, value)
                return True
        except Exception as e:
            print(f"⚠️ Redis set error: {e}")
        return False
    
    @classmethod
    def get_cache(cls, key: str) -> Optional[any]:
        """Get cache by key"""
        try:
            client = cls.get_client()
            if client:
                value = client.get(key)
                if value:
                    try:
                        return json.loads(value)
                    except:
                        return value
        except Exception as e:
            print(f"⚠️ Redis get error: {e}")
        return None
    
    @classmethod
    def delete_cache(cls, key: str) -> bool:
        """Delete cache by key"""
        try:
            client = cls.get_client()
            if client:
                client.delete(key)
                return True
        except Exception as e:
            print(f"⚠️ Redis delete error: {e}")
        return False
    
    @classmethod
    def check_rate_limit(cls, user_id: int, action: str, limit: int = 5, window: int = 60) -> bool:
        """
        Rate limiting check
        - user_id: User ID
        - action: Action name (e.g., 'quiz', 'ocr', 'invoice')
        - limit: Maximum requests (default 5)
        - window: Time window in seconds (default 60s)
        
        Returns: True if allowed, False if rate limited
        """
        try:
            client = cls.get_client()
            if not client:
                return True  # Allow if Redis unavailable
            
            key = f"rate_limit:{user_id}:{action}"
            current = client.get(key)
            
            if current is None:
                # First request
                client.setex(key, window, 1)
                return True
            
            count = int(current)
            if count >= limit:
                return False  # Rate limited
            
            # Increment counter
            client.incr(key)
            return True
            
        except Exception as e:
            print(f"⚠️ Rate limit check error: {e}")
            return True  # Allow on error
    
    @classmethod
    def get_rate_limit_info(cls, user_id: int, action: str) -> dict:
        """Get rate limit info for user"""
        try:
            client = cls.get_client()
            if not client:
                return {"remaining": -1, "reset_in": 0}
            
            key = f"rate_limit:{user_id}:{action}"
            current = client.get(key)
            ttl = client.ttl(key)
            
            if current is None:
                return {"remaining": 5, "reset_in": 0}
            
            return {
                "remaining": max(0, 5 - int(current)),
                "reset_in": ttl if ttl > 0 else 0
            }
        except:
            return {"remaining": -1, "reset_in": 0}

# Initialize Redis on import
redis_client = RedisClient.get_client()
