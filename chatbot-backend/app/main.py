"""app/main.py — FastAPI application entry point"""

from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os

from app.config import settings, chatbot_config
from app.core.database import engine
from app.api import chat, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # ── Startup ──────────────────────────────────────────────────────────────
    print("🤖 Chatbot backend starting...")
    print(f"   Site: {chatbot_config['site_name']}")
    print(f"   Models: router={chatbot_config['models']['router']}, "
          f"synth={chatbot_config['models']['synthesizer']}")
    # Pre-warm the embedding model (downloads on first call)
    try:
        from app.services.embeddings import embed_query
        await embed_query("warmup")
        print("   ✅ Embedding model loaded.")
    except Exception as e:
        print(f"   ⚠️  Embedding model: {e}")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    await engine.dispose()
    print("👋 Chatbot backend stopped.")


app = FastAPI(
    title=f"{chatbot_config['site_name']} — AI Chatbot API",
    description="Groq-powered, RAG-based website assistant",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(chat.router,  prefix="/api",   tags=["Chat"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

# ── Static widget files ───────────────────────────────────────────────────────
widget_dir = os.path.join(os.path.dirname(__file__), "..", "widget")
if os.path.isdir(widget_dir):
    app.mount("/widget", StaticFiles(directory=widget_dir), name="widget")


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return JSONResponse({
        "service": "chatbot-backend",
        "site":    chatbot_config["site_name"],
        "status":  "running",
        "docs":    "/docs",
    })
