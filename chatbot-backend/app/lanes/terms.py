"""app/lanes/terms.py — Terms & Conditions lane (strict RAG with exact quoting)"""

from __future__ import annotations
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.lanes.rag import run as rag_run, retrieve, _build_context, _extract_sources
from app.services.groq_client import synthesize, PERSONA
from app.config import chatbot_config
from app.core.schemas import SourceLink


TERMS_SYSTEM_PROMPT = f"""You are a legal information assistant for {PERSONA['full_name']}.

STRICT RULES for Terms & Conditions responses:
1. Answer ONLY from the provided CONTEXT — never paraphrase or infer.
2. Quote the relevant section EXACTLY, then explain it plainly.
3. Always cite the document name and section.
4. If the CONTEXT does not contain the answer, say exactly:
   "This information is not covered in the available terms documents. Please contact us directly."
5. Never speculate or add information not in the documents.
6. Use neutral, factual language — avoid opinions."""


async def run(
    query: str,
    history: List[dict],
    db: AsyncSession,
) -> Tuple[str, List[SourceLink]]:
    """Terms lane — same retrieval as RAG but with stricter synthesis prompt."""
    chunks  = await retrieve(query, db, collection_filter=["terms"])
    context = _build_context(chunks) if chunks else ""
    sources = _extract_sources(chunks)

    response = await synthesize(
        system_prompt=TERMS_SYSTEM_PROMPT,
        context=context,
        user_message=query,
        history=history,
    )
    return response, sources
