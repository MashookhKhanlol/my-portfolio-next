"""app/lanes/live_data.py — Live data lane: query Strapi CMS for fresh content"""

from __future__ import annotations
import json
from typing import List, Tuple
import httpx
from app.services.groq_client import synthesize, PERSONA, SYNTH_MODEL
from app.config import settings, chatbot_config
from app.core.schemas import SourceLink


STRAPI_CFG  = chatbot_config["strapi"]
STRAPI_URL  = STRAPI_CFG["url"].rstrip("/")
COLLECTIONS = STRAPI_CFG["collections"]
SITE_URL    = chatbot_config["site_url"]


SCHEMA_DESC = "\n".join(
    f"  - {col}: fields = {', '.join(info['fields'])}"
    for col, info in COLLECTIONS.items()
)


FILTER_SYSTEM_PROMPT = f"""You are a Strapi API query builder for {PERSONA['full_name']}'s portfolio.

Available Strapi collections and their fields:
{SCHEMA_DESC}

Given the user's question, output ONLY valid JSON with this shape:
{{
  "collection": "<collection_name>",
  "filters": {{}},              // Strapi v5 filter object (can be empty)
  "sort": "createdAt:desc",     // optional sort
  "pagination_limit": 25
}}

Examples:
  "Show me recent projects" → {{"collection":"projects","filters":{{}},"sort":"createdAt:desc","pagination_limit":10}}
  "Backend projects only"  → {{"collection":"projects","filters":{{"category":{{"$eq":"Backend"}}}},"sort":"order:asc","pagination_limit":25}}
  "Where did he work?"     → {{"collection":"experiences","filters":{{}},"sort":"order:asc","pagination_limit":10}}"""


async def _build_api_query(user_message: str, history: List[dict]) -> dict | None:
    """Ask the LLM to turn the user's question into Strapi query params."""
    try:
        raw = await synthesize(
            system_prompt=FILTER_SYSTEM_PROMPT,
            context="",
            user_message=user_message,
            history=history[-4:],
        )
        # Extract JSON from response
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        return json.loads(raw[start:end]) if start != -1 else None
    except Exception:
        return None


async def _fetch_strapi(collection: str, filters: dict, sort: str, limit: int) -> list:
    """Fetch from Strapi REST API."""
    headers = {}
    if settings.strapi_token:
        headers["Authorization"] = f"Bearer {settings.strapi_token}"

    params: dict = {
        "populate":          "*",
        "sort":              sort,
        "pagination[limit]": limit,
    }
    for key, val in filters.items():
        params[f"filters[{key}]"] = json.dumps(val)

    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            f"{STRAPI_URL}/api/{collection}",
            params=params,
            headers=headers,
        )
        if res.status_code != 200:
            return []
        data = res.json().get("data", [])
        return data if isinstance(data, list) else [data]


def _format_items(items: list, collection: str) -> str:
    if not items:
        return "No items found."
    fields = COLLECTIONS.get(collection, {}).get("fields", [])
    lines  = []
    for item in items:
        row = {f: item.get(f, "") for f in fields if item.get(f)}
        lines.append("• " + " | ".join(f"{k}: {v}" for k, v in row.items()))
    return "\n".join(lines)


SYNTH_PROMPT = f"""You are {PERSONA['name']}, answering based on live data fetched from the portfolio CMS.
Tone: {PERSONA['tone']}.
Summarise the data naturally and helpfully. Include relevant details but don't dump raw JSON.
If there are links or GitHub URLs, mention them."""


async def run(
    query: str,
    history: List[dict],
) -> Tuple[str, List[SourceLink]]:
    query_params = await _build_api_query(query, history)
    if not query_params:
        response = await synthesize(
            system_prompt=SYNTH_PROMPT,
            context="Could not determine which data to fetch.",
            user_message=query,
            history=history,
        )
        return response, []

    collection = query_params.get("collection", "projects")
    items      = await _fetch_strapi(
        collection=collection,
        filters=query_params.get("filters", {}),
        sort=query_params.get("sort", "createdAt:desc"),
        limit=query_params.get("pagination_limit", 25),
    )

    context  = _format_items(items, collection)
    response = await synthesize(
        system_prompt=SYNTH_PROMPT,
        context=context,
        user_message=query,
        history=history,
    )

    source_url = f"{SITE_URL}/#{collection}"
    sources    = [SourceLink(title=collection.capitalize(), url=source_url)] if items else []
    return response, sources
