#!/usr/bin/env python3
"""
scripts/ingest.py
─────────────────
Ingest all documents from the /documents directory into the vector store.

Usage (from chatbot-backend/ root):
    python scripts/ingest.py

Environment:
    ADMIN_API_KEY  — must match the backend's ADMIN_API_KEY
    CHATBOT_URL    — base URL of the chatbot backend (default: http://localhost:8000)
"""

from __future__ import annotations
import os
import sys
import httpx

CHATBOT_URL   = os.getenv("CHATBOT_URL", "http://localhost:8000")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "changeme")
DOCS_DIR      = os.path.join(os.path.dirname(__file__), "..", "documents")

# Map filename keywords → collection name
COLLECTION_MAP = {
    "portfolio":  "portfolio",
    "faq":        "faq",
    "terms":      "terms",
    "privacy":    "terms",
    "conditions": "terms",
    "about":      "portfolio",
}


def detect_collection(filename: str) -> str:
    name = filename.lower()
    for keyword, collection in COLLECTION_MAP.items():
        if keyword in name:
            return collection
    return "portfolio"  # default


def main():
    if not os.path.isdir(DOCS_DIR):
        print(f"❌ Documents directory not found: {DOCS_DIR}")
        sys.exit(1)

    docs = [f for f in os.listdir(DOCS_DIR)
            if f.endswith((".md", ".txt", ".pdf")) and not f.startswith(".")]

    if not docs:
        print("ℹ️  No documents found in /documents. Add .md or .txt files first.")
        sys.exit(0)

    print(f"📚 Found {len(docs)} document(s). Ingesting into {CHATBOT_URL} ...\n")

    with httpx.Client(timeout=120) as client:
        for filename in docs:
            filepath   = os.path.join(DOCS_DIR, filename)
            collection = detect_collection(filename)

            with open(filepath, "rb") as f:
                print(f"  → {filename} [{collection}] ... ", end="", flush=True)
                res = client.post(
                    f"{CHATBOT_URL}/admin/ingest",
                    headers={"x-admin-key": ADMIN_API_KEY},
                    files={"file": (filename, f, "text/plain")},
                    data={
                        "collection": collection,
                        "source_url": "",
                        "page_title": filename.replace(".md", "").replace(".txt", "").replace("-", " ").title(),
                    },
                )

            if res.status_code == 200:
                data = res.json()
                print(f"✅ {data['chunks']} chunks")
            else:
                print(f"❌ HTTP {res.status_code}: {res.text}")

    print("\n🎉 Ingestion complete! Your chatbot now knows about:")
    for doc in docs:
        print(f"   • {doc} → {detect_collection(doc)}")


if __name__ == "__main__":
    main()
