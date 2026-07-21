-- ─────────────────────────────────────────────────────────────────────────────
-- Chatbot Backend — PostgreSQL Schema
-- Requires: pgvector extension
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Knowledge Chunks (RAG vector store) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     VARCHAR(100) NOT NULL DEFAULT 'default',
    collection  VARCHAR(100) NOT NULL,          -- 'portfolio' | 'faq' | 'terms'
    source_url  TEXT,
    page_title  TEXT,
    chunk_index INTEGER NOT NULL DEFAULT 0,     -- position within source doc
    chunk_text  TEXT NOT NULL,
    embedding   vector(384),                    -- BAAI/bge-small-en-v1.5 dims
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat index for fast approximate nearest neighbour search
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
    ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

CREATE INDEX IF NOT EXISTS knowledge_chunks_site_collection_idx
    ON knowledge_chunks (site_id, collection);

-- ── Chat Sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     VARCHAR(100) NOT NULL DEFAULT 'default',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata    JSONB NOT NULL DEFAULT '{}'
);

-- ── Chat Messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('user','assistant','system')),
    content     TEXT NOT NULL,
    intent      VARCHAR(50),
    sources     JSONB NOT NULL DEFAULT '[]',
    tokens_used INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id, created_at);

-- ── Support Inquiries ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_inquiries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES chat_sessions(id),
    name        VARCHAR(200),
    email       VARCHAR(300),
    subject     VARCHAR(500),
    message     TEXT,
    status      VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
