"""app/lanes/vision.py — Vision lane: image analysis → RAG lookup"""

from __future__ import annotations
import base64
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.groq_client import analyse_image, PERSONA
from app.lanes.rag import run as rag_run
from app.core.schemas import SourceLink


VISION_PROMPT = (
    f"You are analysing an image for {PERSONA['full_name']} portfolio chatbot. "
    "Describe what you see clearly and concisely — focus on: people, projects shown, "
    "technologies mentioned, text visible, or any relevant professional context. "
    "Your description will be used to find relevant information on the portfolio."
)

FALLBACK_RESPONSE = (
    "I wasn't able to process that image. "
    "Could you describe what you're looking for in text? I'm happy to help!"
)


async def run(
    image_bytes: bytes,
    user_message: str,
    history: List[dict],
    db: AsyncSession,
) -> Tuple[str, List[SourceLink]]:
    """Analyse image → use description as RAG query."""
    # 1. Encode image to base64
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # 2. Get image description from vision model
    description = await analyse_image(image_b64, VISION_PROMPT)

    if description.startswith("[vision error"):
        return FALLBACK_RESPONSE, []

    # 3. Combine description + user message as the RAG query
    combined_query = (
        f"Image description: {description}\n\n"
        f"User question: {user_message or 'What can you tell me about this?'}"
    )

    # 4. Run RAG with the enriched query
    response, sources = await rag_run(
        query=combined_query,
        history=history,
        db=db,
    )

    return response, sources
