"""app/services/groq_client.py — Thin async wrapper around the Groq SDK"""

from __future__ import annotations
import json
from typing import AsyncIterator, List
from groq import AsyncGroq
from app.config import settings, chatbot_config

_client: AsyncGroq | None = None


def get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.groq_api_key)
    return _client


ROUTER_MODEL     = chatbot_config["models"]["router"]
SYNTH_MODEL      = chatbot_config["models"]["synthesizer"]
VISION_MODEL     = chatbot_config["models"]["vision"]
PERSONA          = chatbot_config["persona"]


async def classify_intent(user_message: str, history: List[dict]) -> dict:
    """Route the user message to one of the 5 lanes."""
    system_prompt = f"""You are an intent classifier for {PERSONA['name']}'s website chatbot.

Classify the user's message into EXACTLY one intent from this list:
- rag        : General info about the person (bio, skills, background, about)
- live_data  : Questions needing latest/current data (projects list, experience, what he worked on recently)
- vision     : Message contains an image or asks to analyse a visual
- support    : Help, complaints, "how to contact", "report a problem", hire/work with
- terms      : Terms, conditions, privacy, legal, policy, rates, process
- unknown    : Out of scope, offensive, unrelated

Respond ONLY with valid JSON:
{{"intent": "<one of the above>", "confidence": <0.0-1.0>, "extracted_query": "<cleaned user intent>"}}"""

    recent = history[-4:] if len(history) > 4 else history
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(recent)
    messages.append({"role": "user", "content": user_message})

    res = await get_client().chat.completions.create(
        model=ROUTER_MODEL,
        messages=messages,
        temperature=0.1,
        max_tokens=100,
        response_format={"type": "json_object"},
    )
    try:
        return json.loads(res.choices[0].message.content)
    except Exception:
        return {"intent": "rag", "confidence": 0.5, "extracted_query": user_message}


async def synthesize(
    system_prompt: str,
    context: str,
    user_message: str,
    history: List[dict],
    model: str = SYNTH_MODEL,
) -> str:
    """Single-shot synthesis — returns full response string."""
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-6:])
    if context:
        messages.append({"role": "system", "content": f"CONTEXT:\n{context}"})
    messages.append({"role": "user", "content": user_message})

    res = await get_client().chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=1024,
    )
    return res.choices[0].message.content.strip()


async def synthesize_stream(
    system_prompt: str,
    context: str,
    user_message: str,
    history: List[dict],
    model: str = SYNTH_MODEL,
) -> AsyncIterator[str]:
    """Streaming synthesis — yields text chunks as they arrive."""
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-6:])
    if context:
        messages.append({"role": "system", "content": f"CONTEXT:\n{context}"})
    messages.append({"role": "user", "content": user_message})

    stream = await get_client().chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=1024,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def analyse_image(image_b64: str, prompt: str) -> str:
    """Send an image to Groq's vision model and get a description."""
    try:
        res = await get_client().chat.completions.create(
            model=VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                ],
            }],
            max_tokens=512,
        )
        return res.choices[0].message.content.strip()
    except Exception as exc:
        return f"[vision error: {exc}]"
