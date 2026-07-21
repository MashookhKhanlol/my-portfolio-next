"""app/core/schemas.py — Pydantic request/response models"""

from __future__ import annotations
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


class Intent(str, Enum):
    RAG       = "rag"
    LIVE_DATA = "live_data"
    VISION    = "vision"
    SUPPORT   = "support"
    TERMS     = "terms"
    UNKNOWN   = "unknown"


class SourceLink(BaseModel):
    title: str
    url:   str


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:    str     = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    session_id: str
    response:   str
    intent:     Intent
    sources:    List[SourceLink] = []

# ── Admin ─────────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    collection: str = "portfolio"   # which collection to tag chunks with
    source_url: Optional[str] = None
    page_title: Optional[str] = None

class HealthResponse(BaseModel):
    status:   str
    database: str
    redis:    str
    groq:     str

class StatsResponse(BaseModel):
    total_sessions: int
    total_messages: int
    total_chunks:   int
    intents:        dict
