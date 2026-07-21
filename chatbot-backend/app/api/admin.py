"""app/api/admin.py — Admin endpoints: ingest, health, stats"""

from __future__ import annotations
import os
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import HealthResponse, StatsResponse
from app.config import settings, chatbot_config
from app.services import embeddings as emb
from app.services.session import get_redis

router = APIRouter()
SITE_ID = chatbot_config["site_id"]

CHUNK_SIZE    = 500   # characters per chunk
CHUNK_OVERLAP = 80    # overlap between consecutive chunks


def _verify_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(403, "Invalid admin API key.")


def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    chunks, start = [], 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end].strip())
        start = end - overlap
    return [c for c in chunks if len(c) > 30]


@router.post("/ingest", dependencies=[Depends(_verify_admin)])
async def ingest_document(
    file:       UploadFile = File(...),
    collection: str        = Form("portfolio"),
    source_url: str        = Form(""),
    page_title: str        = Form(""),
    db:         AsyncSession = Depends(get_db),
):
    """
    Upload a text/markdown document and ingest it into the vector store.
    Call this whenever you add or update knowledge documents.
    """
    content = (await file.read()).decode("utf-8", errors="replace")
    chunks  = _chunk_text(content)

    if not chunks:
        return {"message": "No chunks extracted.", "chunks": 0}

    vectors = await emb.embed_texts(chunks)

    # Delete existing chunks for this source
    if source_url:
        await db.execute(
            text("DELETE FROM knowledge_chunks WHERE site_id=:s AND source_url=:u"),
            {"s": SITE_ID, "u": source_url},
        )

    for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
        vec_str = f"[{','.join(str(v) for v in vector)}]"
        await db.execute(text("""
            INSERT INTO knowledge_chunks
                (site_id, collection, source_url, page_title, chunk_index, chunk_text, embedding)
            VALUES
                (:site_id, :collection, :source_url, :page_title, :idx, :text, CAST(:vec AS vector))
        """), {
            "site_id":    SITE_ID,
            "collection": collection,
            "source_url": source_url or file.filename,
            "page_title": page_title or file.filename,
            "idx":        i,
            "text":       chunk,
            "vec":        vec_str,
        })

    return {
        "message":    f"Ingested {len(chunks)} chunks from '{file.filename}'",
        "chunks":     len(chunks),
        "collection": collection,
    }


@router.get("/health", response_model=HealthResponse, dependencies=[Depends(_verify_admin)])
async def health(db: AsyncSession = Depends(get_db)):
    """Check health of all backend components."""
    db_status    = "ok"
    redis_status = "ok"
    groq_status  = "ok"

    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {e}"

    try:
        await get_redis().ping()
    except Exception as e:
        redis_status = f"error: {e}"

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.groq_api_key)
        await client.models.list()
    except Exception as e:
        groq_status = f"error: {e}"

    return HealthResponse(
        status="ok" if all(s == "ok" for s in [db_status, redis_status, groq_status]) else "degraded",
        database=db_status,
        redis=redis_status,
        groq=groq_status,
    )


@router.get("/stats", response_model=StatsResponse, dependencies=[Depends(_verify_admin)])
async def stats(db: AsyncSession = Depends(get_db)):
    sessions = (await db.execute(
        text("SELECT COUNT(*) FROM chat_sessions WHERE site_id=:s"), {"s": SITE_ID}
    )).scalar()
    messages = (await db.execute(
        text("""
            SELECT COUNT(*) FROM chat_messages cm
            JOIN chat_sessions cs ON cs.id=cm.session_id
            WHERE cs.site_id=:s
        """), {"s": SITE_ID}
    )).scalar()
    chunks = (await db.execute(
        text("SELECT COUNT(*) FROM knowledge_chunks WHERE site_id=:s"), {"s": SITE_ID}
    )).scalar()
    intent_rows = (await db.execute(
        text("""
            SELECT cm.intent, COUNT(*) as cnt FROM chat_messages cm
            JOIN chat_sessions cs ON cs.id=cm.session_id
            WHERE cs.site_id=:s AND cm.role='user'
            GROUP BY cm.intent
        """), {"s": SITE_ID}
    )).fetchall()

    return StatsResponse(
        total_sessions=sessions or 0,
        total_messages=messages or 0,
        total_chunks=chunks or 0,
        intents={r.intent: r.cnt for r in intent_rows},
    )


@router.delete("/clear-knowledge", dependencies=[Depends(_verify_admin)])
async def clear_knowledge(collection: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        text("DELETE FROM knowledge_chunks WHERE site_id=:s AND collection=:c"),
        {"s": SITE_ID, "c": collection},
    )
    return {"message": f"Cleared knowledge collection '{collection}'."}
