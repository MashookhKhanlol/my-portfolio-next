# ─────────────────────────────────────────────────────────────────────────────
# Chatbot Backend — Multi-stage Dockerfile
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build / pre-download embedding model ───────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# System deps for fastembed + asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model so startup is fast
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM python:3.11-slim AS production

WORKDIR /app

# Runtime system deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev curl wget \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages + cached model from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /root/.cache /root/.cache

# Copy application code
COPY app/         ./app/
COPY widget/      ./widget/
COPY documents/   ./documents/
COPY scripts/     ./scripts/
COPY chatbot.config.json ./

# Non-root user for security
RUN addgroup --system chatbot && adduser --system --ingroup chatbot chatbot \
    && chown -R chatbot:chatbot /app /root/.cache
USER chatbot

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/ || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
