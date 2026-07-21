# 🤖 Chatbot Backend

A **Groq-powered, RAG-based AI chatbot backend** — reusable for any website by swapping `chatbot.config.json` and the `/documents` folder.

Built with: **FastAPI** · **Groq** · **pgvector** · **Redis** · **fastembed** · **Docker**

---

## Folder Structure

```
chatbot-backend/
├── app/
│   ├── main.py             ← FastAPI entrypoint
│   ├── config.py           ← Settings (env + chatbot.config.json)
│   ├── core/
│   │   ├── database.py     ← Async SQLAlchemy engine
│   │   └── schemas.py      ← Pydantic models
│   ├── services/
│   │   ├── groq_client.py  ← Groq API (router, synth, vision, stream)
│   │   ├── embeddings.py   ← fastembed (BAAI/bge-small-en-v1.5)
│   │   └── session.py      ← Redis session management
│   ├── lanes/
│   │   ├── rag.py          ← RAG (vector search → LLM synthesis)
│   │   ├── live_data.py    ← Live Strapi CMS queries
│   │   ├── vision.py       ← Image analysis → RAG
│   │   ├── support.py      ← Contact info + inquiry logging
│   │   └── terms.py        ← Strict T&C RAG
│   └── api/
│       ├── chat.py         ← /api/chat, /api/chat/stream, /api/chat/upload
│       └── admin.py        ← /admin/ingest, /admin/health, /admin/stats
├── db/
│   └── init.sql            ← PostgreSQL schema (pgvector)
├── widget/
│   └── widget.js           ← Embeddable JS chat bubble
├── documents/              ← Add your knowledge docs here (.md, .txt)
│   ├── portfolio.md
│   └── faq.md
├── scripts/
│   └── ingest.py           ← CLI to ingest all documents
├── chatbot.config.json     ← Per-site config (persona, models, strapi schema)
├── Dockerfile
├── docker-compose.yml
├── nginx-chatbot.conf      ← Nginx reverse proxy snippet
└── .env.example
```

---

## Quick Start

### 1. Prerequisites
- Docker + Docker Compose installed on VPS
- A [Groq API key](https://console.groq.com) (free tier available)

### 2. Configure

```bash
cp .env.example .env
# Edit .env — set GROQ_API_KEY at minimum
nano .env

# Customise the persona, models, and Strapi schema
nano chatbot.config.json
```

### 3. Add your knowledge documents

Drop `.md` or `.txt` files into `/documents/`:
- `portfolio.md` → general info (maps to `portfolio` collection)
- `faq.md`       → FAQ (maps to `faq` collection)
- `terms.md`     → Terms & Conditions (maps to `terms` collection)

### 4. Start the stack

```bash
docker compose up -d --build
```

### 5. Ingest documents

```bash
# Run inside the chatbot container (or locally if you have Python)
docker exec chatbot-backend python scripts/ingest.py
```

Or locally:
```bash
pip install httpx
CHATBOT_URL=http://localhost:8000 ADMIN_API_KEY=changeme python scripts/ingest.py
```

### 6. Embed the widget in your website

Add ONE line before `</body>` on any page:

```html
<script
  src="https://chatbot.flowcrafted.me/widget/widget.js"
  data-api-url="https://chatbot.flowcrafted.me"
  data-theme="dark"
  data-position="bottom-right"
></script>
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send a message, get a full response |
| `POST` | `/api/chat/stream` | Send a message, get SSE streaming response |
| `POST` | `/api/chat/upload` | Send message + image (vision lane) |
| `DELETE` | `/api/chat/session/{id}` | Clear a session |
| `POST` | `/admin/ingest` | Upload + ingest a document |
| `GET` | `/admin/health` | Health check (DB, Redis, Groq) |
| `GET` | `/admin/stats` | Usage statistics |
| `DELETE` | `/admin/clear-knowledge` | Remove a knowledge collection |

**Admin endpoints** require header: `x-admin-key: YOUR_ADMIN_API_KEY`

---

## Chat Request Examples

```bash
# Simple question
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What projects has Mashookh built?"}'

# With session (keep conversation context)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me more about the Patient Management project", "session_id": "your-session-uuid"}'

# Image upload
curl -X POST http://localhost:8000/api/chat/upload \
  -F "message=What tech is shown in this?" \
  -F "image=@screenshot.png"
```

---

## Reuse for a New Client

1. Copy this entire `chatbot-backend/` folder to your new project
2. Update `chatbot.config.json` — change `site_name`, `site_url`, `site_id`, `strapi`, `persona`, `widget`
3. Replace `/documents/*.md` with the new client's content
4. Set `GROQ_API_KEY` and `STRAPI_TOKEN` in `.env`
5. Run `docker compose up -d --build`
6. Run `python scripts/ingest.py` to load the new documents
7. Embed the widget script on the client's site

**Zero code changes needed** — everything is config-driven.

---

## GitHub Secrets Required (for CI/CD)

| Secret | Value |
|--------|-------|
| `GROQ_API_KEY` | Your Groq API key |
| `CHATBOT_ADMIN_KEY` | Strong random string for admin API |
| `CHATBOT_DB_PASS` | PostgreSQL password for chatbot DB |
| `STRAPI_TOKEN` | Strapi API token (for live data lane) |

---

## Architecture

```
Widget (browser) → POST /api/chat
                       ↓
              Intent Router (llama-3.1-8b)
                       ↓
    ┌──────────────────┼─────────────────────┐
    RAG lane      Live Data lane       Vision lane
 (llama-3.3-70b)  (Strapi API)     (llama-4-scout)
    │              │                    │
    └──────────────┴────────────────────┘
                       ↓
              Response + Source Links
                       ↓
                   Widget UI
```
