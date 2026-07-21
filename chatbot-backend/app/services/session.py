"""app/services/session.py — Redis-backed session management"""

from __future__ import annotations
import json
import uuid
from typing import List, Optional
from redis.asyncio import Redis
from app.config import settings

_redis: Redis | None = None

SESSION_TTL = 60 * 60 * 2   # 2 hours
MAX_HISTORY = 20             # messages kept per session


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def get_or_create_session(session_id: Optional[str] = None) -> str:
    """Return existing session ID or create a new one."""
    if session_id:
        exists = await get_redis().exists(f"session:{session_id}")
        if exists:
            return session_id
    return str(uuid.uuid4())


async def get_history(session_id: str) -> List[dict]:
    """Return the last MAX_HISTORY messages for a session."""
    raw = await get_redis().lrange(f"history:{session_id}", -MAX_HISTORY, -1)
    return [json.loads(m) for m in raw]


async def append_message(session_id: str, role: str, content: str) -> None:
    key = f"history:{session_id}"
    r   = get_redis()
    await r.rpush(key, json.dumps({"role": role, "content": content}))
    await r.ltrim(key, -MAX_HISTORY, -1)
    await r.expire(key, SESSION_TTL)
    await r.setex(f"session:{session_id}", SESSION_TTL, "1")


async def clear_session(session_id: str) -> None:
    r = get_redis()
    await r.delete(f"history:{session_id}", f"session:{session_id}")
