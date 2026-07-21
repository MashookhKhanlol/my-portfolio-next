"""app/lanes/support.py — Support lane: contact info + complaint logging"""

from __future__ import annotations
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.services.groq_client import synthesize, PERSONA
from app.config import chatbot_config
from app.core.schemas import SourceLink

SUPPORT_CFG = chatbot_config["support"]
SITE_URL    = chatbot_config["site_url"]

CONTACT_INFO = f"""
- Email: {SUPPORT_CFG.get('contact_email', 'N/A')}
- LinkedIn: {SUPPORT_CFG.get('linkedin', 'N/A')}
- Website: {SITE_URL}
"""

SUPPORT_SYSTEM_PROMPT = f"""You are {PERSONA['name']}, the support assistant for {PERSONA['full_name']}.

Contact information:
{CONTACT_INFO}

Your job:
1. If the user wants to contact or hire: share the contact details above clearly.
2. If the user has a complaint or problem: empathise, and offer to log their inquiry.
3. If asking how to reach someone: provide the correct contact method.
4. Always be warm, professional, and helpful.
5. If logging an inquiry, ask for: name, email, and a brief description of the issue."""


async def run(
    query: str,
    history: List[dict],
    db: AsyncSession,
    session_id: str | None = None,
) -> Tuple[str, List[SourceLink]]:
    response = await synthesize(
        system_prompt=SUPPORT_SYSTEM_PROMPT,
        context=CONTACT_INFO,
        user_message=query,
        history=history,
    )

    sources = [SourceLink(title="Contact", url=f"{SITE_URL}/#contact")]
    return response, sources


async def log_inquiry(
    db: AsyncSession,
    session_id: str | None,
    name: str | None,
    email: str | None,
    subject: str | None,
    message: str,
) -> None:
    """Persist a support inquiry to the database."""
    await db.execute(
        text("""
            INSERT INTO support_inquiries (session_id, name, email, subject, message)
            VALUES (:session_id::uuid, :name, :email, :subject, :message)
        """),
        {
            "session_id": session_id,
            "name":    name,
            "email":   email,
            "subject": subject,
            "message": message,
        },
    )
