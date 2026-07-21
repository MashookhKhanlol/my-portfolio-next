"""app/lanes/rag.py — Retrieval-Augmented Generation lane"""

from __future__ import annotations
from typing import List, Tuple
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.services import embeddings as emb
from app.services.groq_client import synthesize, PERSONA
from app.config import chatbot_config
from app.core.schemas import SourceLink


RAG_CFG      = chatbot_config["rag"]
COLLECTIONS  = RAG_CFG["collections"]
TOP_K        = RAG_CFG["top_k"]
MIN_SIM      = RAG_CFG["min_similarity"]
SITE_ID      = chatbot_config["site_id"]


async def retrieve(query: str, db: AsyncSession, collection_filter: List[str] | None = None) -> List[dict]:
    """Cosine similarity search in pgvector."""
    vector = await emb.embed_query(query)
    cols   = collection_filter or COLLECTIONS
    cols_sql = ",".join(f"'{c}'" for c in cols)

    sql = text(f"""
        SELECT
            chunk_text,
            source_url,
            page_title,
            1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM knowledge_chunks
        WHERE site_id = :site_id
          AND collection IN ({cols_sql})
          AND 1 - (embedding <=> CAST(:embedding AS vector)) > :min_sim
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :k
    """)

    result = await db.execute(sql, {
        "embedding": f"[{','.join(str(v) for v in vector)}]",
        "site_id":   SITE_ID,
        "min_sim":   MIN_SIM,
        "k":         TOP_K,
    })
    rows = result.fetchall()
    return [
        {
            "text":       r.chunk_text,
            "source_url": r.source_url or "",
            "page_title": r.page_title or "Portfolio",
            "similarity": round(float(r.similarity), 3),
        }
        for r in rows
    ]


def _build_context(chunks: List[dict]) -> str:
    parts = []
    for i, c in enumerate(chunks, 1):
        parts.append(f"[Source {i}: {c['page_title']}]\n{c['text']}")
    return "\n\n".join(parts)


def _extract_sources(chunks: List[dict]) -> List[SourceLink]:
    seen, sources = set(), []
    for c in chunks:
        url = c.get("source_url", "")
        if url and url not in seen:
            seen.add(url)
            sources.append(SourceLink(title=c["page_title"], url=url))
    return sources


SYSTEM_PROMPT = f"""You are {PERSONA['name']}, a helpful AI assistant for {PERSONA['full_name']}.
Tone: {PERSONA['tone']}.
Scope: {PERSONA['scope']}

Rules:
1. Answer ONLY using the provided CONTEXT.
2. If the context doesn't contain the answer, say "I don't have that information — please check the website directly."
3. Always be concise (2–4 sentences unless detail is needed).
4. If citing a source, mention the page title naturally (e.g. "According to the Projects section…").
5. Never make up facts, links, or statistics."""


async def run(
    query: str,
    history: List[dict],
    db: AsyncSession,
    collection_filter: List[str] | None = None,
) -> Tuple[str, List[SourceLink]]:
    chunks  = await retrieve(query, db, collection_filter)
    context = _build_context(chunks) if chunks else ""
    sources = _extract_sources(chunks)

    if not chunks:
        no_ctx_prompt = f"{SYSTEM_PROMPT}\n\nNo relevant context was found."
    else:
        no_ctx_prompt = SYSTEM_PROMPT

    response = await synthesize(
        system_prompt=no_ctx_prompt,
        context=context,
        user_message=query,
        history=history,
    )
    return response, sources
