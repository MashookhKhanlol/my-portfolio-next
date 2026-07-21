"""
app/config.py
Loads settings from environment + chatbot.config.json
"""

from __future__ import annotations
import json
import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Required ──────────────────────────────────────────────────────────────
    groq_api_key: str
    database_url: str
    redis_url: str = "redis://redis:6379/0"

    # ── Security ──────────────────────────────────────────────────────────────
    admin_api_key: str = "changeme"
    strapi_token: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: str = "*"

    # ── Misc ──────────────────────────────────────────────────────────────────
    environment: str = "production"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.cors_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


def _load_chatbot_config() -> dict:
    path = os.path.join(os.path.dirname(__file__), "..", "chatbot.config.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


settings = Settings()
chatbot_config = _load_chatbot_config()
