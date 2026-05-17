"""
Redis-backed scan processing queue service.
Supports enqueueing jobs, polling status, and dequeuing for workers.
"""
import json
import uuid
import time
from typing import Optional
import redis

# Redis connection (uses same Redis as the rest of the app)
_redis_client: Optional[redis.Redis] = None

QUEUE_KEY = "scan_queue"
JOB_PREFIX = "scan_job:"
JOB_TTL = 3600  # 1 hour


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        import os
        host = os.getenv("REDIS_HOST", "localhost")
        port = int(os.getenv("REDIS_PORT", "6379"))
        db = int(os.getenv("REDIS_DB", "0"))
        _redis_client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
    return _redis_client


def enqueue_scan(user_id: str, file_path: str, file_name: str,
                 recipient_name: str, signature_url: str, image_url: str) -> str:
    """Add a scan job to the Redis queue. Returns job_id."""
    job_id = str(uuid.uuid4())
    job_data = {
        "job_id": job_id,
        "user_id": user_id,
        "file_path": file_path,
        "file_name": file_name,
        "recipient_name": recipient_name,
        "signature_url": signature_url,
        "image_url": image_url,
        "status": "pending",
        "created_at": time.time(),
        "result": None,
        "error": None
    }

    r = get_redis()
    # Store job data
    r.setex(f"{JOB_PREFIX}{job_id}", JOB_TTL, json.dumps(job_data))
    # Push job_id to queue
    r.rpush(QUEUE_KEY, job_id)

    return job_id


def get_job_status(job_id: str) -> Optional[dict]:
    """Get job status and result. Returns None if job not found."""
    r = get_redis()
    raw = r.get(f"{JOB_PREFIX}{job_id}")
    if not raw:
        return None
    return json.loads(raw)


def update_job_status(job_id: str, status: str, result: dict = None, error: str = None):
    """Update job status in Redis."""
    r = get_redis()
    raw = r.get(f"{JOB_PREFIX}{job_id}")
    if not raw:
        return
    job_data = json.loads(raw)
    job_data["status"] = status
    if result is not None:
        job_data["result"] = result
    if error is not None:
        job_data["error"] = error
    job_data["updated_at"] = time.time()
    r.setex(f"{JOB_PREFIX}{job_id}", JOB_TTL, json.dumps(job_data))


def dequeue_scan(timeout: int = 5) -> Optional[dict]:
    """
    Blocking pop from queue. Returns job data dict or None.
    timeout: seconds to wait for a job (0 = block forever)
    """
    r = get_redis()
    result = r.blpop(QUEUE_KEY, timeout=timeout)
    if not result:
        return None
    _, job_id = result
    raw = r.get(f"{JOB_PREFIX}{job_id}")
    if not raw:
        return None
    return json.loads(raw)


def get_queue_length() -> int:
    """Get number of jobs waiting in queue."""
    r = get_redis()
    return r.llen(QUEUE_KEY)
