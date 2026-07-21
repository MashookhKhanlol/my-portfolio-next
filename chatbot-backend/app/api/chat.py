"""app/api/chat.py — /api/chat and /api/chat/upload endpoints"""

from __future__ import annotations
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.core.database import get_db
from app.core.schemas import ChatRequest, ChatResponse, Intent, SourceLink
from app.config import chatbot_config
from app.services import session as sess
from app.services.groq_client import classify_intent
from app.lanes import rag, live_data, vision, support, terms

router = APIRouter()

PERSONA    = chatbot_config["persona"]
SITE_URL   = chatbot_config["site_url"]
SITE_ID    = chatbot_config["site_id"]
UNKNOWN_MSG = (
    "I'm only able to help with questions about this portfolio. "
    "For anything else, please reach out directly via the Contact section."
)


async def _dispatch(
    intent: str,
    query: str,
    history: list,
    db: AsyncSession,
    session_id: str,
    image_bytes: bytes | None = None,
) -> tuple[str, list[SourceLink]]:
    """Route to the correct lane."""
    if intent == Intent.LIVE_DATA:
        return await live_data.run(query, history)
    elif intent == Intent.VISION and image_bytes:
        return await vision.run(image_bytes, query, history, db)
    elif intent == Intent.SUPPORT:
        return await support.run(query, history, db, session_id)
    elif intent == Intent.TERMS:
        return await terms.run(query, history, db)
    elif intent == Intent.UNKNOWN:
        return UNKNOWN_MSG, []
    else:  # rag (default)
        return await rag.run(query, history, db)


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Main chat endpoint — single response (non-streaming)."""
    session_id = await sess.get_or_create_session(req.session_id)
    history    = await sess.get_history(session_id)

    # Classify intent
    classified = await classify_intent(req.message, history)
    intent     = classified.get("intent", "rag")
    clean_q    = classified.get("extracted_query", req.message)

    # Dispatch to lane
    response, sources = await _dispatch(intent, clean_q, history, db, session_id)

    # Persist messages
    await sess.append_message(session_id, "user", req.message)
    await sess.append_message(session_id, "assistant", response)

    # Persist to DB
    await _save_message(db, session_id, "user", req.message, intent, [])
    await _save_message(db, session_id, "assistant", response, intent,
                        [s.model_dump() for s in sources])

    return ChatResponse(
        session_id=session_id,
        response=response,
        intent=Intent(intent),
        sources=sources,
    )


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Streaming chat endpoint — returns Server-Sent Events."""
    session_id = await sess.get_or_create_session(req.session_id)
    history    = await sess.get_history(session_id)

    classified = await classify_intent(req.message, history)
    intent     = classified.get("intent", "rag")
    clean_q    = classified.get("extracted_query", req.message)

    await sess.append_message(session_id, "user", req.message)
    await _save_message(db, session_id, "user", req.message, intent, [])

    async def event_stream():
        # First event: metadata
        yield f"data: {json.dumps({'type':'meta','session_id':session_id,'intent':intent})}\n\n"

        collected = []
        response_text = ""
        sources: list[SourceLink] = []

        # For vision/support/terms/live_data — don't stream, synthesize then send
        if intent in (Intent.LIVE_DATA, Intent.SUPPORT, Intent.TERMS, Intent.VISION):
            response_text, sources = await _dispatch(
                intent, clean_q, history, db, session_id
            )
            yield f"data: {json.dumps({'type':'chunk','text':response_text})}\n\n"
        else:
            # RAG — stream chunks
            chunks = await rag.retrieve(clean_q, db)
            sources = rag._extract_sources(chunks)
            context = rag._build_context(chunks)

            from app.services.groq_client import synthesize_stream
            async for chunk in synthesize_stream(
                system_prompt=rag.SYSTEM_PROMPT,
                context=context,
                user_message=clean_q,
                history=history,
            ):
                response_text += chunk
                yield f"data: {json.dumps({'type':'chunk','text':chunk})}\n\n"

        # Final event: sources + done signal
        src_list = [s.model_dump() for s in sources]
        yield f"data: {json.dumps({'type':'done','sources':src_list})}\n\n"

        await sess.append_message(session_id, "assistant", response_text)
        await _save_message(db, session_id, "assistant", response_text, intent, src_list)

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"X-Session-ID": session_id})


@router.post("/chat/upload", response_model=ChatResponse)
async def chat_with_image(
    message:    str                = Form(default=""),
    session_id: Optional[str]      = Form(default=None),
    image:      UploadFile          = File(...),
    db:         AsyncSession        = Depends(get_db),
):
    """Chat with an image attachment — routes to vision lane."""
    if not image.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are accepted.")

    session_id  = await sess.get_or_create_session(session_id)
    history     = await sess.get_history(session_id)
    image_bytes = await image.read()

    response, sources = await vision.run(image_bytes, message, history, db)

    await sess.append_message(session_id, "user", message or "[image]")
    await sess.append_message(session_id, "assistant", response)
    await _save_message(db, session_id, "user", message or "[image]", "vision", [])
    await _save_message(db, session_id, "assistant", response, "vision",
                        [s.model_dump() for s in sources])

    return ChatResponse(
        session_id=session_id,
        response=response,
        intent=Intent.VISION,
        sources=sources,
    )


@router.delete("/chat/session/{session_id}")
async def clear_session(session_id: str):
    await sess.clear_session(session_id)
    return {"message": "Session cleared."}


async def _save_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
    intent: str,
    sources: list,
) -> None:
    # Upsert session
    await db.execute(text("""
        INSERT INTO chat_sessions (id, site_id) VALUES (:id::uuid, :site_id)
        ON CONFLICT (id) DO UPDATE SET last_active = NOW()
    """), {"id": session_id, "site_id": SITE_ID})

    await db.execute(text("""
        INSERT INTO chat_messages (session_id, role, content, intent, sources)
        VALUES (:session_id::uuid, :role, :content, :intent, :sources::jsonb)
    """), {
        "session_id": session_id,
        "role":    role,
        "content": content,
        "intent":  intent,
        "sources": json.dumps(sources),
    })
